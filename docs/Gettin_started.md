# Démarrage rapide (Getting Started)

Ce guide décrit comment installer et lancer rapidement Pile‑ou‑Face sur une machine de développement. Les commandes ci‑dessous sont des exemples ; adaptez-les selon votre environnement (Linux, macOS, WSL)

---

## Prérequis
- Git
- Python 3.8+ (venv recommandé)
- pip
- make et un compilateur C (gcc/clang) si vous utilisez le backend C
- (Optionnel) Unicorn Engine pour l'émulation
- VS Code pour utiliser l'extension Webview

---

## 1) Cloner le dépôt
```bash
git clone https://github.com/Just3Sandro/Pile_Ou_Face.git
cd Pile_Ou_Face
```

---

## 2) Créer un environnement Python
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
```

---

## 3) Installer les dépendances Python
(Si un fichier requirements.txt existe)
```bash
pip install -r requirements.txt
# Exemple d'installation d'Unicorn si nécessaire :
pip install unicorn
```

---

## 4) Compiler les backends C (si applicable)
Ce dépôt ne contient pas le backend `backend/asm_sim` pour le moment.
Ignorez cette étape si vous n'avez pas ce dossier dans votre version.

---


## 4) Compiler les exemples (C)
Exemple 32 bits (stack3) :
```bash
gcc -m32 -O0 -g -fno-stack-protector -z execstack -no-pie -o examples/stack3.elf examples/stack3.c
```

Exemple 64 bits :
```bash
gcc -m64 -O0 -g -fno-stack-protector -z execstack -no-pie -o examples/stack3_64.elf examples/stack3.c
```

## 5) Générer une trace JSON (exemples)
- A) Simulation à partir d'un fichier ASM (backend de simulation) :
```bash
# exemple : simuler example.asm et produire trace.json
./backend/asm_sim/simulate example.asm -o trace.json
```

- B) Emulation via Unicorn (Python) à partir d'un binaire brut ou ELF (PT_LOAD + ld-linux minimal) :
```bash
python tools/unicorn_trace.py --input ./examples/hello_world.bin --output trace.json
python tools/unicorn_trace.py --input ./examples/hello_world.elf --output trace.json
python tools/unicorn_trace.py --input ./examples/stack3.elf --stdin "AAAA" --output trace.json
```

- B2) Pipeline Unicorn + AST (Python) :
```bash
python tools/run_pipeline.py --binary ./examples/hello_world.bin --source ./examples/demo.py --output output.json
python tools/run_pipeline.py --binary ./examples/hello_world.elf --source ./examples/demo.py --output output.json
python tools/run_pipeline.py --binary ./examples/stack3.elf --stdin "AAAA" --output output.json
```

- C) Mode manuel / exemples
Placez un JSON d'exemple dans `examples/trace_example.json` et ouvrez‑le depuis la Webview.

---

## 6) Lancer l'extension VS Code / Webview
- Ouvrir le dossier du projet dans Visual Studio Code.
- Installer les extensions recommandées si nécessaire.
- Lancer la Webview fournie par l'extension (ou la commande dédiée dans la palette) et charger le fichier `trace.json`.

---

## Commandes utiles
- Recharger le JSON dans la Webview : bouton "Reload" (ou commande dans la palette)
- Navigation : flèches pas‑à‑pas, slider timeline
- Génération de traces : vérifier les scripts dans `tools/`

---

## Exemples et fichiers d'exemple
Ajouter et consulter `examples/` pour :
- Exemples ASM simples
- Binaires compilés d'exemples
- Traces JSON prêtes à l'emploi pour des démonstrations

---

## Dépannage
- Erreurs Python / import : vérifier l'environnement virtuel et les dépendances
- Problèmes de compilation C : vérifier gcc/clang et les flags dans le Makefile
- Trace JSON invalide : valider le format JSON (schema présent dans docs/ si disponible)

python tools/run_pipeline.py   --binary examples/stack3.elf   --stdin "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA│
│AAAA"BBBB"CCCC"   --buffer-offset -64 --buffer-size 64   --output output.json   --start-symbol main   --max-steps 800

# commit message
# feat(unicorn): add minimal ELF loader with PT_INTERP and 32/64 support
# 
# Support ELF 32/64 + PIE via PT_LOAD segments
# Load PT_INTERP (ld-linux) with a minimal auxv/stack setup
# Keep raw binary tracing intact; pipeline auto-detects ELF
# Update getting started doc for new ELF/loader behavior
# perspectives
# 
# Add richer auxv/envp (AT_RANDOM, AT_EXECFN, TLS) for better ld-linux compatibility
# Implement relocation handling (dynamic section) for more real-world ELF support
# Map memory with proper segment permissions (R/W/X) instead of UC_PROT_ALL
# Add configurable interpreter base/argv/env for reproducible traces
