// scripts/build.js
// Build helper for the native steps binary used by the extension.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const platform = process.platform;  // win32 | linux | darwin
const arch = process.arch;          // x64 | arm64
const outDir = path.join(root, 'bin', `${platform}-${arch}`);
const exeName = platform === 'win32' ? 'steps.exe' : 'steps';
const outPath = path.join(outDir, exeName);

// Pick the first available compiler on this machine.
const candidates = platform === 'win32' ? ['gcc', 'clang'] : ['cc', 'gcc', 'clang'];
let cc = null;
for (const c of candidates) {
  try { execSync(`${c} --version`, { stdio: 'ignore' }); cc = c; break; } catch {}
}
if (!cc) {
  console.error(`Aucun compilateur trouvé (${candidates.join(', ')}). Installe gcc/clang.`);
  process.exit(1);
}

// Compile steps.c into a platform-specific binary.
fs.mkdirSync(outDir, { recursive: true });
const src = path.join(root, 'steps.c');
if (!fs.existsSync(src)) {
  console.error('steps.c introuvable à la racine du projet.');
  process.exit(1);
}

console.log(`Compilation (${cc}) -> ${outPath}`);
execSync(`${cc} -O2 "${src}" -o "${outPath}"`, { stdio: 'inherit' });

if (platform !== 'win32') {
  try { fs.chmodSync(outPath, 0o755); } catch {}
}

console.log('OK');
