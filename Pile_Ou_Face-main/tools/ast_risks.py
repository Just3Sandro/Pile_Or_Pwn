#!/usr/bin/env python3
"""AST-based risk detection for Python sources."""

from __future__ import annotations

import ast
import os
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple


@dataclass
class Risk:
    line: int
    kind: str
    severity: str
    message: str
    file: str

    def to_json(self) -> dict:
        return {
            "line": self.line,
            "kind": self.kind,
            "severity": self.severity,
            "message": self.message,
            "file": self.file,
        }


class RiskyCallDetector(ast.NodeVisitor):
    """Detects a small set of risky call patterns."""

    def __init__(self, source_path: str) -> None:
        self._source_path = source_path
        self._imports: Dict[str, str] = {}
        self._from_imports: Dict[str, str] = {}
        self._risks: List[Risk] = []

    @property
    def risks(self) -> List[Risk]:
        return self._risks

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            name = alias.name
            asname = alias.asname or name
            self._imports[asname] = name
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if not node.module:
            return
        for alias in node.names:
            name = alias.name
            asname = alias.asname or name
            self._from_imports[asname] = f"{node.module}.{name}"
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        resolved = self._resolve_call(node.func)
        if resolved:
            self._check_call(node, resolved)
        self.generic_visit(node)

    def _resolve_call(self, func: ast.AST) -> Optional[str]:
        if isinstance(func, ast.Name):
            name = func.id
            if name in self._from_imports:
                return self._from_imports[name]
            return name
        if isinstance(func, ast.Attribute):
            parts = []
            cur = func
            while isinstance(cur, ast.Attribute):
                parts.append(cur.attr)
                cur = cur.value
            if isinstance(cur, ast.Name):
                parts.append(cur.id)
            full = ".".join(reversed(parts))
            base = full.split(".", 1)[0]
            if base in self._imports:
                return full.replace(base, self._imports[base], 1)
            if base in self._from_imports:
                return full.replace(base, self._from_imports[base], 1)
            return full
        return None

    def _check_call(self, node: ast.Call, full_name: str) -> None:
        if full_name in {"eval", "exec"}:
            self._add(node, full_name, "high", "Dynamic code execution")
            return
        if full_name in {"os.system"}:
            self._add(node, "os.system", "high", "Shell execution")
            return
        if full_name.startswith("subprocess."):
            if self._has_shell_true(node):
                self._add(node, full_name, "high", "subprocess with shell=True")
            else:
                self._add(node, full_name, "medium", "subprocess execution")
            return
        if full_name.startswith("pickle.") and full_name in {"pickle.load", "pickle.loads"}:
            self._add(node, full_name, "medium", "Pickle deserialization")
            return
        if full_name in {"yaml.load", "ruamel.yaml.load"}:
            self._add(node, full_name, "medium", "YAML load without SafeLoader")
            return
        if full_name.startswith("ctypes."):
            self._add(node, full_name, "medium", "ctypes native call")
            return

    def _has_shell_true(self, node: ast.Call) -> bool:
        for keyword in node.keywords:
            if keyword.arg == "shell":
                value = keyword.value
                if isinstance(value, ast.Constant) and value.value is True:
                    return True
        return False

    def _add(self, node: ast.AST, kind: str, severity: str, message: str) -> None:
        line = getattr(node, "lineno", 1)
        self._risks.append(
            Risk(
                line=line,
                kind=kind,
                severity=severity,
                message=message,
                file=self._source_path,
            )
        )


def analyze_python_ast(source_path: str) -> List[dict]:
    if not os.path.exists(source_path):
        raise FileNotFoundError(source_path)

    with open(source_path, "r", encoding="utf-8") as handle:
        source = handle.read()

    tree = ast.parse(source, filename=source_path)
    detector = RiskyCallDetector(source_path)
    detector.visit(tree)

    risks = [risk.to_json() for risk in detector.risks]
    return risks


def _main(argv: Optional[Iterable[str]] = None) -> int:
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Detect risky Python AST patterns.")
    parser.add_argument("source", help="Python source file to analyze")
    parser.add_argument("-o", "--output", help="Optional JSON output path")
    args = parser.parse_args(argv)

    risks = analyze_python_ast(args.source)
    payload = {"risks": risks}

    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
    else:
        print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
