# 🧠 Pile‑ou‑Face
Interactive Stack Visualization for Low‑Level Programming

Make the stack visible, understandable, and interactive.

---

## 🚀 Overview
Pile‑ou‑Face is a teaching tool designed to help developers (students, beginners in assembly, or people learning reverse engineering and binary exploitation) visualize and understand stack behavior, CPU registers, and instruction‑by‑instruction execution.

The goal is to turn abstract concepts—where RSP points, how return addresses are stored, how overflows overwrite RIP—into clear, visual representations.

---

## Table of Contents
- [Why this project?](#why-this-project)
- [Architecture](#architecture)
  - [Pluggable Analysis Backends](#pluggable-analysis-backends)
  - [Unified JSON Trace Format](#unified-json-trace-format)
  - [Frontend — VS Code Extension](#frontend---vs-code-extension)
- [Features](#features)
- [Pwn / Educational Use Cases](#pwn--educational-use-cases)
- [Technologies](#technologies)
- [Quick Start](#quick-start)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License & Contact](#license--contact)

---

## ❓ Why this project?
- The stack is fundamental but usually invisible.
- Existing tools (GDB, pwndbg, gef) are powerful but can be intimidating for beginners.
- Pile‑ou‑Face provides a beginner‑friendly, visual way to understand *why* code behaves the way it does, not just *that* it does.

---

## 🏗️ Architecture
The project is modular and extensible: execution engines (backends) are decoupled from the visualization frontend.

### 1) Pluggable Analysis Backends
- ASM Simulation (C)
  - Parses `.asm` files
  - Simulates instructions (`push`, `pop`, `add`, `call`, `ret`, ...)
  - Produces step‑by‑step stack snapshots
- Real Execution Emulation (Python + Unicorn)
  - Emulates an x86_64 CPU
  - Runs real machine code
  - Captures registers and stack memory, hooks instructions one‑by‑one
  - Emits faithful JSON execution traces
- Static Analysis (AST — optional)
  - Parses source (C / Python)
  - Detects risky/interesting patterns
  - Provides context for dynamic traces

### 2) Unified JSON Trace Format
All backends output a common JSON format consumed by the frontend. Example step:

```json
{
  "step": 12,
  "rip": "0x40102a",
  "rsp": "0x7fffffffdc30",
  "instr": "push rax",
  "line": 42,
  "stack": [
    {
      "addr": "0x7fffffffdc28",
      "value": "0x41414141",
      "kind": "imm"
    }
  ],
  "registers": {
    "rax": "0x0",
    "rsi": "0x7fffffffdc40"
  }
}
```

The frontend is backend‑agnostic — any engine that emits this JSON can be plugged in.

### 3) Frontend — VS Code Extension
- Implemented as a VS Code Webview
- Displays:
  - Graphical stack view
  - CPU registers
  - Current instruction and highlighted ASM/source line
- Navigation:
  - Step forward / backward
  - Timeline slider
  - Live JSON reload

---

## 🎨 Features
- Graphical visualization of the stack (addresses, values, origins)
- CPU registers display (RIP, RSP, RBP, etc.)
- Instruction and source line highlighting
- Step‑by‑step execution navigation
- Color coding by value origin (immediate, register, operation result)
- Live reload of traces (Reload JSON)
- Clear visualization of stack overflows and corrupted return addresses

---

## 🎯 Pwn / Educational Use Cases
Great for learning and demonstrating:
- Buffer overflows (stack smashing)
- Stack frame layout (saved RBP, return address)
- Calling conventions (SysV AMD64)
- Offset reasoning for exploits (e.g., Protostar Stack0 → Stack4)
- How overwriting the return address affects RIP

Pile‑ou‑Face surfaces the same data GDB shows but in a more approachable, visual way.

---

## 🧪 Technologies
- C — ASM simulation backend
- Python — orchestration & tracing
- Unicorn Engine — CPU emulation
- AST (Python) — static analysis (optional)
- JavaScript / HTML / CSS — frontend (Webview)
- VS Code Extension API

---

## ⚙️ Quick Start (example)
1. Clone the repo:
   - git clone https://github.com/Just3Sandro/Pile_Ou_Face.git
2. Install Python deps (venv recommended):
   - python3 -m venv .venv && source .venv/bin/activate
   - pip install -r requirements.txt
3. Build C backend (if needed):
   - cd backend/asm_sim && make
4. Produce a trace JSON:
   - python tools/run_emulation.py --input <binary_or_asm> --output trace.json
5. Open the project in VS Code, run the extension or load the Webview, and open `trace.json`.

Add examples to `examples/` for quick demos.

---

## 🛣️ Roadmap
Planned improvements:
- Minimal ELF loader
- Symbol resolution (function names)
- Automatic return address detection
- ROP / gadget visualization
- GDB (MI) integration
- Additional architectures (ARM, MIPS)

---

## 🤝 Contributing
Contributions welcome:
- New backends or architectures
- UI / UX improvements
- Example cases and tutorials
- Documentation and tests

Suggested workflow:
- Open an issue to discuss major changes
- Create a feature/bugfix branch
- Submit a PR with a clear description

---

## 🧠 Final Note
Pile‑ou‑Face is about making memory behavior visible. If it helps someone "see" the stack for the first time, it's already successful.

---

## 📄 License & Contact
License: (add the project's license, e.g. MIT)  
Author / Contact: Just3Sandro (see the GitHub repository)
