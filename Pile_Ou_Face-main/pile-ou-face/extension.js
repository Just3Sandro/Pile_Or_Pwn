// extension.js
// VS Code extension entrypoint for the stack visualizer.

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

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
  const indexPath = vscode.Uri.joinPath(extensionUri, 'index.html');
  let html = fs.readFileSync(indexPath.fsPath, 'utf8');

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'script.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'styles.css')
  );

  const cspSource = webview.cspSource;

  html = html
    .replace(/{{scriptUri}}/g, scriptUri.toString())
    .replace(/{{styleUri}}/g, styleUri.toString())
    .replace(/{{cspSource}}/g, cspSource);

  return html;
}

/**
 * Activation de l'extension
 */
// Main activation hook, registers the command and message bridge.
function activate(context) {
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
}

function deactivate() {
  for (const deco of decorationTypes.values()) {
    deco.dispose();
  }
  decorationTypes.clear();
}

module.exports = {
  activate,
  deactivate
};
