// script.js
// Code exécuté dans le webview (navigateur intégré de VS Code)

(function () {
  const vscode = acquireVsCodeApi();

  const elStatus = document.getElementById('status');
  const elStack = document.getElementById('stack');
  const elRegisters = document.getElementById('registers');
  const elRisks = document.getElementById('risks');
  const elMemoryDump = document.getElementById('memoryDump');
  const elStepLabel = document.getElementById('stepLabel');
  const elStepRange = document.getElementById('stepRange');
  const elInstrLabel = document.getElementById('instrLabel');
  const elCodeContext = document.getElementById('codeContext');
  const elFrameContext = document.getElementById('frameContext');
  const elAsmContext = document.getElementById('asmContext');
  const elDisasm = document.getElementById('disasm');
  const elBtnPrev = document.getElementById('btnPrev');
  const elBtnNext = document.getElementById('btnNext');

  /** @type {Array<any>} */
  let snapshots = [];
  /** @type {Array<any>} */
  let risks = [];
  let meta = {};
  // Disassembly lines used for the side panel + file highlight.
  let disasmLines = [];
  let currentStep = 1;
  let lastHighlightedLine = null;
  let lastDisasmLine = null;

  // Demander les données à l'extension
  vscode.postMessage({ type: 'ready' });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'init') {
      console.debug("[visualizer] init", {snapshots: msg.snapshots?.length, disasm: msg.meta?.disasm?.length, disasmPath: msg.meta?.disasm_path});
      snapshots = Array.isArray(msg.snapshots) ? msg.snapshots : [];
      risks = Array.isArray(msg.risks) ? msg.risks : [];
      meta = msg.meta && typeof msg.meta === 'object' ? msg.meta : {};
      disasmLines = Array.isArray(meta.disasm) ? meta.disasm : [];
      if (!snapshots.length) {
        elStatus.textContent = 'Aucun snapshot à afficher (output.json vide).';
        renderStack([]);
        renderRisks([], null);
        renderMemoryDump([], {});
        return;
      }
      currentStep = 1;
      elStepRange.min = 1;
      elStepRange.max = snapshots.length;
      elStepRange.value = currentStep;
      updateUI();
    }
  });

  function clampStep(step) {
    if (!snapshots.length) return 1;
    if (step < 1) return 1;
    if (step > snapshots.length) return snapshots.length;
    return step;
  }

  // Refresh all panels for the current step.
  function updateUI() {
    if (!snapshots.length) {
      elStatus.textContent = 'Aucune donnée.';
      elStepLabel.textContent = '0';
      elInstrLabel.textContent = '(aucune)';
      renderStack([]);
      renderRisks([], null);
      renderMemoryDump([], {});
      renderDisasm(null);
      return;
    }

    const snap = snapshots[currentStep - 1];
    elStepLabel.textContent = String(currentStep);
    elStepRange.value = currentStep;

    if (snap.instr) {
      if (snap.line !== undefined) {
        elInstrLabel.textContent = `${snap.instr} (ligne ${snap.line})`;
      } else {
        elInstrLabel.textContent = snap.instr;
      }
    } else {
      elInstrLabel.textContent = '(instr inconnue)';
    }

    const line = typeof snap.line === 'number' ? snap.line : null;

    const riskCount = Array.isArray(risks) ? risks.length : 0;
    const disasmCount = Array.isArray(disasmLines) ? disasmLines.length : 0;
    elStatus.textContent = `Snapshots: ${snapshots.length} | Risques: ${riskCount} | Disasm: ${disasmCount}`;

    const stackItems = Array.isArray(snap.stack) ? snap.stack : [];
    const registerItems = Array.isArray(snap.registers)
      ? snap.registers
      : Array.isArray(snap.regs)
      ? snap.regs
      : [];
    const regMap = buildRegisterMap(registerItems);
    renderStack(stackItems, regMap);
    renderRegisters(registerItems);
    renderRisks(risks, line);
    renderMemoryDump(stackItems, regMap);
    renderContext(snap);
    renderFrameContext(snap, regMap);
    renderDisasm(snap.rip ?? null);
    highlightDisasmFile(snap.rip ?? null);
  }

  /**
   * Affiche la pile.
   * stackItems: [{ id, pos, size, value }, ...]
   */
  // Render stack words with SP/BP/buffer highlights.
  function renderStack(stackItems, regMap) {
    elStack.innerHTML = '';

    if (!Array.isArray(stackItems) || stackItems.length === 0) {
      elStack.innerHTML = '<div class="status">Pile vide à cette étape.</div>';
      return;
    }

    const rsp = regMap.rsp ?? regMap.esp ?? null;
    const rbp = regMap.rbp ?? regMap.ebp ?? null;
    const bufferOffset = typeof meta.buffer_offset === 'number' ? meta.buffer_offset : null;
    const bufferSize = typeof meta.buffer_size === 'number' ? meta.buffer_size : 0;
    const bufferStart = rbp !== null && bufferOffset !== null ? rbp + bufferOffset : null;
    const bufferEnd =
      bufferStart !== null && bufferSize > 0 ? bufferStart + bufferSize : null;

    // On veut typiquement le TOP de la pile en haut → on parcourt du dernier au premier
    const sorted = [...stackItems].sort((a, b) => {
      const offsetA = typeof a.pos === 'number' ? a.pos : a.posi ?? 0;
      const offsetB = typeof b.pos === 'number' ? b.pos : b.posi ?? 0;
      return offsetB - offsetA;
    });

    sorted.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'block';

      const addr = resolveStackAddress(item, rsp);
      const tags = [];
      if (addr !== null && rsp !== null && addr === rsp) {
        tags.push('SP');
      }
      if (addr !== null && rbp !== null && addr === rbp) {
        tags.push('BP');
      }
      if (
        addr !== null &&
        bufferStart !== null &&
        bufferEnd !== null &&
        addr >= bufferStart &&
        addr < bufferEnd
      ) {
        tags.push('BUF');
        div.classList.add('block-buffer');
      }

      const hue = (index * 137.508) % 360;
      div.style.backgroundColor = `hsl(${hue}, 40%, 30%)`;

      const addrLabel = addr !== null ? toHex(addr) : '??';
      const posValue = item.pos ?? item.posi ?? '?';
      const posLabel = typeof posValue === 'number' ? `sp+${posValue}` : posValue;
      const rbpOffset =
        addr !== null && rbp !== null ? formatOffset(addr - rbp) : null;

      div.innerHTML = `
        <div class="block-header">
          <span class="block-title">#${item.id ?? item.name ?? '?'} (${posLabel})</span>
          <span class="block-tags">${tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}</span>
        </div>
        <div class="block-body">
          <div class="block-value">${item.value ?? '??'}</div>
          <div class="block-meta">${item.size ?? 0} bytes</div>
        </div>
        <div class="block-footer">
          <span class="block-addr">addr ${addrLabel}</span>
          <span class="block-offset">${rbpOffset ? `rbp${rbpOffset}` : ''}</span>
        </div>
      `;

      // petite animation d'apparition
      setTimeout(() => {
        div.classList.add('visible');
      }, 60 * index);

      elStack.appendChild(div);
    });
  }

  // Render register list sorted by index.
  function renderRegisters(registerItems) {
    if (!elRegisters) return;
    elRegisters.innerHTML = '';

    if (!Array.isArray(registerItems) || registerItems.length === 0) {
      elRegisters.innerHTML = '<div class="status">Aucun registre pour cette étape.</div>';
      return;
    }

    const sorted = [...registerItems].sort((a, b) => {
      const offsetA = typeof a.pos === 'number' ? a.pos : a.posi ?? 0;
      const offsetB = typeof b.pos === 'number' ? b.pos : b.posi ?? 0;
      return offsetA - offsetB;
    });

    sorted.forEach((reg) => {
      const row = document.createElement('div');
      row.className = 'register';

      row.innerHTML = `
        <span class="register-name">${reg.name ?? '?'}</span>
        <span class="register-value">${reg.value ?? '??'}</span>
      `;

      elRegisters.appendChild(row);
    });
  }

  // Build a hex+ASCII dump starting at SP.
  function renderMemoryDump(stackItems, regMap) {
    if (!elMemoryDump) return;
    elMemoryDump.textContent = '';

    if (!Array.isArray(stackItems) || stackItems.length === 0) {
      elMemoryDump.textContent = '(no data)';
      return;
    }

    const rsp = regMap.rsp ?? regMap.esp ?? null;
    const wordSize =
      typeof meta.word_size === 'number'
        ? meta.word_size
        : regMap.eax !== undefined
        ? 4
        : 8;

    const items = stackItems
      .map((item) => {
        const addr = resolveStackAddress(item, rsp);
        return {
          addr,
          bytes: toBytes(item.value, wordSize)
        };
      })
      .filter((item) => item.addr !== null)
      .sort((a, b) => a.addr - b.addr);

    if (!items.length) {
      elMemoryDump.textContent = '(no data)';
      return;
    }

    const startAddr = items[0].addr;
    const bytes = [];
    items.forEach((item) => {
      bytes.push(...item.bytes);
    });

    const lines = [];
    const lineSize = 16;
    for (let i = 0; i < bytes.length; i += lineSize) {
      const slice = bytes.slice(i, i + lineSize);
      const addr = startAddr + i;
      const hexBytes = slice.map((b) => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = slice
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');
      lines.push(`${toHex(addr)}: ${hexBytes.padEnd(47, ' ')} |${ascii}|`);
    }

    elMemoryDump.textContent = lines.join('\n');
  }



  // Render a small window of disassembly around RIP.

// Summarize SP/BP and explain how the current instruction affects the stack.
  function renderFrameContext(snap, regMap) {
    if (!elFrameContext) return;
    const rsp = regMap.rsp ?? regMap.esp ?? null;
    const rbp = regMap.rbp ?? regMap.ebp ?? null;
    const instr = typeof snap.instr === 'string' ? snap.instr : '';

    if (rsp === null && rbp === null) {
      elFrameContext.textContent = 'Aucun registre SP/BP disponible.';
      return;
    }

    const spLabel = rsp !== null ? `SP=${toHex(rsp)}` : '';
    const bpLabel = rbp !== null ? `BP=${toHex(rbp)}` : '';
    const effect = explainStackEffect(instr);
    const parts = [spLabel, bpLabel].filter(Boolean).join(' • ');
    elFrameContext.textContent = parts ? `${parts} • ${effect}` : effect;
  }

// Simple heuristics for stack-related instructions (generic, no C-specific logic).
  function explainStackEffect(instr) {
    if (!instr) return 'Instruction courante inconnue.';
    const text = instr.trim();
    const lower = text.toLowerCase();
    const mnemonic = lower.split(/\s+/)[0];

    if (mnemonic === 'push') {
      return 'push: réserve 4/8 octets et écrit une valeur sur la pile.';
    }
    if (mnemonic === 'pop') {
      return 'pop: lit une valeur sur la pile puis libère 4/8 octets.';
    }
    if (mnemonic === 'call') {
      return 'call: empile l’adresse de retour puis saute à la fonction.';
    }
    if (mnemonic === 'ret') {
      return 'ret: dépile l’adresse de retour et saute.';
    }
    if (mnemonic === 'leave') {
      return 'leave: remet SP sur BP puis dépile l’ancien BP.';
    }
    if (mnemonic === 'sub' && lower.includes('sp')) {
      return 'sub sp, X: réserve X octets pour les variables locales.';
    }
    if (mnemonic === 'add' && lower.includes('sp')) {
      return 'add sp, X: libère X octets (fin de frame ou nettoyage arguments).';
    }
    if (mnemonic === 'mov' && (lower.includes('sp') || lower.includes('bp'))) {
      return 'mov sp/bp: ajuste les pointeurs de frame (prologue/épilogue).';
    }

    return 'Aucun effet direct sur la pile détecté.';
  }


// Jump to the disasm file and highlight the current instruction line.
  function highlightDisasmFile(rip) {
    if (!meta.disasm_path || !Array.isArray(disasmLines) || disasmLines.length === 0) {
      return;
    }
    if (typeof rip !== 'string') return;
    const target = rip.toLowerCase();
    const entry = disasmLines.find((line) => line.addr && line.addr.toLowerCase() === target);
    if (!entry || typeof entry.line !== 'number') return;

    if (lastDisasmLine === entry.line) return;
    lastDisasmLine = entry.line;

    vscode.postMessage({
      type: 'goToLine',
      line: entry.line,
      file: meta.disasm_path
    });
  }


// Render the disassembly window around the current RIP.
  function renderDisasm(rip) {
    if (!elDisasm) return;
    elDisasm.innerHTML = '';

    if (!Array.isArray(disasmLines) || disasmLines.length === 0) {
      elDisasm.innerHTML = '<div class="status">Aucun désassemblage (disasm=0).</div>';
      return;
    }

    const ripAddr = typeof rip === 'string' ? rip.toLowerCase() : null;
    let currentIndex = -1;
    if (ripAddr) {
      currentIndex = disasmLines.findIndex(
        (line) => line.addr && line.addr.toLowerCase() === ripAddr
      );
    }

    const windowSize = 18;
    const start = Math.max(0, currentIndex - windowSize);
    const end = Math.min(disasmLines.length, currentIndex + windowSize + 1);
    const slice =
      currentIndex === -1 ? disasmLines.slice(0, 40) : disasmLines.slice(start, end);

    if (!slice.length) {
      elDisasm.innerHTML = `<div class="status">Désassemblage vide.</div>`;
      return;
    }

    slice.forEach((line) => {
      const row = document.createElement('div');
      row.className = 'disasm-line';
      if (ripAddr && line.addr && line.addr.toLowerCase() === ripAddr) {
        row.classList.add('disasm-current');
      }
      row.innerHTML = `
        <span class="disasm-addr">${line.addr ?? '??'}</span>
        <span class="disasm-text">${line.text ?? ''}</span>
      `;
      elDisasm.appendChild(row);
    });
  }

  function renderContext(snap) {
    if (!elCodeContext) return;

    const file = snap.file;
    const line = typeof snap.line === 'number' ? snap.line : null;
    const func = snap.func;
    if (!file || line === null) {
      elCodeContext.textContent = 'Aucune info de debug (compile avec -g).';
    } else {
      const funcLabel = func ? ` • ${func}()` : '';
      elCodeContext.textContent = `${file}:${line}${funcLabel}`;
    }

    if (elAsmContext) {
      elAsmContext.textContent = explainInstruction(snap.instr);
    }
  }


  // Map a mnemonic to a short explanation.
  function explainInstruction(instr) {
    if (!instr || typeof instr !== 'string') {
      return 'Aucune instruction.';
    }
    const text = instr.trim();
    const mnemonic = text.split(/\\s+/)[0].toLowerCase();
    const hasMem = text.includes('[') && text.includes(']');
    let detail = '';

    switch (mnemonic) {
      case 'mov':
        detail = 'Copie la valeur source vers la destination.';
        break;
      case 'lea':
        detail = 'Calcule une adresse effective et la charge.';
        break;
      case 'push':
        detail = 'Empile la valeur (SP diminue).';
        break;
      case 'pop':
        detail = 'Dépile la valeur (SP augmente).';
        break;
      case 'call':
        detail = 'Appel de fonction (push retour + saut).';
        break;
      case 'ret':
        detail = 'Retour de fonction (pop vers IP).';
        break;
      case 'jmp':
        detail = 'Saut inconditionnel.';
        break;
      case 'je':
      case 'jz':
        detail = 'Saut si égal / zéro.';
        break;
      case 'jne':
      case 'jnz':
        detail = 'Saut si différent.';
        break;
      case 'jg':
      case 'jge':
      case 'jl':
      case 'jle':
        detail = 'Saut conditionnel selon le résultat de la comparaison.';
        break;
      case 'cmp':
        detail = 'Compare deux valeurs (met à jour les flags).';
        break;
      case 'test':
        detail = 'ET logique pour mettre à jour les flags.';
        break;
      case 'add':
        detail = 'Addition.';
        break;
      case 'sub':
        detail = 'Soustraction.';
        break;
      case 'imul':
      case 'mul':
        detail = 'Multiplication.';
        break;
      case 'idiv':
      case 'div':
        detail = 'Division.';
        break;
      case 'xor':
        detail = 'XOR (souvent pour mettre un registre à zéro).';
        break;
      case 'and':
        detail = 'ET logique.';
        break;
      case 'or':
        detail = 'OU logique.';
        break;
      case 'inc':
        detail = 'Incrémente.';
        break;
      case 'dec':
        detail = 'Décrémente.';
        break;
      case 'leave':
        detail = 'Termine un frame (mov sp, bp ; pop bp).';
        break;
      case 'nop':
        detail = 'Aucune opération.';
        break;
      default:
        detail = 'Instruction non annotée.';
        break;
    }

    const memNote = hasMem ? ' Accès mémoire.' : '';
    return `${text} — ${detail}${memNote}`;
  }

  // Convert register array to a name->value map.
  function buildRegisterMap(registerItems) {
    const map = {};
    registerItems.forEach((reg) => {
      if (!reg || !reg.name) return;
      const value = parseHex(reg.value);
      if (value !== null) {
        map[reg.name.toLowerCase()] = value;
      }
    });
    return map;
  }

  function parseHex(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value !== 'string') return null;
    if (value.startsWith('0x')) {
      const parsed = parseInt(value, 16);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Resolve absolute address for a stack slot.
  function resolveStackAddress(item, rsp) {
    if (typeof item.addr === 'string' && item.addr.startsWith('0x')) {
      const parsed = parseInt(item.addr, 16);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof item.addr === 'number') {
      return item.addr;
    }
    const pos = typeof item.pos === 'number' ? item.pos : item.posi ?? null;
    if (rsp !== null && pos !== null) {
      return rsp + pos;
    }
    return null;
  }

  function toHex(value) {
    return `0x${value.toString(16)}`;
  }

  function formatOffset(offset) {
    if (offset === 0) return '+0';
    const sign = offset < 0 ? '-' : '+';
    const abs = Math.abs(offset);
    return `${sign}0x${abs.toString(16)}`;
  }

  function toBytes(value, wordSize) {
    let bigValue = 0n;
    if (typeof value === 'string' && value.startsWith('0x')) {
      bigValue = BigInt(value);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      bigValue = BigInt(value);
    } else if (value !== null && value !== undefined) {
      try {
        bigValue = BigInt(value);
      } catch (err) {
        bigValue = 0n;
      }
    }

    const bytes = [];
    const masked = BigInt.asUintN(wordSize * 8, bigValue);
    for (let i = 0; i < wordSize; i++) {
      const shift = BigInt(i * 8);
      const byte = Number((masked >> shift) & 0xffn);
      bytes.push(byte);
    }
    return bytes;
  }

  function renderRisks(riskItems, activeLine) {
    if (!elRisks) return;
    elRisks.innerHTML = '';

    if (!Array.isArray(riskItems) || riskItems.length === 0) {
      elRisks.innerHTML = '<div class=\"status\">Aucun risque détecté.</div>';
      return;
    }

    riskItems.forEach((risk) => {
      const line = typeof risk.line === 'number' ? risk.line : null;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `risk risk-${risk.severity ?? 'low'}`;
      if (line !== null && activeLine === line) {
        row.classList.add('risk-active');
      }

      const fileLabel = risk.file ? ` • ${risk.file}` : '';
      const lineLabel = line !== null ? `L${line}` : 'L?';
      row.textContent = `${lineLabel} ${risk.kind ?? 'risk'}${fileLabel} — ${risk.message ?? ''}`;


      elRisks.appendChild(row);
    });
  }

  // Listeners contrôle

  elBtnPrev.addEventListener('click', () => {
    currentStep = clampStep(currentStep - 1);
    updateUI();
  });

  elBtnNext.addEventListener('click', () => {
    currentStep = clampStep(currentStep + 1);
    updateUI();
  });

  elStepRange.addEventListener('input', () => {
    const val = parseInt(elStepRange.value, 10);
    currentStep = clampStep(val);
    updateUI();
  });
})();
