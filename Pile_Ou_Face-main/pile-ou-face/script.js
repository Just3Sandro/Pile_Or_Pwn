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
  const elToggleIntent = document.getElementById('toggleIntent');
  const elToggleReasoning = document.getElementById('toggleReasoning');
  const elReasoningPanel = document.getElementById('reasoningPanel');
  const elReasoningBody = document.getElementById('reasoningBody');

  /** @type {Array<any>} */
  let snapshots = [];
  let meta = {};
  // Disassembly lines used for the side panel + file highlight.
  let disasmLines = [];
  let currentStep = 1;
  let lastHighlightedLine = null;
  let lastDisasmLine = null;
  let viewMode = 'beginner';
  // Intent overlay désactivé (commenté).
  let showIntentOverlay = false;
  let showReasoningPanel = true;
  let frozenReasoningData = null;

  const ROLE_CONFIG = {
    buffer: { label: 'BUFFER', className: 'role-buffer', tagClass: 'tag-buffer' },
    local: { label: 'LOCAL VAR', className: 'role-local', tagClass: 'tag-local' },
    padding: { label: 'PADDING', className: 'role-padding', tagClass: 'tag-padding' },
    control: { label: 'CONTROL', className: 'role-control', tagClass: 'tag-control' },
    unknown: { label: 'UNKNOWN', className: 'role-unknown', tagClass: 'tag-unknown' }
  };

  const ROLE_TOOLTIPS = {
    buffer: "Zone d'écriture (buffer local).",
    local: "Variable locale (RBP - offset).",
    padding: "Espace réservé par le compilateur (alignement / temporaires).",
    control: "Flux de contrôle (saved EBP / RET).",
    unknown: "Zone non classée."
  };

  const MARKER_VALUES = new Set([0x41414141, 0x42424242, 0x43434343, 0x44444444]);

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
      /*
      if (saved && typeof saved.showIntentOverlay === 'boolean') {
        showIntentOverlay = saved.showIntentOverlay;
      } else {
        showIntentOverlay = viewMode === 'beginner';
      }
      */
      if (saved && typeof saved.showReasoningPanel === 'boolean') {
        showReasoningPanel = saved.showReasoningPanel;
      }
      frozenReasoningData = buildFrozenReasoningData();
      updateModeButtons();
      // updateIntentButton();
      updateReasoningButton();
      updateReasoningVisibility();
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
    renderReasoningPanel(stackItems, regMap, snap);
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
    const intent = showIntentOverlay ? buildIntentOverlay(stackItems, regMap, snap) : null;
    renderAnnotations(snap, regMap, intent);

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

    // On veut typiquement le TOP de la pile en haut → on parcourt du dernier au premier
    const sorted = [...stackItems].sort((a, b) => {
      const offsetA = typeof a.pos === 'number' ? a.pos : a.posi ?? 0;
      const offsetB = typeof b.pos === 'number' ? b.pos : b.posi ?? 0;
      return offsetB - offsetA;
    });

    const addrRange = getStackAddrRange(sorted, rsp);
    axis.innerHTML = `<span class="stack-axis-label">${buildAxisLabel(rbp, addrRange)}</span>`;

    let axisInserted = false;
    if (rbp === null) {
      elStack.appendChild(axis);
      axisInserted = true;
    }

    sorted.forEach((item, index) => {
      const div = document.createElement('div');
      const addr = resolveStackAddress(item, rsp);
      if (!axisInserted && rbp !== null && addr !== null && addr < rbp) {
        elStack.appendChild(axis);
        axisInserted = true;
      }
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
      div.title = ROLE_TOOLTIPS[role] || '';

      const addrLabel = addr !== null ? toHex(addr) : '??';
      if (addr !== null) {
        div.dataset.addr = addrLabel;
      }
      const posValue = item.pos ?? item.posi ?? null;
      const displayName = item.label ?? item.name ?? (item.id !== undefined ? `#${item.id}` : '#?');
      const offsets = buildOffsets(item, addr, rsp, rbp, posValue);
      const note = item.note ?? item.hint ?? item.help;
      const intentTags = showIntentOverlay ? buildIntentTags(item, addr, intent, wordSize) : [];
      const offsetsHtml = offsets.length
        ? offsets
            .map((o) => {
              const classes = ['block-offset'];
              if (o.primary) classes.push('primary');
              if (o.secondary) classes.push('secondary');
              const tooltip = o.tooltip ? ` title="${o.tooltip}"` : '';
              return `<div class="${classes.join(' ')}"${tooltip}>${o.text}</div>`;
            })
            .join('')
        : `<div class="block-offset primary">Offset non fourni</div>`;
      const tagHtml = tags.length
        ? `<span class="block-tags">${tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}</span>`
        : '';
      const intentHtml = intentTags.length
        ? `<div class="block-intents">${intentTags
            .map((tag) => `<span class="block-intent ${tag.className}">${tag.text}</span>`)
            .join('')}</div>`
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
        ${intentHtml}
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

    if (!axisInserted) {
      elStack.appendChild(axis);
    }
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

    let spOffset = null;
    if (addr !== null && rsp !== null) {
      spOffset = addr - rsp;
    } else if (typeof posValue === 'number') {
      spOffset = posValue;
    }

    if (spOffset !== null) {
      offsets.push({
        text: `SP + ${formatHex(spOffset)}`,
        primary: offsets.length === 0,
        secondary: offsets.length > 0,
        tooltip: "Position relative au sommet de pile (ESP). ESP bouge, RBP est fixe."
      });
    }

    return offsets;
  }

  function buildAxisLabel(rbp, range) {
    const base = rbp !== null ? `RBP (repere fixe) = ${toHex(rbp)}` : 'RBP (repere fixe)';
    if (rbp !== null && range && (rbp < range.min || rbp > range.max)) {
      return `${base} (hors fenetre)`;
    }
    return `${base} • haut=RBP+ / bas=RBP-`;
  }

  function getStackAddrRange(items, rsp) {
    let min = null;
    let max = null;
    items.forEach((item) => {
      const addr = resolveStackAddress(item, rsp);
      if (addr === null) return;
      if (min === null || addr < min) min = addr;
      if (max === null || addr > max) max = addr;
    });
    if (min === null || max === null) return null;
    return { min, max };
  }

  function buildIntentOverlay(stackItems, regMap, snap) {
    const rsp = regMap.rsp ?? regMap.esp ?? null;
    const rbp = regMap.rbp ?? regMap.ebp ?? null;
    if (rbp === null) {
      return {
        bufferStart: null,
        bufferEnd: null,
        marker: null,
        target: null,
        summary: null
      };
    }

    const bufferOffset = typeof meta.buffer_offset === 'number' ? meta.buffer_offset : null;
    const bufferSize = typeof meta.buffer_size === 'number' ? meta.buffer_size : 0;
    const bufferStart = bufferOffset !== null ? rbp + bufferOffset : null;
    const bufferEnd = bufferStart !== null && bufferSize > 0 ? bufferStart + bufferSize : null;
    const target = resolveCmpTargetAddr(snap, regMap);
    const marker = findMarker(stackItems, rsp, bufferStart);
    const summary = buildMarkerSummary(marker, target);

    return {
      bufferStart,
      bufferEnd,
      marker,
      target,
      summary
    };
  }

  function buildIntentTags(item, addr, intent, wordSize) {
    if (!intent || addr === null) return [];
    const size = typeof item.size === 'number' ? item.size : wordSize;
    const rangeStart = addr;
    const rangeEnd = addr + size;
    const tags = [];

    if (intent.bufferStart !== null && intent.bufferStart >= rangeStart && intent.bufferStart < rangeEnd) {
      tags.push({ text: '▶ Debut d\'ecriture (read)', className: 'start' });
    }
    if (intent.target !== null && intent.target >= rangeStart && intent.target < rangeEnd) {
      tags.push({ text: '🎯 Cible du test', className: 'target' });
    }
    if (intent.marker && intent.marker.addr !== null) {
      const markerAddr = intent.marker.addr;
      if (markerAddr >= rangeStart && markerAddr < rangeEnd) {
        tags.push({ text: '📌 Marqueur', className: 'marker' });
      }
    }
    return tags;
  }

  function findMarker(stackItems, rsp, bufferStart) {
    const candidates = [];
    stackItems.forEach((item) => {
      const addr = resolveStackAddress(item, rsp);
      if (addr === null) return;
      const value = parseValue(item.value);
      if (value === null) return;
      const normalized = value >>> 0;
      if (MARKER_VALUES.has(normalized)) {
        candidates.push({ addr, value: normalized });
      }
    });

    if (!candidates.length) return null;

    if (bufferStart !== null) {
      const inOrder = candidates
        .map((c) => ({ ...c, diff: c.addr - bufferStart }))
        .filter((c) => c.diff >= 0)
        .sort((a, b) => a.diff - b.diff);
      if (inOrder.length) {
        return { addr: inOrder[0].addr, value: inOrder[0].value };
      }
    }

    candidates.sort((a, b) => a.addr - b.addr);
    return { addr: candidates[0].addr, value: candidates[0].value };
  }

  function buildMarkerSummary(marker, target) {
    if (!marker || marker.addr === null || target === null) return null;
    const delta = marker.addr - target;
    if (delta === 0) {
      return '✅ Marqueur sur la cible';
    }
    const abs = Math.abs(delta);
    const suffix = abs === 1 ? 'octet' : 'octets';
    return delta < 0
      ? `❌ ${abs} ${suffix} trop tot`
      : `❌ ${abs} ${suffix} trop tard`;
  }

  function resolveCmpTargetInfo(snap, regMap) {
    if (!snap || typeof snap.instr !== 'string') return null;
    const instr = snap.instr.toLowerCase();
    if (!instr.startsWith('cmp')) return null;

    const rbp = regMap.rbp ?? regMap.ebp ?? null;
    if (rbp === null) return null;

    const cmpLineEntry = findDisasmEntryByAddr(snap.rip);
    const cmpLine = cmpLineEntry?.line ?? null;
    const cmpText = cmpLineEntry?.text ? extractDisasmInstr(cmpLineEntry.text) : snap.instr;
    const cmpValue = extractImmediateValue(instr);

    const directOffset = extractBasePointerOffset(instr);
    if (directOffset !== null) {
      return {
        addr: rbp + directOffset,
        offset: directOffset,
        cmpValue,
        cmpLine,
        cmpText,
        movLine: null,
        movText: null
      };
    }

    const cmpReg = extractCmpRegister(instr);
    if (!cmpReg || !Array.isArray(disasmLines) || typeof snap.rip !== 'string') return null;

    const currentIndex = disasmLines.findIndex(
      (line) => line.addr && line.addr.toLowerCase() === snap.rip.toLowerCase()
    );
    if (currentIndex < 0) return null;

    for (let i = currentIndex - 1; i >= 0 && i >= currentIndex - 6; i -= 1) {
      const entry = disasmLines[i];
      const text = extractDisasmInstr(entry?.text);
      if (!text) continue;
      const lower = text.toLowerCase();
      const movMatch = lower.match(
        new RegExp(`^mov\\s+${cmpReg}\\s*,\\s*(?:dword ptr\\s*)?\\[(?:e|r)bp[^\\]]*\\]`)
      );
      if (movMatch) {
        const offset = extractBasePointerOffset(lower);
        if (offset !== null) {
          return {
            addr: rbp + offset,
            offset,
            cmpValue,
            cmpLine,
            cmpText,
            movLine: entry?.line ?? null,
            movText: text
          };
        }
      }
    }

    return null;
  }

  function resolveCmpTargetAddr(snap, regMap) {
    const info = resolveCmpTargetInfo(snap, regMap);
    return info ? info.addr : null;
  }

  function resolveBufferInfo(regMap) {
    const rbp = regMap.rbp ?? regMap.ebp ?? null;
    if (rbp === null) {
      return { addr: null, provenance: [] };
    }
    const bufferOffset = typeof meta.buffer_offset === 'number' ? meta.buffer_offset : null;
    if (bufferOffset === null) {
      return { addr: null, provenance: [] };
    }

    const addr = rbp + bufferOffset;
    const provenance = buildBufferProvenance(bufferOffset);
    return { addr, provenance };
  }

  function buildTargetProvenance(info) {
    if (!info) return [];
    const provenance = [];
    if (info.movText) {
      provenance.push({
        text: `source : ${info.movText}`,
        line: info.movLine ?? null
      });
    }
    if (info.cmpText) {
      provenance.push({
        text: `compare dans : ${info.cmpText}`,
        line: info.cmpLine ?? null
      });
    }
    return provenance;
  }

  function buildBufferProvenance(bufferOffset) {
    if (!Array.isArray(disasmLines) || !disasmLines.length) return [];
    const readIndex = disasmLines.findIndex((line) => isReadCall(line?.text));
    if (readIndex < 0) return [];

    const callEntry = disasmLines[readIndex];
    const callText = extractDisasmInstr(callEntry?.text);
    const provenance = [];

    let leaEntry = null;
    for (let i = readIndex - 1; i >= 0 && i >= readIndex - 8; i -= 1) {
      const entry = disasmLines[i];
      const text = extractDisasmInstr(entry?.text);
      if (!text) continue;
      const lower = text.toLowerCase();
      if (!lower.startsWith('lea') || !lower.includes('bp')) continue;
      const offset = extractBasePointerOffset(lower);
      if (offset !== null && bufferOffset !== null && offset !== bufferOffset) continue;
      leaEntry = entry;
      break;
    }

    if (leaEntry) {
      provenance.push({
        text: `deduit de : ${extractDisasmInstr(leaEntry.text)}`,
        line: leaEntry.line ?? null
      });
    }
    if (callText) {
      provenance.push({
        text: `appel : ${callText}`,
        line: callEntry.line ?? null
      });
    }

    return provenance;
  }

  function isReadCall(text) {
    if (typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    return lower.includes('call') && (lower.includes('sys_read') || lower.includes('read@') || lower.includes('<read'));
  }

  function findDisasmEntryByAddr(addr) {
    if (!addr || !Array.isArray(disasmLines)) return null;
    const target = typeof addr === 'string' ? addr.toLowerCase() : toHex(addr).toLowerCase();
    return disasmLines.find((line) => line.addr && line.addr.toLowerCase() === target) ?? null;
  }

  function extractImmediateValue(instr) {
    if (typeof instr !== 'string') return null;
    const parts = instr.split(',');
    if (parts.length < 2) return null;
    const operand = parts[1];
    const match = operand.match(/0x[0-9a-f]+|\\b\\d+\\b/i);
    if (!match) return null;
    const raw = match[0];
    const value = raw.startsWith('0x') ? parseInt(raw, 16) : parseInt(raw, 10);
    return Number.isFinite(value) ? value : null;
  }

  function extractCmpRegister(instr) {
    const parts = instr.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;
    const op1 = parts[1];
    const op2 = parts[2];
    if (isRegister(op1)) return op1;
    if (isRegister(op2)) return op2;
    return null;
  }

  function extractBasePointerOffset(text) {
    const match = text.match(/\[(?:e|r)bp([+-]0x[0-9a-f]+|[+-]\\d+)?\]/);
    if (!match) return null;
    const raw = match[1];
    if (!raw) return 0;
    return parseSignedNumber(raw);
  }

  function parseSignedNumber(raw) {
    const trimmed = raw.trim();
    const sign = trimmed.startsWith('-') ? -1 : 1;
    const absText = trimmed.replace(/^[-+]/, '');
    const value = absText.startsWith('0x') ? parseInt(absText, 16) : parseInt(absText, 10);
    if (Number.isNaN(value)) return null;
    return sign * value;
  }

  function extractDisasmInstr(text) {
    if (typeof text !== 'string') return '';
    const tabIndex = text.indexOf('\t');
    if (tabIndex >= 0) {
      return text.slice(tabIndex + 1).trim();
    }
    return text.trim();
  }

  function parseValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    if (value.startsWith('0x')) {
      const parsed = parseInt(value, 16);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isRegister(text) {
    return /^(e?[abcd]x|e?[sb]p|e?[sd]i|r(1[0-5]|[0-9]|ax|bx|cx|dx|si|di|bp|sp))$/.test(
      text
    );
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

  function renderAnnotations(snap, regMap, intent) {
    if (!elAnnotations) return;
    if (!showIntentOverlay) {
      elAnnotations.innerHTML = '';
      return;
    }

    const annotations = Array.isArray(snap.annotations) ? [...snap.annotations] : [];
    const rbp = regMap?.rbp ?? regMap?.ebp ?? null;

    if (intent?.summary) {
      annotations.unshift({
        label: intent.summary,
        detail: ''
      });
    }

    if (intent?.bufferStart !== null && rbp !== null) {
      annotations.push({
        label: '▶ Debut d\'ecriture (read)',
        detail: `buffer = RBP ${formatSignedHex(intent.bufferStart - rbp)}`
      });
    }

    if (intent?.target !== null && rbp !== null) {
      annotations.push({
        label: '🎯 Cible du test',
        detail: `RBP ${formatSignedHex(intent.target - rbp)}`
      });
    }

    if (intent?.marker?.addr !== null) {
      annotations.push({
        label: '📌 Marqueur',
        detail: `valeur = ${formatHex(intent.marker.value)}`
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

  function renderReasoningPanel(stackItems, regMap, snap) {
    if (!elReasoningPanel || !elReasoningBody) return;
    updateReasoningVisibility();

    if (!showReasoningPanel) {
      elReasoningBody.innerHTML = '';
      return;
    }

    if (!frozenReasoningData) {
      frozenReasoningData = buildFrozenReasoningData();
    }

    if (!frozenReasoningData) {
      elReasoningBody.innerHTML = '<div class="status">Aucune pile a analyser.</div>';
      return;
    }

    const data = frozenReasoningData;
    elReasoningBody.innerHTML = buildReasoningHtml(data);
    bindReasoningLinks(elReasoningBody);
  }

  function buildReasoningData(stackItems, regMap, snap) {
    const rsp = regMap.rsp ?? regMap.esp ?? null;
    const rbp = regMap.rbp ?? regMap.ebp ?? null;
    const bufferInfo = resolveBufferInfo(regMap);
    const targetInfo = resolveCmpTargetInfo(snap, regMap);
    const marker = findMarker(stackItems, rsp, bufferInfo.addr);

    const bufferOffset = rbp !== null && bufferInfo.addr !== null ? bufferInfo.addr - rbp : null;
    const targetOffset = rbp !== null && targetInfo?.addr !== null ? targetInfo.addr - rbp : null;
    const markerOffset = rbp !== null && marker?.addr !== null ? marker.addr - rbp : null;

    const bufferToTarget =
      bufferInfo.addr !== null && targetInfo?.addr !== null
        ? targetInfo.addr - bufferInfo.addr
        : null;
    const markerToTarget =
      marker?.addr !== null && targetInfo?.addr !== null
        ? marker.addr - targetInfo.addr
        : null;

    const verdict = buildMarkerSummary(marker, targetInfo?.addr ?? null);
    const markerPresent = marker?.addr !== null;

    return {
      buffer: {
        addr: bufferInfo.addr,
        offset: bufferOffset,
        provenance: bufferInfo.provenance
      },
      target: {
        addr: targetInfo?.addr ?? null,
        offset: targetOffset,
        value: targetInfo?.cmpValue ?? null,
        provenance: buildTargetProvenance(targetInfo)
      },
      marker: {
        present: markerPresent,
        addr: marker?.addr ?? null,
        offset: markerOffset,
        value: marker?.value ?? null,
        provenance: markerPresent ? [{ text: 'detecte dans la pile (entree utilisateur)', line: null }] : []
      },
      distances: {
        bufferToTarget,
        markerToTarget,
        verdict,
        provenance: 'calcule a partir des offsets RBP'
      }
    };
  }

  function buildFrozenReasoningData() {
    if (!Array.isArray(snapshots) || snapshots.length === 0) return null;

    const baseSnap = snapshots.find((s) => Array.isArray(s.registers) || Array.isArray(s.regs)) ?? snapshots[0];
    const baseRegs = Array.isArray(baseSnap.registers)
      ? baseSnap.registers
      : Array.isArray(baseSnap.regs)
      ? baseSnap.regs
      : [];
    const baseRegMap = buildRegisterMap(baseRegs);

    const bufferInfo = resolveBufferInfo(baseRegMap);

    const cmpSnap = snapshots.find(
      (s) => typeof s.instr === 'string' && s.instr.toLowerCase().startsWith('cmp')
    );
    const cmpRegs = cmpSnap
      ? Array.isArray(cmpSnap.registers)
        ? cmpSnap.registers
        : Array.isArray(cmpSnap.regs)
        ? cmpSnap.regs
        : []
      : baseRegs;
    const cmpRegMap = cmpSnap ? buildRegisterMap(cmpRegs) : baseRegMap;
    const targetInfo = cmpSnap ? resolveCmpTargetInfo(cmpSnap, cmpRegMap) : null;

    let marker = null;
    for (const snap of snapshots) {
      if (!Array.isArray(snap.stack) || snap.stack.length === 0) continue;
      const regs = Array.isArray(snap.registers)
        ? snap.registers
        : Array.isArray(snap.regs)
        ? snap.regs
        : [];
      const regMap = regs.length ? buildRegisterMap(regs) : baseRegMap;
      const rsp = regMap.rsp ?? regMap.esp ?? null;
      if (rsp === null) continue;
      const found = findMarker(snap.stack, rsp, bufferInfo.addr);
      if (found) {
        marker = found;
        break;
      }
    }

    const rbp = baseRegMap.rbp ?? baseRegMap.ebp ?? cmpRegMap.rbp ?? cmpRegMap.ebp ?? null;
    const bufferOffset = rbp !== null && bufferInfo.addr !== null ? bufferInfo.addr - rbp : null;
    const targetOffset = rbp !== null && targetInfo?.addr !== null ? targetInfo.addr - rbp : null;
    const markerOffset = rbp !== null && marker?.addr !== null ? marker.addr - rbp : null;

    const bufferToTarget =
      bufferInfo.addr !== null && targetInfo?.addr !== null
        ? targetInfo.addr - bufferInfo.addr
        : null;
    const markerToTarget =
      marker?.addr !== null && targetInfo?.addr !== null ? marker.addr - targetInfo.addr : null;

    const verdict = buildMarkerSummary(marker, targetInfo?.addr ?? null);
    const markerPresent = marker?.addr !== null;

    return {
      buffer: {
        addr: bufferInfo.addr,
        offset: bufferOffset,
        provenance: bufferInfo.provenance
      },
      target: {
        addr: targetInfo?.addr ?? null,
        offset: targetOffset,
        value: targetInfo?.cmpValue ?? null,
        provenance: buildTargetProvenance(targetInfo)
      },
      marker: {
        present: markerPresent,
        addr: marker?.addr ?? null,
        offset: markerOffset,
        value: marker?.value ?? null,
        provenance: markerPresent ? [{ text: 'detecte dans la pile (entree utilisateur)', line: null }] : []
      },
      distances: {
        bufferToTarget,
        markerToTarget,
        verdict,
        provenance: 'calcule a partir des offsets RBP'
      }
    };
  }

  function buildReasoningHtml(data) {
    const bufferValues = data.buffer.addr !== null ? buildOffsetAddressValues(data.buffer) : [];
    const bufferSection = buildReasoningSection(
      '▶ Debut d\'ecriture (buffer start)',
      bufferValues,
      data.buffer.provenance
    );
    const targetValues = data.target.addr !== null
      ? [
          ...buildOffsetAddressValues(data.target),
          buildValueDisplay('Valeur attendue', formatHexValue(data.target.value))
        ]
      : [];
    const targetSection = buildReasoningSection(
      '🎯 Cible du test',
      targetValues,
      data.target.provenance
    );
    const markerValues = data.marker.present
      ? [
          ...buildOffsetAddressValues(data.marker),
          buildValueDisplay('Valeur', formatHexValue(data.marker.value))
        ]
      : [];
    const markerSection = buildReasoningSection(
      '📌 Marqueur utilisateur',
      markerValues,
      data.marker.provenance
    );
    const distanceSection = buildReasoningSection(
      'Distances / diagnostic',
      buildDistanceValues(data.distances),
      data.distances.provenance ? [{ text: data.distances.provenance, line: null }] : []
    );

    return [bufferSection, targetSection, markerSection, distanceSection].join('');
  }

  function buildReasoningSection(title, values, provenance) {
    const valuesHtml = values.length ? values.map(renderReasoningValue).join('') : '<div class="reasoning-meta">Non detecte.</div>';
    const provenanceHtml = Array.isArray(provenance)
      ? provenance.map(renderReasoningProvenance).join('')
      : provenance
      ? `<div class="reasoning-meta">${provenance}</div>`
      : '';

    return `
      <div class="reasoning-section">
        <div class="reasoning-title">${title}</div>
        <div class="reasoning-values">${valuesHtml}</div>
        ${provenanceHtml ? `<div class="reasoning-meta">${provenanceHtml}</div>` : ''}
      </div>
    `;
  }

  function buildOffsetAddressValues(entry) {
    const values = [];
    if (!entry) return values;
    values.push(buildValueDisplay('', formatRbpOffset(entry.offset), entry.addr));
    values.push(buildValueDisplay('', entry.addr !== null ? `addr ${toHex(entry.addr)}` : 'addr ?', entry.addr));
    return values;
  }

  function buildDistanceValues(distances) {
    const values = [];
    if (!distances) return values;
    values.push(buildValueDisplay('Buffer → cible', formatSignedBytes(distances.bufferToTarget)));
    values.push(buildValueDisplay('Marqueur → cible', formatSignedBytes(distances.markerToTarget)));
    values.push(buildValueDisplay('Verdict', distances.verdict ?? 'Non detecte'));
    return values;
  }

  function buildValueDisplay(label, text, addr) {
    return {
      label,
      text,
      addr
    };
  }

  function renderReasoningValue(value) {
    const label = value.label ? `${value.label}: ` : '';
    if (value.addr !== undefined && value.addr !== null) {
      const addrLabel = toHex(value.addr);
      return `<button class="reasoning-link" data-addr="${addrLabel}">${label}${value.text}</button>`;
    }
    return `<span class="reasoning-meta">${label}${value.text}</span>`;
  }

  function renderReasoningProvenance(item) {
    if (!item || !item.text) return '';
    if (item.line) {
      return `<button class="reasoning-meta-link" data-disasm-line="${item.line}">${item.text} (L${item.line})</button>`;
    }
    return `<div>${item.text}</div>`;
  }

  function bindReasoningLinks(container) {
    if (!container) return;
    container.querySelectorAll('[data-addr]').forEach((node) => {
      node.addEventListener('click', (event) => {
        event.preventDefault();
        const addr = node.getAttribute('data-addr');
        if (addr) {
          scrollToStackAddr(addr);
        }
      });
    });

    container.querySelectorAll('[data-disasm-line]').forEach((node) => {
      node.addEventListener('click', (event) => {
        event.preventDefault();
        const line = parseInt(node.getAttribute('data-disasm-line'), 10);
        if (Number.isFinite(line) && meta.disasm_path) {
          vscode.postMessage({ type: 'goToLine', line, file: meta.disasm_path });
        }
      });
    });
  }

  function scrollToStackAddr(addrLabel) {
    if (!elStack) return;
    const target = elStack.querySelector(`[data-addr="${addrLabel}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('block-focus');
    setTimeout(() => {
      target.classList.remove('block-focus');
    }, 900);
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

  function formatRbpOffset(offset) {
    if (offset === null || offset === undefined) return 'RBP ?';
    return `RBP ${formatSignedHex(offset)}`;
  }

  function formatHexValue(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '?';
    return formatHex(value);
  }

  function formatSignedBytes(delta) {
    if (delta === null || delta === undefined) return '?';
    const abs = Math.abs(delta);
    const sign = delta < 0 ? '-' : '+';
    const suffix = abs === 1 ? 'octet' : 'octets';
    return `${sign}${abs} ${suffix}`;
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
    // showIntentOverlay = mode === 'beginner';
    vscode.setState({ viewMode, showIntentOverlay, showReasoningPanel });
    updateModeButtons();
    // updateIntentButton();
    updateReasoningButton();
    updateReasoningVisibility();
    updateUI();
  }

  function updateModeButtons() {
    if (!elModeBeginner || !elModeExpert) return;
    elModeBeginner.classList.toggle('is-active', viewMode === 'beginner');
    elModeExpert.classList.toggle('is-active', viewMode === 'expert');
  }

  function setIntentOverlay(enabled) {
    showIntentOverlay = enabled;
    vscode.setState({ viewMode, showIntentOverlay, showReasoningPanel });
    updateIntentButton();
    updateUI();
  }

  function updateIntentButton() {
    if (!elToggleIntent) return;
    elToggleIntent.classList.toggle('is-active', showIntentOverlay);
    elToggleIntent.textContent = showIntentOverlay ? 'Hide intent overlay' : 'Show intent overlay';
  }

  function setReasoningPanel(enabled) {
    showReasoningPanel = enabled;
    vscode.setState({ viewMode, showIntentOverlay, showReasoningPanel });
    updateReasoningButton();
    updateReasoningVisibility();
    updateUI();
  }

  function updateReasoningButton() {
    if (!elToggleReasoning) return;
    elToggleReasoning.classList.toggle('is-active', showReasoningPanel);
    elToggleReasoning.textContent = showReasoningPanel ? 'Hide reasoning panel' : 'Show reasoning panel';
  }

  function updateReasoningVisibility() {
    if (!elReasoningPanel) return;
    elReasoningPanel.classList.toggle('is-collapsed', !showReasoningPanel);
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

  /*
  if (elToggleIntent) {
    elToggleIntent.addEventListener('click', () => {
      setIntentOverlay(!showIntentOverlay);
    });
  }
  */

  if (elToggleReasoning) {
    elToggleReasoning.addEventListener('click', () => {
      setReasoningPanel(!showReasoningPanel);
    });
  }
})();
