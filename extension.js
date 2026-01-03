// VS Code extension entrypoint for the stack visualizer.

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const logChannel = vscode.window.createOutputChannel('Stack Visualizer');

const decorationTypes = new Map();

/**
 * Lit output.json à la racine du workspace.
 * Retourne { snapshots, risks, meta }.
 */
// Load output.json from the workspace root (snapshots + risks + meta).
function loadTraceFromWorkspace() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('Aucun workspace ouvert. Ouvre un dossier contenant output.json.');
    return { snapshots: [], risks: [], meta: {} };
  }

  const root = folders[0].uri.fsPath;
  const jsonPath = path.join(root, 'output.json');

  if (!fs.existsSync(jsonPath)) {
    vscode.window.showErrorMessage(`Fichier output.json introuvable à la racine du workspace (${jsonPath}).`);
    return { snapshots: [], risks: [], meta: {} };
  }

  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return { snapshots: data, risks: [], meta: {} };
    }
    if (data && Array.isArray(data.snapshots)) {
      return {
        snapshots: data.snapshots,
        risks: Array.isArray(data.risks) ? data.risks : [],
        meta: data.meta && typeof data.meta === 'object' ? data.meta : {}
      };
    }
    vscode.window.showErrorMessage('output.json doit contenir un tableau JSON de snapshots ou un objet { snapshots, risks }.');
    return { snapshots: [], risks: [], meta: {} };
  } catch (err) {
    console.error(err);
    vscode.window.showErrorMessage('Erreur lors de la lecture / parse de output.json.');
    return { snapshots: [], risks: [], meta: {} };
  }
}

/**
 * Construit le HTML de la webview à partir de index.html + URIs webview-friendly.
 */
// Resolve local assets to webview-safe URIs and inject CSP.
function getWebviewContent(webview, extensionUri) {
  const indexPath = vscode.Uri.joinPath(extensionUri, 'media', 'index.html');
  let html = fs.readFileSync(indexPath.fsPath, 'utf8');

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'script.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'styles.css')
  );

  const cspSource = webview.cspSource;

  html = html
    .replace(/{{scriptUri}}/g, scriptUri.toString())
    .replace(/{{styleUri}}/g, styleUri.toString())
    .replace(/{{cspSource}}/g, cspSource);

  return html;
}

/**
 * Automatic build at activation
 */
// Build C sources (make + local compiles) in background.
async function autoBuildAtActivation(root, extensionUri) {
  logChannel.appendLine('[pile-or-pwn] autoBuildAtActivation start; root=' + root);
  try {
    if (!root || !fs.existsSync(root)) {
      logChannel.appendLine('[pile-or-pwn] no workspace root for auto build');
      return;
    }

    // 1) Try workspace Makefile
    const makefile = path.join(root, 'Makefile');
    if (fs.existsSync(makefile)) {
      try {
        logChannel.appendLine('[pile-or-pwn] auto-build: running `make` in ' + root);
        execSync('make', { cwd: root, stdio: 'inherit' });
        logChannel.appendLine('[pile-or-pwn] auto-build: make finished');
      } catch (e) {
        logChannel.appendLine('[pile-or-pwn] auto-build: make failed: ' + String(e));
      }
    }

    // 2) Detect C compiler
    const candidates = process.platform === 'win32' ? ['gcc', 'clang', 'cl'] : ['cc', 'gcc', 'clang'];
    let cc = null;
    for (const c of candidates) {
      try { execSync(c + ' --version', { stdio: 'ignore' }); cc = c; break; } catch {}
    }
    if (!cc) {
      logChannel.appendLine('[pile-or-pwn] auto-build: no C compiler detected; skipping compile step');
      return;
    }

    const platform = process.platform;
    const arch = process.arch;
    const outDir = path.join(extensionUri.fsPath, 'bin', `${platform}-${arch}`);
    fs.mkdirSync(outDir, { recursive: true });

    // Helper to run a compile command and log output
    const runCompile = (cmd, cwd, outPath) => {
      logChannel.appendLine('[pile-or-pwn] auto-build exec: ' + cmd + ' cwd=' + cwd);
      try {
        const res = execSync(cmd, { cwd, stdio: 'pipe' });
        if (res && res.length) logChannel.appendLine('[pile-or-pwn] auto-build stdout: ' + res.toString());
        if (outPath && fs.existsSync(outPath)) {
          logChannel.appendLine('[pile-or-pwn] auto-build: produced ' + outPath);
        }
      } catch (err) {
        logChannel.appendLine('[pile-or-pwn] auto-build: compile failed: ' + String(err));
        if (err.stdout) logChannel.appendLine('[pile-or-pwn] auto-build stdout: ' + err.stdout.toString());
        if (err.stderr) logChannel.appendLine('[pile-or-pwn] auto-build stderr: ' + err.stderr.toString());
      }
    };

    // 3) Compile simulator(s) in src/sim -> asm2json
    const simDir = path.join(root, 'src', 'sim');
    if (fs.existsSync(simDir)) {
      const simFiles = fs.readdirSync(simDir).filter(f => f.endsWith('.c'));
      if (simFiles.length) {
        const simSources = simFiles.map(f => path.join('src', 'sim', f)).join(' ');
        const exeName = platform === 'win32' ? 'asm2json.exe' : 'asm2json';
        const outPath = path.join(outDir, exeName);
        const compileCmd = process.platform === 'win32'
          ? `${cc} -Wall -Wextra -O2 -std=c11 -Isrc/include -o "${outPath}" ${simSources}`
          : `sh -c "${cc} -Wall -Wextra -O2 -std=c11 -Isrc/include -o \"${outPath}\" ${simSources}"`;
        runCompile(compileCmd, root, outPath);
      }
    }

    // 4) Compile other mains found under src (link all src/*.c into each main target)
    const srcRoot = path.join(root, 'src');
    const srcFiles = [];
    const walk = (d) => {
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full);
        else if (name.endsWith('.c')) srcFiles.push(path.relative(root, full));
      }
    };
    if (fs.existsSync(srcRoot)) walk(srcRoot);

    if (srcFiles.length) {
      const allSources = srcFiles.join(' ');
      for (const rel of srcFiles) {
        const abs = path.join(root, rel);
        try {
          const content = fs.readFileSync(abs, 'utf8');
          if (content.includes('int main(')) {
            const base = path.basename(rel, '.c');
            // avoid recompiling asm2json here (already handled)
            if (base === 'asm2json') continue;
            const exeName = platform === 'win32' ? base + '.exe' : base;
            const outPath = path.join(outDir, exeName);
            const compileCmd = process.platform === 'win32'
              ? `${cc} -Wall -Wextra -O2 -std=c11 -Isrc/include -o "${outPath}" ${allSources}`
              : `sh -c "${cc} -Wall -Wextra -O2 -std=c11 -Isrc/include -o \"${outPath}\" ${allSources}"`;
            runCompile(compileCmd, root, outPath);
          }
        } catch (e) {
          logChannel.appendLine('[pile-or-pwn] auto-build: failed reading ' + abs + ' : ' + String(e));
        }
      }
    }

  } catch (err) {
    logChannel.appendLine('[pile-or-pwn] autoBuildAtActivation ERROR: ' + String(err));
  }
  logChannel.appendLine('[pile-or-pwn] autoBuildAtActivation finished');
}

/**
 * Activation de l'extension
 */
// Main activation hook, registers the command and message bridge.
function activate(context) {
  logChannel.appendLine('[pile-or-pwn] activate() start');
  try {
    const disposable = vscode.commands.registerCommand('stackVisualizer.open', () => {
    logChannel.show(true);
    const trace = loadTraceFromWorkspace();
    if (trace.snapshots.length === 0) {
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'stackVisualizer',
      'Stack Visualizer',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true
      }
    );

    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

    // Messages venant du webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        // initialisation (snapshots envoyés au webview)
        if (message.type === 'ready') {
          panel.webview.postMessage({
            type: 'init',
            snapshots: trace.snapshots,
            risks: trace.risks,
            meta: trace.meta
          });
        }

        // aller à une ligne dans input.asm et la surligner
        if (message.type === 'goToLine') {
          const line = message.line ?? 1;
          const targetFile = message.file;
          logChannel.appendLine(`[goToLine] line=${line} file=${targetFile ?? ""}`);
          const folders = vscode.workspace.workspaceFolders;
          const root = folders && folders.length ? folders[0].uri.fsPath : '';

          let docUri = null;
          if (targetFile) {
            if (path.isAbsolute(targetFile) && fs.existsSync(targetFile)) {
              docUri = vscode.Uri.file(targetFile);
            } else {
              const candidate = path.join(root, targetFile);
              if (fs.existsSync(candidate)) {
                docUri = vscode.Uri.file(candidate);
              }
            }
            if (!docUri) {
              const matches = await vscode.workspace.findFiles(`**/${targetFile}`);
              if (matches.length) {
                docUri = matches[0];
              }
            }
          }

          if (!docUri) {
            const asmDocs = await vscode.workspace.findFiles('**/input.asm');
            if (!asmDocs.length) {
              return;
            }
            docUri = asmDocs[0];
          }

          const doc = await vscode.workspace.openTextDocument(docUri);
          const editor = await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true,   // 👈 garde le focus sur le webview
            preview: true
          }); 

          const range = new vscode.Range(line - 1, 0, line - 1, 1000);

          editor.selection = new vscode.Selection(range.start, range.start);
          editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

          const uriKey = doc.uri.toString();
          let deco = decorationTypes.get(uriKey);
          if (!deco) {
            deco = vscode.window.createTextEditorDecorationType({
              isWholeLine: true,
              backgroundColor: 'rgba(255, 255, 0, 0.2)'
            });
            decorationTypes.set(uriKey, deco);
          }

          editor.setDecorations(deco, [range]);
        }
      },
      undefined,
      context.subscriptions
    );
  });

  context.subscriptions.push(disposable);
    logChannel.appendLine('[pile-or-pwn] registerCommand(stackVisualizer.open) OK');

  // Command: Exécuter un fichier depuis l'explorateur (clic droit) -> génère output.json puis ouvre le visualizer
  const execFileCmd = vscode.commands.registerCommand('pileOrPwn.executeFile', async (resource) => {
    logChannel.appendLine('[pile-or-pwn] pileOrPwn.executeFile invoked; resource=' + (resource && resource.fsPath ? resource.fsPath : String(resource)));
    try {
      let fileUri = resource && resource.fsPath ? resource : null;
      if (!fileUri) {
        const pick = await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFiles: true, filters: { 'ASM': ['asm','s'], 'All': ['*'] } });
        if (!pick || !pick.length) return;
        fileUri = pick[0];
      }

      // Recherche du binaire `asm2json` adapté à la plateformeet fallback sur le binaire produit dans le workspace
      const platform = process.platform;
      const arch = process.arch;
      const exeName = platform === 'win32' ? 'asm2json.exe' : 'asm2json';
      // Cherche d'abord dans l'extension (packaged), puis dans le workspace (Makefile produit `bin/asm2json`).
      let binPath = path.join(context.extensionUri.fsPath, 'bin', `${platform}-${arch}`, exeName);
      logChannel.appendLine('[pile-or-pwn] initial binPath candidate = ' + binPath);

      if (!fs.existsSync(binPath)) {
        const folders = vscode.workspace.workspaceFolders;
        const root = folders && folders.length ? folders[0].uri.fsPath : '';
        const workspaceBin = path.join(root, 'bin', exeName);
        const workspaceBinArch = path.join(root, 'bin', `${platform}-${arch}`, exeName);
        if (fs.existsSync(workspaceBin)) {
          binPath = workspaceBin;
        } else if (fs.existsSync(workspaceBinArch)) {
          binPath = workspaceBinArch;
        }
        logChannel.appendLine('[pile-or-pwn] checked workspace bins: workspaceBin=' + workspaceBin + ' exists=' + fs.existsSync(workspaceBin) + ', workspaceBinArch=' + workspaceBinArch + ' exists=' + fs.existsSync(workspaceBinArch) + ', selected=' + binPath);
      }

      if (!fs.existsSync(binPath)) {
        logChannel.appendLine('[pile-or-pwn] bin missing; attempting automatic build (make then local compile)');
        try {
          const folders = vscode.workspace.workspaceFolders;
          const root = folders && folders.length ? folders[0].uri.fsPath : '';

          // 1) Try workspace Makefile
          if (root && fs.existsSync(path.join(root, 'Makefile'))) {
            try {
              logChannel.appendLine('[pile-or-pwn] attempting `make` in ' + root);
              execSync('make', { cwd: root, stdio: 'inherit' });
              logChannel.appendLine('[pile-or-pwn] make finished');
              const candidate = path.join(root, 'bin', exeName);
              if (fs.existsSync(candidate)) {
                binPath = candidate;
                logChannel.appendLine('[pile-or-pwn] make produced: ' + candidate);
              }
            } catch (e) {
              logChannel.appendLine('[pile-or-pwn] make failed: ' + String(e));
            }
          }

          // 2) If still missing, try local compile using available compiler
          if (!fs.existsSync(binPath)) {
            // Detect compiler
            const candidates = process.platform === 'win32' ? ['gcc', 'clang', 'cl'] : ['cc', 'gcc', 'clang'];
            let cc = null;
            for (const c of candidates) {
              try { execSync(c + ' --version', { stdio: 'ignore' }); cc = c; break; } catch {}
            }
            if (!cc) {
              throw new Error('Aucun compilateur (gcc/clang) détecté ; installe un compilateur C pour permettre la compilation automatique.');
            }

            const outDir = path.join(context.extensionUri.fsPath, 'bin', `${platform}-${arch}`);
            fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, exeName);

            // Determine source root: prefer workspace folder containing the file/resource
            let srcRoot = root || context.extensionUri.fsPath;
            try {
              const wsFolder = vscode.workspace.getWorkspaceFolder(fileUri);
              if (wsFolder && wsFolder.uri && wsFolder.uri.fsPath) srcRoot = wsFolder.uri.fsPath;
            } catch (e) {
              // fallback stays the same
            }

            // Build an explicit list of source files (avoid relying on shell globbing)
            const simDir = path.join(srcRoot, 'src', 'sim');
            let simSources = null;
            if (fs.existsSync(simDir)) {
              const files = fs.readdirSync(simDir).filter(f => f.endsWith('.c'));
              if (files.length) simSources = files.map(f => path.join('src', 'sim', f)).join(' ');
            }

            if (!simSources) {
              // no simulator sources found at this root; try extension sources
              const extSimDir = path.join(context.extensionUri.fsPath, 'src', 'sim');
              if (fs.existsSync(extSimDir)) {
                const files = fs.readdirSync(extSimDir).filter(f => f.endsWith('.c'));
                if (files.length) simSources = files.map(f => path.join('src', 'sim', f)).join(' ');
                // set srcRoot so compiler cwd can find any includes relative to extension
                srcRoot = context.extensionUri.fsPath;
              }
            }

            if (!simSources) {
              throw new Error('Sources introuvables: aucun fichier C dans src/sim dans le workspace ni dans l\'extension');
            }

            const compileCmd = process.platform === 'win32'
              ? `${cc} -Wall -Wextra -O2 -std=c11 -Isrc/include -o "${outPath}" ${simSources}`
              : `${cc} -Wall -Wextra -O2 -std=c11 -Isrc/include -o "${outPath}" ${simSources}`;

            logChannel.appendLine('[pile-or-pwn] compileCmd: ' + compileCmd + ' cwd=' + srcRoot);
            try {
              const result = execSync(compileCmd, { cwd: srcRoot, stdio: 'pipe' });
              if (result && result.length) logChannel.appendLine('[pile-or-pwn] compile stdout: ' + result.toString());
              logChannel.appendLine('[pile-or-pwn] compileCmd finished, checking ' + outPath);
              if (fs.existsSync(outPath)) {
                binPath = outPath;
                logChannel.appendLine('[pile-or-pwn] compiled outPath = ' + outPath);
              }
            } catch (compileErr) {
              logChannel.appendLine('[pile-or-pwn] compile failed: ' + String(compileErr));
              if (compileErr.stdout) logChannel.appendLine('[pile-or-pwn] compile stdout: ' + compileErr.stdout.toString());
              if (compileErr.stderr) logChannel.appendLine('[pile-or-pwn] compile stderr: ' + compileErr.stderr.toString());
              throw compileErr;
            }
          }

          if (!fs.existsSync(binPath)) throw new Error('Compilation échouée: binaire introuvable après tentative(s).');
        } catch (err) {
          vscode.window.showErrorMessage('Échec : impossible de construire asm2json. Assure-toi que make/gcc/clang est installé.');
          logChannel.appendLine(String(err));
          return;
        }
      }

      // Exécution : passe le chemin d'entrée et demande au binaire d'écrire `output.json` à la racine du workspace.
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || !folders.length) {
        vscode.window.showErrorMessage('Aucun workspace ouvert pour écrire output.json.');
        return;
      }

      const outPath = path.join(folders[0].uri.fsPath, 'output.json');
      const inputPath = fileUri && fileUri.fsPath ? fileUri.fsPath : (fileUri && fileUri.path ? fileUri.path : String(fileUri));

      // On passe l'input et l'output au binaire : `asm2json <input> <output>`.
      const args = [inputPath, outPath];
      logChannel.appendLine('[pile-or-pwn] executing: ' + binPath + ' ' + args.join(' '));
      try {
        execFileSync(binPath, args, { stdio: 'inherit' });
        logChannel.appendLine('[pile-or-pwn] execFileSync OK');
      } catch (err) {
        vscode.window.showErrorMessage('Erreur lors de l\'exécution du simulateur: voir la sortie.');
        logChannel.appendLine(String(err));
        return;
      }

      if (!fs.existsSync(outPath)) {
        vscode.window.showErrorMessage('Le simulateur n\'a pas produit output.json.');
        return;
      } else {
        logChannel.appendLine('[pile-or-pwn] output.json créé: ' + outPath);
      }

      vscode.window.showInformationMessage('Simulation terminée — fichier output.json généré.');

      // Ouvre le visualizer avec le nouveau output.json
      await vscode.commands.executeCommand('stackVisualizer.open');
    } catch (err) {
      vscode.window.showErrorMessage('Erreur pendant l\'exécution: ' + (err && err.message ? err.message : String(err)));
      logChannel.appendLine(String(err));
    }
  });
  context.subscriptions.push(execFileCmd);
  logChannel.appendLine('[pile-or-pwn] registerCommand(pileOrPwn.executeFile) OK');

  // Start background auto-build of C sources in each workspace folder (non-blocking)
  try {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length) {
      folders.forEach((f, i) => {
        const root = f.uri.fsPath;
        setTimeout(() => autoBuildAtActivation(root, context.extensionUri), 100 + i * 100);
      });
    } else {
      logChannel.appendLine('[pile-or-pwn] no workspace folders found for auto-build');
    }
  } catch (e) {
    logChannel.appendLine('[pile-or-pwn] autoBuildAtActivation scheduling failed: ' + String(e));
  }

  logChannel.appendLine('[pile-or-pwn] activate() OK');
  try { vscode.window.showInformationMessage('Pile or Pwn: activated (dev)'); } catch (e) {}
  } catch (err) {
    logChannel.appendLine('[pile-or-pwn] activate() ERROR: ' + String(err));
    throw err;
  }
}

function deactivate() {
  for (const deco of decorationTypes.values()) {
    deco.dispose();
  }
  decorationTypes.clear();
}

module.exports = {
  activate,
  deactivate,
  // exported for tests
  loadTraceFromWorkspace,
  autoBuildAtActivation
};
