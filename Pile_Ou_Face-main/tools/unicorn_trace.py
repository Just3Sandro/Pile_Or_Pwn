#!/usr/bin/env python3
"""Unicorn-based execution trace for x86_64 raw binaries."""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

try:
    from unicorn import Uc, UcError
    from unicorn import (
        UC_ARCH_X86,
        UC_MODE_32,
        UC_MODE_64,
        UC_HOOK_CODE,
        UC_HOOK_INSN,
        UC_HOOK_INTR,
        UC_PROT_ALL,
    )
    from unicorn.x86_const import (
        UC_X86_REG_RAX,
        UC_X86_REG_RBX,
        UC_X86_REG_RCX,
        UC_X86_REG_RDX,
        UC_X86_REG_RSI,
        UC_X86_REG_RDI,
        UC_X86_REG_RBP,
        UC_X86_REG_RSP,
        UC_X86_REG_RIP,
        UC_X86_REG_R8,
        UC_X86_REG_R9,
        UC_X86_REG_R10,
        UC_X86_REG_R11,
        UC_X86_REG_R12,
        UC_X86_REG_R13,
        UC_X86_REG_R14,
        UC_X86_REG_R15,
        UC_X86_REG_EAX,
        UC_X86_REG_EBX,
        UC_X86_REG_ECX,
        UC_X86_REG_EDX,
        UC_X86_REG_ESI,
        UC_X86_REG_EDI,
        UC_X86_REG_EBP,
        UC_X86_REG_ESP,
        UC_X86_REG_EIP,
        UC_X86_INS_SYSCALL,
    )
except ImportError as exc:  # pragma: no cover - guard for missing deps
    raise SystemExit("Unicorn is required. Install with: pip install unicorn") from exc


REG_ORDER_64 = [
    ("rax", UC_X86_REG_RAX),
    ("rbx", UC_X86_REG_RBX),
    ("rcx", UC_X86_REG_RCX),
    ("rdx", UC_X86_REG_RDX),
    ("rsi", UC_X86_REG_RSI),
    ("rdi", UC_X86_REG_RDI),
    ("rbp", UC_X86_REG_RBP),
    ("rsp", UC_X86_REG_RSP),
    ("rip", UC_X86_REG_RIP),
    ("r8", UC_X86_REG_R8),
    ("r9", UC_X86_REG_R9),
    ("r10", UC_X86_REG_R10),
    ("r11", UC_X86_REG_R11),
    ("r12", UC_X86_REG_R12),
    ("r13", UC_X86_REG_R13),
    ("r14", UC_X86_REG_R14),
    ("r15", UC_X86_REG_R15),
]

REG_ORDER_32 = [
    ("eax", UC_X86_REG_EAX),
    ("ebx", UC_X86_REG_EBX),
    ("ecx", UC_X86_REG_ECX),
    ("edx", UC_X86_REG_EDX),
    ("esi", UC_X86_REG_ESI),
    ("edi", UC_X86_REG_EDI),
    ("ebp", UC_X86_REG_EBP),
    ("esp", UC_X86_REG_ESP),
    ("eip", UC_X86_REG_EIP),
]


@dataclass
class TraceConfig:
    base: int
    stack_base: int
    stack_size: int
    max_steps: int
    stack_entries: int
    arch_bits: int
    interp_base: int
    start_interp: bool
    stdin_data: bytes
    buffer_offset: Optional[int]
    buffer_size: int
    start_symbol: Optional[str]


def _align_up(value: int, align: int) -> int:
    return (value + align - 1) & ~(align - 1)


def _capstone_available() -> bool:
    return importlib.util.find_spec("capstone") is not None


def _format_instr(code_bytes: bytes, addr: int, arch_bits: int) -> str:
    if not code_bytes:
        return "(no bytes)"
    if not _capstone_available():
        return f"{code_bytes.hex()}"
    from capstone import Cs, CS_ARCH_X86, CS_MODE_32, CS_MODE_64  # type: ignore

    mode = CS_MODE_64 if arch_bits == 64 else CS_MODE_32
    disasm = Cs(CS_ARCH_X86, mode)
    for insn in disasm.disasm(code_bytes, addr):
        return f"{insn.mnemonic} {insn.op_str}".strip()
    return code_bytes.hex()


def _init_stack(uc: Uc, config: TraceConfig) -> int:
    uc.mem_map(config.stack_base, config.stack_size, UC_PROT_ALL)
    word_size = 8 if config.arch_bits == 64 else 4
    sp = config.stack_base + config.stack_size - word_size
    if config.arch_bits == 64:
        uc.reg_write(UC_X86_REG_RSP, sp)
        uc.reg_write(UC_X86_REG_RBP, sp)
    else:
        uc.reg_write(UC_X86_REG_ESP, sp)
        uc.reg_write(UC_X86_REG_EBP, sp)
    return sp


def _get_reg_order(config: TraceConfig) -> List[tuple]:
    return REG_ORDER_64 if config.arch_bits == 64 else REG_ORDER_32


def _get_pc_sp(config: TraceConfig) -> tuple:
    if config.arch_bits == 64:
        return UC_X86_REG_RIP, UC_X86_REG_RSP
    return UC_X86_REG_EIP, UC_X86_REG_ESP


def trace_raw(code_bytes: bytes, config: TraceConfig) -> Dict[str, object]:
    if config.arch_bits == 32 and config.stack_base > 0xFFFFFFFF:
        config = TraceConfig(
            base=config.base,
            stack_base=0xBFF00000,
            stack_size=config.stack_size,
            max_steps=config.max_steps,
            stack_entries=config.stack_entries,
            arch_bits=config.arch_bits,
            interp_base=config.interp_base,
            start_interp=config.start_interp,
            stdin_data=config.stdin_data,
            buffer_offset=config.buffer_offset,
            buffer_size=config.buffer_size,
            start_symbol=config.start_symbol,
        )
    mode = UC_MODE_64 if config.arch_bits == 64 else UC_MODE_32
    uc = Uc(UC_ARCH_X86, mode)

    code_size = _align_up(len(code_bytes), 0x1000)
    uc.mem_map(config.base, code_size, UC_PROT_ALL)
    uc.mem_write(config.base, code_bytes)

    _init_stack(uc, config)

    snapshots: List[dict] = []
    step_counter = 0
    error: Optional[str] = None
    pc_reg, sp_reg = _get_pc_sp(config)
    reg_order = _get_reg_order(config)
    word_size = 8 if config.arch_bits == 64 else 4
    stdin_pos = 0

    def handle_read_syscall(uc_engine: Uc, fd: int, buf: int, count: int) -> int:
        nonlocal stdin_pos
        if fd != 0:
            return -1
        remaining = len(config.stdin_data) - stdin_pos
        to_copy = min(count, max(remaining, 0))
        if to_copy > 0:
            chunk = config.stdin_data[stdin_pos : stdin_pos + to_copy]
            uc_engine.mem_write(buf, chunk)
            stdin_pos += to_copy
        return to_copy

    def hook_intr(uc_engine: Uc, intno: int, _user_data: object) -> None:
        if config.arch_bits != 32:
            return
        if intno != 0x80:
            return
        syscall_no = uc_engine.reg_read(UC_X86_REG_EAX)
        if syscall_no == 3:  # sys_read
            fd = uc_engine.reg_read(UC_X86_REG_EBX)
            buf = uc_engine.reg_read(UC_X86_REG_ECX)
            count = uc_engine.reg_read(UC_X86_REG_EDX)
            result = handle_read_syscall(uc_engine, fd, buf, count)
            uc_engine.reg_write(UC_X86_REG_EAX, result)

    def hook_syscall(uc_engine: Uc, _user_data: object) -> None:
        if config.arch_bits != 64:
            return
        syscall_no = uc_engine.reg_read(UC_X86_REG_RAX)
        if syscall_no == 0:  # sys_read
            fd = uc_engine.reg_read(UC_X86_REG_RDI)
            buf = uc_engine.reg_read(UC_X86_REG_RSI)
            count = uc_engine.reg_read(UC_X86_REG_RDX)
            result = handle_read_syscall(uc_engine, fd, buf, count)
            uc_engine.reg_write(UC_X86_REG_RAX, result)
    stdin_pos = 0

    def handle_read_syscall(uc_engine: Uc, fd: int, buf: int, count: int) -> int:
        nonlocal stdin_pos
        if fd != 0:
            return -1
        remaining = len(config.stdin_data) - stdin_pos
        to_copy = min(count, max(remaining, 0))
        if to_copy > 0:
            chunk = config.stdin_data[stdin_pos : stdin_pos + to_copy]
            uc_engine.mem_write(buf, chunk)
            stdin_pos += to_copy
        return to_copy

    def hook_intr(uc_engine: Uc, intno: int, _user_data: object) -> None:
        if config.arch_bits != 32:
            return
        if intno != 0x80:
            return
        syscall_no = uc_engine.reg_read(UC_X86_REG_EAX)
        if syscall_no == 3:  # sys_read
            fd = uc_engine.reg_read(UC_X86_REG_EBX)
            buf = uc_engine.reg_read(UC_X86_REG_ECX)
            count = uc_engine.reg_read(UC_X86_REG_EDX)
            result = handle_read_syscall(uc_engine, fd, buf, count)
            uc_engine.reg_write(UC_X86_REG_EAX, result)

    def hook_syscall(uc_engine: Uc, _user_data: object) -> None:
        if config.arch_bits != 64:
            return
        syscall_no = uc_engine.reg_read(UC_X86_REG_RAX)
        if syscall_no == 0:  # sys_read
            fd = uc_engine.reg_read(UC_X86_REG_RDI)
            buf = uc_engine.reg_read(UC_X86_REG_RSI)
            count = uc_engine.reg_read(UC_X86_REG_RDX)
            result = handle_read_syscall(uc_engine, fd, buf, count)
            uc_engine.reg_write(UC_X86_REG_RAX, result)
    stdin_pos = 0

    def handle_read_syscall(uc_engine: Uc, fd: int, buf: int, count: int) -> int:
        nonlocal stdin_pos
        if fd != 0:
            return -1
        remaining = len(config.stdin_data) - stdin_pos
        to_copy = min(count, max(remaining, 0))
        if to_copy > 0:
            chunk = config.stdin_data[stdin_pos : stdin_pos + to_copy]
            uc_engine.mem_write(buf, chunk)
            stdin_pos += to_copy
        return to_copy

    def hook_intr(uc_engine: Uc, intno: int, _user_data: object) -> None:
        if config.arch_bits != 32:
            return
        if intno != 0x80:
            return
        syscall_no = uc_engine.reg_read(UC_X86_REG_EAX)
        if syscall_no == 3:  # sys_read
            fd = uc_engine.reg_read(UC_X86_REG_EBX)
            buf = uc_engine.reg_read(UC_X86_REG_ECX)
            count = uc_engine.reg_read(UC_X86_REG_EDX)
            result = handle_read_syscall(uc_engine, fd, buf, count)
            uc_engine.reg_write(UC_X86_REG_EAX, result)

    def hook_syscall(uc_engine: Uc, _user_data: object) -> None:
        if config.arch_bits != 64:
            return
        syscall_no = uc_engine.reg_read(UC_X86_REG_RAX)
        if syscall_no == 0:  # sys_read
            fd = uc_engine.reg_read(UC_X86_REG_RDI)
            buf = uc_engine.reg_read(UC_X86_REG_RSI)
            count = uc_engine.reg_read(UC_X86_REG_RDX)
            result = handle_read_syscall(uc_engine, fd, buf, count)
            uc_engine.reg_write(UC_X86_REG_RAX, result)

    def hook_code(uc_engine: Uc, addr: int, size: int, _user_data: object) -> None:
        nonlocal step_counter
        if step_counter >= config.max_steps:
            uc_engine.emu_stop()
            return
        step_counter += 1

        instr_bytes = bytes(uc_engine.mem_read(addr, size)) if size > 0 else b""
        instr_text = _format_instr(instr_bytes, addr, config.arch_bits)

        regs = []
        for idx, (name, reg_id) in enumerate(reg_order):
            value = uc_engine.reg_read(reg_id)
            regs.append({"name": name, "value": hex(value), "pos": idx})

        sp_local = uc_engine.reg_read(sp_reg)
        stack_items: List[dict] = []
        try:
            raw = bytes(
                uc_engine.mem_read(sp_local, config.stack_entries * word_size)
            )
            for i in range(config.stack_entries):
                chunk = raw[i * word_size : (i + 1) * word_size]
                value = int.from_bytes(chunk, byteorder="little", signed=False)
                stack_items.append(
                    {
                        "id": i,
                        "addr": hex(sp_local + i * word_size),
                        "pos": i * word_size,
                        "size": word_size,
                        "value": hex(value),
                    }
                )
        except UcError:
            pass

        snapshots.append(
            {
                "step": step_counter,
                "rip": hex(addr),
                "rsp": hex(sp_local),
                "instr": instr_text,
                "stack": stack_items,
                "registers": regs,
            }
        )

    uc.hook_add(UC_HOOK_CODE, hook_code)
    uc.hook_add(UC_HOOK_INTR, hook_intr)
    uc.hook_add(UC_HOOK_INSN, hook_syscall, None, 1, 0, UC_X86_INS_SYSCALL)
    uc.hook_add(UC_HOOK_INTR, hook_intr)
    uc.hook_add(UC_HOOK_INSN, hook_syscall, None, 1, 0, UC_X86_INS_SYSCALL)
    uc.hook_add(UC_HOOK_INTR, hook_intr)
    uc.hook_add(UC_HOOK_INSN, hook_syscall, None, 1, 0, UC_X86_INS_SYSCALL)

    try:
        uc.emu_start(config.base, config.base + len(code_bytes))
    except UcError as exc:
        error = str(exc)

    return {
        "snapshots": snapshots,
        "meta": {
            "steps": step_counter,
            "error": error,
            "base": hex(config.base),
            "stack_base": hex(config.stack_base),
            "stack_size": config.stack_size,
            "arch_bits": config.arch_bits,
            "word_size": word_size,
            "buffer_offset": config.buffer_offset,
            "buffer_size": config.buffer_size,
            "stdin_len": len(config.stdin_data),
        },
    }


def _read_u16(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 2], "little")


def _read_u32(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 4], "little")


def _read_u64(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 8], "little")


def _parse_elf_header(blob: bytes) -> dict:
    if len(blob) < 16 or blob[:4] != b"\x7fELF":
        raise ValueError("Not an ELF file")
    elf_class = blob[4]
    endian = blob[5]
    if endian != 1:
        raise ValueError("Only little-endian ELF supported")

    if elf_class == 1:
        e_type = _read_u16(blob, 16)
        e_machine = _read_u16(blob, 18)
        e_entry = _read_u32(blob, 24)
        e_phoff = _read_u32(blob, 28)
        e_phentsize = _read_u16(blob, 42)
        e_phnum = _read_u16(blob, 44)
        return {
            "class": 32,
            "type": e_type,
            "machine": e_machine,
            "entry": e_entry,
            "phoff": e_phoff,
            "phentsize": e_phentsize,
            "phnum": e_phnum,
        }
    if elf_class == 2:
        e_type = _read_u16(blob, 16)
        e_machine = _read_u16(blob, 18)
        e_entry = _read_u64(blob, 24)
        e_phoff = _read_u64(blob, 32)
        e_phentsize = _read_u16(blob, 54)
        e_phnum = _read_u16(blob, 56)
        return {
            "class": 64,
            "type": e_type,
            "machine": e_machine,
            "entry": e_entry,
            "phoff": e_phoff,
            "phentsize": e_phentsize,
            "phnum": e_phnum,
        }
    raise ValueError("Unsupported ELF class")


def _parse_program_headers(blob: bytes, header: dict) -> List[dict]:
    phoff = header["phoff"]
    phentsize = header["phentsize"]
    phnum = header["phnum"]
    entries = []

    for idx in range(phnum):
        offset = phoff + idx * phentsize
        if header["class"] == 32:
            p_type = _read_u32(blob, offset)
            p_offset = _read_u32(blob, offset + 4)
            p_vaddr = _read_u32(blob, offset + 8)
            p_paddr = _read_u32(blob, offset + 12)
            p_filesz = _read_u32(blob, offset + 16)
            p_memsz = _read_u32(blob, offset + 20)
            p_flags = _read_u32(blob, offset + 24)
            p_align = _read_u32(blob, offset + 28)
        else:
            p_type = _read_u32(blob, offset)
            p_flags = _read_u32(blob, offset + 4)
            p_offset = _read_u64(blob, offset + 8)
            p_vaddr = _read_u64(blob, offset + 16)
            p_paddr = _read_u64(blob, offset + 24)
            p_filesz = _read_u64(blob, offset + 32)
            p_memsz = _read_u64(blob, offset + 40)
            p_align = _read_u64(blob, offset + 48)

        entries.append(
            {
                "type": p_type,
                "offset": p_offset,
                "vaddr": p_vaddr,
                "paddr": p_paddr,
                "filesz": p_filesz,
                "memsz": p_memsz,
                "flags": p_flags,
                "align": p_align,
            }
        )
    return entries


def _read_c_string(blob: bytes, offset: int) -> str:
    end = blob.find(b"\x00", offset)
    if end == -1:
        end = len(blob)
    return blob[offset:end].decode("utf-8", errors="replace")


def _build_initial_stack(
    uc: Uc,
    config: TraceConfig,
    argv0: str,
    auxv: List[Tuple[int, int]],
) -> int:
    word_size = 8 if config.arch_bits == 64 else 4
    sp = config.stack_base + config.stack_size

    def push_bytes(data: bytes) -> int:
        nonlocal sp
        sp -= len(data)
        uc.mem_write(sp, data)
        return sp

    def push_ptr(value: int) -> None:
        nonlocal sp
        sp -= word_size
        masked = value & ((1 << (word_size * 8)) - 1)
        uc.mem_write(sp, masked.to_bytes(word_size, "little", signed=False))

    argv0_bytes = argv0.encode("utf-8") + b"\x00"
    argv0_addr = push_bytes(argv0_bytes)

    push_ptr(0)  # envp terminator
    push_ptr(0)  # argv terminator
    push_ptr(argv0_addr)
    push_ptr(1)  # argc

    for key, value in auxv:
        push_ptr(key)
        push_ptr(value)
    push_ptr(0)
    push_ptr(0)

    sp &= ~(word_size - 1)
    return sp


def trace_elf(code_bytes: bytes, config: TraceConfig, binary_path: Optional[str]) -> Dict[str, object]:
    header = _parse_elf_header(code_bytes)
    if header["machine"] != 3 and header["machine"] != 62:
        raise ValueError("Only x86/x86_64 ELF supported")

    arch_bits = 64 if header["class"] == 64 else 32
    mode = UC_MODE_64 if arch_bits == 64 else UC_MODE_32
    uc = Uc(UC_ARCH_X86, mode)

    entry = header["entry"]
    is_pie = header["type"] == 3  # ET_DYN
    base = config.base if is_pie else 0

    phdrs = _parse_program_headers(code_bytes, header)
    page_size = 0x1000
    interp_path = None
    phdr_vaddr = base + header["phoff"]

    for ph in phdrs:
        if ph["type"] == 3:  # PT_INTERP
            interp_path = _read_c_string(code_bytes, ph["offset"])
        if ph["type"] != 1:  # PT_LOAD
            continue
        seg_start = base + ph["vaddr"]
        seg_end = seg_start + ph["memsz"]
        map_start = seg_start & ~(page_size - 1)
        map_end = _align_up(seg_end, page_size)
        uc.mem_map(map_start, map_end - map_start, UC_PROT_ALL)
        if ph["filesz"] > 0:
            data = code_bytes[ph["offset"] : ph["offset"] + ph["filesz"]]
            uc.mem_write(seg_start, data)

    interp_entry = None
    interp_base = None
    if interp_path:
        if not os.path.isabs(interp_path) and binary_path:
            candidate = os.path.join(os.path.dirname(binary_path), interp_path)
            if os.path.exists(candidate):
                interp_path = candidate
        if os.path.exists(interp_path):
            interp_blob = _load_code(interp_path)
            interp_header = _parse_elf_header(interp_blob)
            interp_phdrs = _parse_program_headers(interp_blob, interp_header)
            interp_base = config.interp_base
            if interp_header["type"] != 3:
                interp_base = 0
            for ph in interp_phdrs:
                if ph["type"] != 1:
                    continue
                seg_start = interp_base + ph["vaddr"]
                seg_end = seg_start + ph["memsz"]
                map_start = seg_start & ~(page_size - 1)
                map_end = _align_up(seg_end, page_size)
                uc.mem_map(map_start, map_end - map_start, UC_PROT_ALL)
                if ph["filesz"] > 0:
                    data = interp_blob[ph["offset"] : ph["offset"] + ph["filesz"]]
                    uc.mem_write(seg_start, data)
            interp_entry = interp_base + interp_header["entry"]

    effective_interp_base = config.interp_base
    if arch_bits == 32 and effective_interp_base > 0xFFFFFFFF:
        effective_interp_base = 0xF7000000

    config = TraceConfig(
        base=base + entry,
        stack_base=config.stack_base,
        stack_size=config.stack_size,
        max_steps=config.max_steps,
        stack_entries=config.stack_entries,
        arch_bits=arch_bits,
        interp_base=effective_interp_base,
        start_interp=config.start_interp,
        stdin_data=config.stdin_data,
        buffer_offset=config.buffer_offset,
        buffer_size=config.buffer_size,
        start_symbol=config.start_symbol,
    )
    if config.arch_bits == 32 and config.stack_base > 0xFFFFFFFF:
        config = TraceConfig(
            base=config.base,
            stack_base=0xBFF00000,
            stack_size=config.stack_size,
            max_steps=config.max_steps,
            stack_entries=config.stack_entries,
            arch_bits=config.arch_bits,
            interp_base=config.interp_base,
            start_interp=config.start_interp,
            stdin_data=config.stdin_data,
            buffer_offset=config.buffer_offset,
            buffer_size=config.buffer_size,
            start_symbol=config.start_symbol,
        )
    _init_stack(uc, config)
    auxv = [
        (3, phdr_vaddr),  # AT_PHDR
        (4, header["phentsize"]),  # AT_PHENT
        (5, header["phnum"]),  # AT_PHNUM
        (6, page_size),  # AT_PAGESZ
        (7, base + entry),  # AT_BASE (placeholder, overwritten below)
        (9, base + entry),  # AT_ENTRY
    ]
    if interp_base is not None:
        auxv = [(k, interp_base if k == 7 else v) for k, v in auxv]
    else:
        auxv = [(k, 0 if k == 7 else v) for k, v in auxv]
    argv0 = binary_path or "a.out"
    sp = _build_initial_stack(uc, config, argv0, auxv)
    if config.arch_bits == 64:
        uc.reg_write(UC_X86_REG_RSP, sp)
    else:
        uc.reg_write(UC_X86_REG_ESP, sp)

    snapshots: List[dict] = []
    step_counter = 0
    error: Optional[str] = None
    pc_reg, sp_reg = _get_pc_sp(config)
    reg_order = _get_reg_order(config)
    word_size = 8 if config.arch_bits == 64 else 4

    def hook_code(uc_engine: Uc, addr: int, size: int, _user_data: object) -> None:
        nonlocal step_counter
        if step_counter >= config.max_steps:
            uc_engine.emu_stop()
            return
        step_counter += 1

        instr_bytes = bytes(uc_engine.mem_read(addr, size)) if size > 0 else b""
        instr_text = _format_instr(instr_bytes, addr, config.arch_bits)

        regs = []
        for idx, (name, reg_id) in enumerate(reg_order):
            value = uc_engine.reg_read(reg_id)
            regs.append({"name": name, "value": hex(value), "pos": idx})

        sp_local = uc_engine.reg_read(sp_reg)
        stack_items: List[dict] = []
        try:
            raw = bytes(
                uc_engine.mem_read(sp_local, config.stack_entries * word_size)
            )
            for i in range(config.stack_entries):
                chunk = raw[i * word_size : (i + 1) * word_size]
                value = int.from_bytes(chunk, byteorder="little", signed=False)
                stack_items.append(
                    {
                        "id": i,
                        "addr": hex(sp_local + i * word_size),
                        "pos": i * word_size,
                        "size": word_size,
                        "value": hex(value),
                    }
                )
        except UcError:
            pass

        snapshots.append(
            {
                "step": step_counter,
                "rip": hex(addr),
                "rsp": hex(sp_local),
                "instr": instr_text,
                "stack": stack_items,
                "registers": regs,
            }
        )

    uc.hook_add(UC_HOOK_CODE, hook_code)

    start_addr = config.base
    if binary_path and config.start_symbol:
        symbol_addr = _resolve_symbol_addr(
            binary_path,
            config.start_symbol,
            base if is_pie else 0,
        )
        if symbol_addr is not None:
            start_addr = symbol_addr
    if config.start_interp and interp_entry is not None:
        start_addr = interp_entry
    try:
        uc.emu_start(start_addr, start_addr + 0x1000)
    except UcError as exc:
        error = str(exc)
        if (
            not config.start_interp
            and interp_entry is not None
            and not snapshots
            and "UC_ERR_FETCH_UNMAPPED" in error
        ):
            try:
                uc.emu_start(interp_entry, interp_entry + 0x1000)
                error = None
            except UcError as exc2:
                error = str(exc2)

    if binary_path and snapshots and shutil.which("addr2line"):
        addr_map = _addr2line_map(
            binary_path,
            [snap["rip"] for snap in snapshots if "rip" in snap],
            base if is_pie else 0,
        )
        for snap in snapshots:
            info = addr_map.get(snap.get("rip"))
            if info:
                snap["file"] = info.get("file")
                snap["line"] = info.get("line")
                snap["func"] = info.get("func")

    return {
        "snapshots": snapshots,
        "meta": {
            "steps": step_counter,
            "error": error,
            "base": hex(base),
            "stack_base": hex(config.stack_base),
            "stack_size": config.stack_size,
            "arch_bits": config.arch_bits,
            "elf_entry": hex(entry),
            "elf_pie": is_pie,
            "elf_interp": interp_path,
            "elf_interp_started": bool(config.start_interp and interp_entry is not None),
            "word_size": word_size,
            "buffer_offset": config.buffer_offset,
            "buffer_size": config.buffer_size,
            "stdin_len": len(config.stdin_data),
        },
    }


def _addr2line_map(
    binary_path: str, addresses: List[str], base_adjust: int
) -> Dict[str, Dict[str, object]]:
    unique = []
    seen = set()
    for addr in addresses:
        if not isinstance(addr, str) or not addr.startswith("0x"):
            continue
        if addr in seen:
            continue
        seen.add(addr)
        unique.append(addr)

    if not unique:
        return {}

    adjusted = []
    for addr in unique:
        value = int(addr, 16) - base_adjust
        if value < 0:
            value = 0
        adjusted.append(f"0x{value:x}")

    try:
        result = subprocess.run(
            ["addr2line", "-e", binary_path, "-f", "-C", "-a", *adjusted],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return {}

    if result.returncode != 0:
        return {}

    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    mapping: Dict[str, Dict[str, object]] = {}
    idx = 0
    for orig_addr in unique:
        if idx + 2 >= len(lines):
            break
        addr_line = lines[idx]
        func_line = lines[idx + 1]
        file_line = lines[idx + 2]
        idx += 3

        file_path = None
        line_no = None
        if file_line != "??:0" and ":" in file_line:
            file_path, line_str = file_line.rsplit(":", 1)
            if line_str.isdigit():
                line_no = int(line_str)

        mapping[orig_addr] = {
            "file": file_path,
            "line": line_no,
            "func": None if func_line == "??" else func_line,
        }

    return mapping


def _resolve_symbol_addr(
    binary_path: str, symbol: str, base_adjust: int
) -> Optional[int]:
    if not shutil.which("nm"):
        return None
    try:
        result = subprocess.run(
            ["nm", "-n", "--defined-only", binary_path],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None
    if result.returncode != 0:
        return None

    for line in result.stdout.splitlines():
        parts = line.strip().split()
        if len(parts) < 3:
            continue
        addr_str, _stype, name = parts[0], parts[1], parts[2]
        if name != symbol:
            continue
        try:
            addr_val = int(addr_str, 16)
        except ValueError:
            continue
        return addr_val + base_adjust
    return None


def _load_code(path: str) -> bytes:
    with open(path, "rb") as handle:
        return handle.read()


def _is_elf(blob: bytes) -> bool:
    return len(blob) >= 4 and blob[:4] == b"\x7fELF"


def trace_binary(code_bytes: bytes, config: TraceConfig, binary_path: Optional[str]) -> Dict[str, object]:
    if _is_elf(code_bytes):
        return trace_elf(code_bytes, config, binary_path)
    return trace_raw(code_bytes, config)


def _main(argv: Optional[Iterable[str]] = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Trace raw/ELF x86 binaries with Unicorn")
    parser.add_argument("--input", required=True, help="Path to raw x86 or ELF binary")
    parser.add_argument("--output", required=True, help="Output JSON file")
    parser.add_argument("--base", default="0x400000", help="Base address")
    parser.add_argument("--stack-base", default="0x7ffffffde000", help="Stack base address")
    parser.add_argument("--stack-size", type=int, default=0x20000, help="Stack size in bytes")
    parser.add_argument("--max-steps", type=int, default=200, help="Max instructions to trace")
    parser.add_argument("--stack-entries", type=int, default=24, help="Stack entries to capture")
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
    args = parser.parse_args(argv)

    code = _load_code(args.input)

    config = TraceConfig(
        base=int(args.base, 16),
        stack_base=int(args.stack_base, 16),
        stack_size=args.stack_size,
        max_steps=args.max_steps,
        stack_entries=args.stack_entries,
        arch_bits=args.arch_bits,
        interp_base=0x70000000 if args.arch_bits == 32 else 0x7f0000000000,
        start_interp=args.start_interp,
        stdin_data=args.stdin.encode("utf-8", errors="ignore"),
        buffer_offset=args.buffer_offset,
        buffer_size=args.buffer_size,
        start_symbol=args.start_symbol,
    )

    trace = trace_binary(code, config, args.input)

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(trace, handle, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
