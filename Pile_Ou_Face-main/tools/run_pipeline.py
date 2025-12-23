#!/usr/bin/env python3
"""Run AST risk analysis + Unicorn tracing and emit a unified JSON trace."""

# Pipeline entry point used by the CLI.

from __future__ import annotations

import argparse
import json
import os
import subprocess
import shutil
import re
from typing import List, Optional

from ast_risks import analyze_python_ast
from unicorn_trace import TraceConfig, trace_binary


def _normalize_path(path: str) -> str:
    cwd = os.getcwd()
    if path.startswith(cwd + os.sep):
        return os.path.relpath(path, cwd)
    return path


def _load_binary(path: str) -> bytes:
    with open(path, "rb") as handle:
        return handle.read()


# Run the full pipeline: trace + optional AST risks + disassembly.
def run_pipeline(
    binary_path: str,
    source_path: Optional[str],
    config: TraceConfig,
    output_path: Optional[str],
) -> dict:
    code = _load_binary(binary_path)
    trace = trace_binary(code, config, binary_path)

    # Optional static analysis results (Python AST).
    risks: List[dict] = []
    if source_path:
        risks = analyze_python_ast(source_path)
        for risk in risks:
            risk["file"] = _normalize_path(risk.get("file", source_path))

    # Optional disassembly for the UI (objdump).
    disasm = None
    if shutil.which("objdump") and output_path:
        disasm_path = _derive_disasm_path(output_path)
        disasm = _build_disasm(binary_path, output_path=disasm_path)

    return {
        "snapshots": trace.get("snapshots", []),
        "risks": risks,
        "meta": {
            **trace.get("meta", {}),
            "binary": _normalize_path(binary_path),
            "source": _normalize_path(source_path) if source_path else None,
            "disasm_path": os.path.abspath(disasm.get("path")) if disasm else None,
            "disasm": disasm.get("lines") if disasm else None,
        },
    }



# Generate disassembly text and an addr->line list for highlighting.
def _build_disasm(binary_path: str, output_path: str) -> dict | None:
    try:
        result = subprocess.run(
            ["objdump", "-d", "-M", "intel", binary_path],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None

    if result.returncode != 0:
        return None

    lines = []
    for idx, line in enumerate(result.stdout.splitlines(), start=1):
        match = re.match(r"^\s*([0-9a-fA-F]+):\s*(.*)$", line)
        if not match:
            continue
        addr = f"0x{match.group(1).lower()}"
        text_line = match.group(2).strip()
        lines.append({"addr": addr, "text": text_line, "line": idx})

    with open(output_path, "w", encoding="utf-8") as handle:
        handle.write(result.stdout)

    return {"path": output_path, "lines": lines}


# Convert output.json -> output.disasm.asm (same stem).
def _derive_disasm_path(output_path: str) -> str:
    if output_path.endswith(".json"):
        return output_path[: -len(".json")] + ".disasm.asm"
    return output_path + ".disasm.asm"


def _main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate a trace JSON with Unicorn + AST risk analysis"
    )
    parser.add_argument("--binary", required=True, help="Raw x86_64 binary")
    parser.add_argument("--source", help="Python source to analyze for AST risks")
    parser.add_argument("--output", default="output.json", help="Output JSON path")
    parser.add_argument("--base", default="0x400000", help="Base address for raw/PIE binaries")
    parser.add_argument("--stack-base", default="0x7ffffffde000", help="Stack base")
    parser.add_argument("--stack-size", type=int, default=0x20000, help="Stack size bytes")
    parser.add_argument("--max-steps", type=int, default=200, help="Max instructions")
    parser.add_argument("--stack-entries", type=int, default=24, help="Stack entries")
    parser.add_argument(
        "--arch-bits",
        type=int,
        default=64,
        choices=[32, 64],
        help="Architecture bits for raw binaries",
    )
    parser.add_argument(
        "--start-interp",
        action="store_true",
        help="Start execution at the ELF interpreter entrypoint",
    )
    parser.add_argument(
        "--stdin",
        default="",
        help="Inject data for read(0, ...) syscalls",
    )
    parser.add_argument(
        "--stdin-hex",
        default=None,
        help="Inject raw bytes (hex), e.g. 41414141",
    )
    parser.add_argument(
        "--buffer-offset",
        type=int,
        default=None,
        help="Buffer offset from RBP for highlighting (e.g. -64)",
    )
    parser.add_argument(
        "--buffer-size",
        type=int,
        default=0,
        help="Buffer size in bytes for highlighting",
    )
    parser.add_argument(
        "--start-symbol",
        default=None,
        help="Start execution at a given symbol (e.g. main)",
    )
    parser.add_argument(
        "--argv1",
        default=None,
        help="Set argv[1] for the emulated program",
    )
    args = parser.parse_args(argv)

    stdin_data = args.stdin.encode("utf-8", errors="ignore")
    if args.stdin_hex:
        cleaned = args.stdin_hex.replace(" ", "").replace("\n", "")
        if cleaned.startswith("0x"):
            cleaned = cleaned[2:]
        try:
            stdin_data = bytes.fromhex(cleaned)
        except ValueError:
            raise SystemExit("Invalid --stdin-hex (expected hex bytes)")

    config = TraceConfig(
        base=int(args.base, 16),
        stack_base=int(args.stack_base, 16),
        stack_size=args.stack_size,
        max_steps=args.max_steps,
        stack_entries=args.stack_entries,
        arch_bits=args.arch_bits,
        interp_base=0x70000000 if args.arch_bits == 32 else 0x7f0000000000,
        start_interp=args.start_interp,
        stdin_data=stdin_data,
        buffer_offset=args.buffer_offset,
        buffer_size=args.buffer_size,
        start_symbol=args.start_symbol,
        argv1=args.argv1,
    )

    payload = run_pipeline(args.binary, args.source, config, args.output)

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)

    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
