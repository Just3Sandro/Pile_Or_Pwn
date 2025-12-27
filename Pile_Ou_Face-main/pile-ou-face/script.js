// script.js
// Code exécuté dans le webview (navigateur intégré de VS Code)

(function () {
  const vscode = acquireVsCodeApi();

  const elStatus = document.getElementById('status');
  const elStack = document.getElementById('stack');
  const elRegisters = document.getElementById('registers');
  const elMemoryDump = document.getElementById('memoryDump');
  const elStepLabel = document.getElementById('stepLabel');
  const elStepRange = document.getElementById('stepRange');
  const elInstrLabel = document.getElementById('instrLabel');
  const elFrameContext = document.getElementById('frameContext');
  const elDisasm = document.getElementById('disasm');
  const elBtnPrev = document.getElementById('btnPrev');
  const elBtnNext = document.getElementById('btnNext');
  const elLegend = document.getElementById('stackLegend');
  const elAnnotations = document.getElementById('stackAnnotations');
  const elModeBeginner = document.getElementById('modeBeginner');
  const elModeExpert = document.getElementById('modeExpert');

  /** @type {Array<any>} */
  let snapshots = [];
  let meta = {};
  // Disassembly lines used for the side panel + file highlight.
  let disasmLines = [];
  let currentStep = 1;
  let lastHighlightedLine = null;
  let lastDisasmLine = null;
  let viewMode = 'beginner';

  const ROLE_CONFIG = {
    buffer: { label: 'BUFFER', className: 'role-buffer', tagClass: 'tag-buffer' },
    local: { label: 'LOCAL VAR', className: 'role-local', tagClass: 'tag-local' },
    padding: { label: 'PADDING', className: 'role-padding', tagClass: 'tag-padding' },
    control: { label: 'CONTROL', className: 'role-control', tagClass: 'tag-control' },
    unknown: { label: 'UNKNOWN', className: 'role-unknown', tagClass: 'tag-unknown' }
  };

  // Demander les données à l'extension
  vscode.postMessage({ type: 'ready' });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'init') {
      console.debug("[visualizer] init", {snapshots: msg.snapshots?.length, disasm: msg.meta?.disasm?.length, disasmPath: msg.meta?.disasm_path});
      snapshots = Array.isArray(msg.snapshots) ? msg.snapshots : [];
      meta = msg.meta && typeof msg.meta === 'object' ? msg.meta : {};
      disasmLines = Array.isArray(meta.disasm) ? meta.disasm : [];
      if (!snapshots.length) {
        elStatus.textContent = 'Aucun snapshot à afficher (output.json vide).';
        renderStack([]);
        renderMemoryDump([], {});
        return;
      }
      const saved = vscode.getState();
      if (saved && saved.viewMode) {
        viewMode = saved.viewMode;
      }
      updateModeButtons();
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

    const disasmCount = Array.isArray(disasmLines) ? disasmLines.length : 0;
    elStatus.textContent = `Snapshots: ${snapshots.length} | Disasm: ${disasmCount}`;

    const stackItems = Array.isArray(snap.stack) ? snap.stack : [];
    const registerItems = Array.isArray(snap.registers)
      ? snap.registers
      : Array.isArray(snap.regs)
      ? snap.regs
      : [];
    const regMap = buildRegisterMap(registerItems);
    renderStack(stackItems, regMap, snap);
    renderRegisters(registerItems);
    renderMemoryDump(stackItems, regMap);
    renderFrameContext(snap, regMap);
    renderDisasm(snap.rip ?? null);
    highlightDisasmFile(snap.rip ?? null);
  }

  /**
   * Affiche la pile.
   * stackItems: [{ id, pos, size, value }, ...]
   */
  // Render stack words with SP/BP/buffer highlights.
  function renderStack(stackItems, regMap = {}, snap = {}) {
    elStack.innerHTML = '';
    renderLegend();
    renderAnnotations(snap, regMap);

    if (!Array.isArray(stackItems) || stackItems.length === 0) {
      elStack.innerHTML = '<div class="status">Pile vide à cette étape.</div>';
      return;
    }

    const rsp = regMap.rsp ?? regMap.esp ?? null;
    const rbp = regMap.rbp ?? regMap.ebp ?? null;
    const wordSize =
      typeof meta.word_size === 'number'
        ? meta.word_size
        : regMap.eax !== undefined
        ? 4
        : 8;
    const bufferOffset = typeof meta.buffer_offset === 'number' ? meta.buffer_offset : null;
    const bufferSize = typeof meta.buffer_size === 'number' ? meta.buffer_size : 0;
    const bufferStart = rbp !== null && bufferOffset !== null ? rbp + bufferOffset : null;
    const bufferEnd =
      bufferStart !== null && bufferSize > 0 ? bufferStart + bufferSize : null;

    const axis = document.createElement('div');
    axis.className = 'stack-axis';
    axis.innerHTML = `<span class="stack-axis-label">${buildAxisLabel(rbp)}</span>`;
    elStack.appendChild(axis);

    // On veut typiquement le TOP de la pile en haut → on parcourt du dernier au premier
    const sorted = [...stackItems].sort((a, b) => {
      const offsetA = typeof a.pos === 'number' ? a.pos : a.posi ?? 0;
      const offsetB = typeof b.pos === 'number' ? b.pos : b.posi ?? 0;
      return offsetB - offsetA;
    });

    sorted.forEach((item, index) => {
      const div = document.createElement('div');
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
      }

      const role = resolveRole(item, addr, rbp, wordSize, bufferStart, bufferEnd);
      const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.unknown;
      div.className = `block ${roleConfig.className}`;

      const addrLabel = addr !== null ? toHex(addr) : '??';
      const posValue = item.pos ?? item.posi ?? null;
      const displayName = item.label ?? item.name ?? (item.id !== undefined ? `#${item.id}` : '#?');
      const offsets = buildOffsets(item, addr, rsp, rbp, posValue);
      const note = item.note ?? item.hint ?? item.help;
      const offsetsHtml = offsets.length
        ? offsets.map((o) => `<div class="block-offset ${o.primary ? 'primary' : ''}">${o.text}</div>`).join('')
        : `<div class="block-offset primary">Offset non fourni</div>`;
      const tagHtml = tags.length
        ? `<span class="block-tags">${tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}</span>`
        : '';

      div.innerHTML = `
        <div class="block-header">
          <span class="block-title">${displayName}</span>
          <span class="block-tag ${roleConfig.tagClass}">${roleConfig.label}</span>
        </div>
        <div class="block-body">
          <div class="block-value">${item.value ?? '??'}</div>
          <div class="block-meta">
            ${offsetsHtml}
            ${viewMode === 'expert' ? `<div class="block-offset">Taille: ${item.size ?? 0} bytes</div>` : ''}
          </div>
        </div>
        ${note ? `<div class="block-note">${note}</div>` : ''}
        <div class="block-footer">
          <span class="block-addr">${viewMode === 'expert' ? `addr ${addrLabel}` : ''}</span>
          ${tagHtml}
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

  function resolveRole(item, addr, rbp, wordSize, bufferStart, bufferEnd) {
    const raw = (item.role ?? item.kind ?? item.zone ?? item.type ?? '').toString().toLowerCase();
    if (raw) {
      if (raw.includes('buffer')) return 'buffer';
      if (raw.includes('local')) return 'local';
      if (raw.includes('padding') || raw.includes('pad')) return 'padding';
      if (raw.includes('control') || raw.includes('ret') || raw.includes('saved')) return 'control';
    }

    const name = (item.name ?? item.label ?? '').toString().toLowerCase();
    if (name.includes('buffer') || name.includes('buf')) return 'buffer';
    if (name.includes('padding') || name.includes('pad') || name.includes('align')) return 'padding';
    if (name.includes('ret') || name.includes('saved') || name.includes('ebp') || name.includes('rbp')) return 'control';
    if (name.includes('var') || name.includes('local')) return 'local';

    if (
      addr !== null &&
      bufferStart !== null &&
      bufferEnd !== null &&
      addr >= bufferStart &&
      addr < bufferEnd
    ) {
      return 'buffer';
    }

    if (addr !== null && rbp !== null && wordSize) {
      if (addr >= rbp && addr < rbp + wordSize * 2) {
        return 'control';
      }
      if (addr < rbp) {
        return 'local';
      }
    }

    return 'unknown';
  }

  function buildOffsets(item, addr, rsp, rbp, posValue) {
    const offsets = [];
    if (addr !== null && rbp !== null) {
      offsets.push({ text: `RBP ${formatSignedHex(addr - rbp)}`, primary: true });
    }

    if (viewMode === 'expert') {
      if (addr !== null && rsp !== null) {
        offsets.push({ text: `SP + ${formatHex(addr - rsp)}`, primary: false });
      } else if (typeof posValue === 'number') {
        offsets.push({ text: `SP + ${formatHex(posValue)}`, primary: false });
      }
    } else if (offsets.length === 0 && typeof posValue === 'number') {
      offsets.push({ text: `SP + ${formatHex(posValue)}`, primary: true });
    }

    return offsets;
  }

  function buildAxisLabel(rbp) {
    if (rbp !== null) {
      return `RBP (repere fixe) = ${toHex(rbp)}`;
    }
    return 'RBP (repere fixe)';
  }

  function renderLegend() {
    if (!elLegend) return;
    elLegend.innerHTML = '';
    Object.values(ROLE_CONFIG).forEach((cfg) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-swatch ${cfg.tagClass}"></span>
        <span>${cfg.label}</span>
      `;
      elLegend.appendChild(item);
    });
  }

  function renderAnnotations(snap, regMap) {
    if (!elAnnotations) return;
    const annotations = Array.isArray(snap.annotations) ? [...snap.annotations] : [];

    const rbp = regMap?.rbp ?? regMap?.ebp ?? null;
    if (rbp !== null && typeof meta.buffer_offset === 'number') {
      annotations.push({
        label: 'Buffer (debut)',
        detail: `buffer = RBP ${formatSignedHex(meta.buffer_offset)}`
      });
    }

    if (!annotations.length) {
      elAnnotations.innerHTML = '';
      return;
    }

    elAnnotations.innerHTML = '';
    annotations.forEach((anno) => {
      const div = document.createElement('div');
      div.className = 'stack-annotation';
      const label = anno.label ?? anno.title ?? 'Annotation';
      const detail = anno.detail ?? anno.text ?? '';
      div.innerHTML = `<strong>${label}</strong>${detail ? ` — ${detail}` : ''}`;
      elAnnotations.appendChild(div);
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

  function formatHex(value) {
    const abs = Math.abs(Math.trunc(value));
    return `0x${abs.toString(16)}`;
  }

  function formatSignedHex(value) {
    if (value === 0) return '+0x0';
    const sign = value < 0 ? '-' : '+';
    const abs = Math.abs(Math.trunc(value));
    return `${sign}0x${abs.toString(16)}`;
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

  function setMode(mode) {
    viewMode = mode;
    vscode.setState({ viewMode });
    updateModeButtons();
    updateUI();
  }

  function updateModeButtons() {
    if (!elModeBeginner || !elModeExpert) return;
    elModeBeginner.classList.toggle('is-active', viewMode === 'beginner');
    elModeExpert.classList.toggle('is-active', viewMode === 'expert');
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

  if (elModeBeginner && elModeExpert) {
    elModeBeginner.addEventListener('click', () => setMode('beginner'));
    elModeExpert.addEventListener('click', () => setMode('expert'));
  }
})();
