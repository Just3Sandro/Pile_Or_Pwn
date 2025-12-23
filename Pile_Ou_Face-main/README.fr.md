# 🧠 Pile‑ou‑Face
Visualisation interactive de la pile pour la programmation bas‑niveau

Rendre la pile visible, compréhensible et manipulable.

---

## 🚀 Présentation
Pile‑ou‑Face est un outil pédagogique conçu pour aider les développeurs (étudiants en informatique, débutants en assembleur, personnes s'initiant à la rétro‑ingénierie ou à l'exploitation binaire) à visualiser et comprendre le comportement de la pile, des registres CPU et l'exécution instruction par instruction.

L'objectif : transformer des notions abstraites en représentations graphiques claires pour faciliter l'apprentissage (par exemple, comprendre où se trouve `RSP`, comment un débordement écrase `RIP`, etc.).

---

## Table des matières
- [Pourquoi ce projet ?](#pourquoi-ce-projet)
- [Architecture du projet](#architecture-du-projet)
  - [Backends d'analyse (plugables)](#backends-danalyse-plugables)
  - [Format de trace JSON unifié](#format-de-trace-json-unifi%C3%A9)
  - [Frontend — Extension VS Code](#frontend---extension-vs-code)
- [Fonctionnalités](#fonctionnalit%C3%A9s)
- [Cas d'utilisation pédagogique & pwn](#cas-dutilisation-p%C3%A9dagogique--pwn)
- [Technologies](#technologies)
- [Démarrage rapide](#d%C3%A9marrage-rapide)
- [Roadmap](#roadmap)
- [Contribuer](#contribuer)
- [Licence & contact](#licence--contact)

---

## ❓ Pourquoi ce projet ?
- La pile est un concept fondamental mais invisible par nature.
- Les outils existants (GDB, pwndbg, gef) sont puissants mais parfois intimidants pour les débutants.
- Pile‑ou‑Face offre une interface visuelle et pédagogique pour comprendre *pourquoi* le code se comporte ainsi, pas seulement *que* cela se produit.

---

## 🏗️ Architecture du projet
Architecture modulaire et extensible : les moteurs d'exécution (backends) sont découplés de la visualisation.

### 1) Backends d'analyse (plugables)
- ASM Simulation (C)
  - Parse les fichiers `.asm`
  - Simule les instructions (`push`, `pop`, `add`, `call`, `ret`, ...)
  - Produit des instantanés pas à pas de la pile
- Emulation réelle (Python + Unicorn)
  - Emule un CPU x86_64
  - Exécute du vrai code machine
  - Récupère registres et mémoire de la pile, trace instruction par instruction
- Analyse statique (AST — optionnelle)
  - Parse du code source (C / Python)
  - Détection de motifs intéressants ou dangereux
  - Fournit du contexte aux analyses dynamiques

### 2) Format de trace JSON unifié
Tous les backends exportent un JSON commun consommé par le frontend. Exemple :

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

Le frontend reste découplé : tout backend produisant ce format JSON est compatible.

### 3) Frontend — Extension VS Code
- Implémentation via une Webview VS Code
- Affiche :
  - Visualisation graphique de la pile (adresses, valeurs)
  - Registres CPU
  - Instruction courante et surlignage dans la source
- Navigation :
  - Pas à pas avant / arrière
  - Curseur de timeline
  - Reload live du JSON

---

## 🎨 Fonctionnalités principales
- Visualisation graphique de la pile (adresses / valeurs / origine)
- Affichage des registres CPU (RIP, RSP, RBP, ...)
- Surlignage de la ligne ASM / source active
- Navigation pas à pas (avant / arrière / timeline)
- Coloration des valeurs par origine : immédiat, registre, résultat d'opération
- Reload en direct du JSON pour itération rapide
- Visualisation claire des débordements de pile (stack overflows)

---

## 🎯 Cas d'utilisation — Pwn & pédagogie
Outil adapté pour apprendre et démontrer :
- Buffer overflows (stack overflow)
- Disposition des frames de pile (saved RBP, adresse de retour)
- Conventions d'appel (SysV AMD64)
- Calcul des offsets pour exploitation (ex. Protostar Stack0 → Stack4)
- Visualiser comment un écrasement peut modifier le RIP

Pile‑ou‑Face présente la même information que GDB, mais dans un format plus accessible aux débutants.

---

## 🧪 Technologies utilisées
- C — backend de simulation ASM
- Python — orchestration & génération de traces
- Unicorn Engine — émulation CPU
- AST / Python — analyse statique (optionnelle)
- JavaScript / HTML / CSS — frontend (Webview)
- VS Code Extension API

---

## ⚙️ Démarrage rapide
1. Cloner le dépôt :
   - git clone https://github.com/Just3Sandro/Pile_Ou_Face.git
2. Installer les dépendances Python (ex. Unicorn) :
   - pip install -r requirements.txt
3. Compiler le backend C (si nécessaire) :
   - make (ou instructions dans `backend/asm_sim`)
4. Générer / exécuter une trace JSON :
   - python tools/run_emulation.py --input <binaire_ou_asm> --output trace.json
5. Ouvrir le projet dans VS Code et démarrer l'extension / charger la Webview, puis charger `trace.json` pour visualiser.

Ajoutez des exemples dans `examples/` pour partager des cas pédagogiques.

---

## 🛣️ Roadmap (idées)
- Loader ELF minimal
- Résolution de symboles
- Détection automatique d'adresses de retour
- Visualisation ROP / gadgets
- Intégration GDB (MI)
- Support d'architectures supplémentaires (ARM, MIPS)

---

## 🤝 Contribuer
Contributions bienvenues : nouveaux backends, améliorations UI/UX, exemples pédagogiques, documentation, tests.

Processus recommandé :
- Ouvrir une issue pour discuter des changements majeurs
- Créer une branche feature/bugfix
- Soumettre une PR avec description claire des changements

---

## 🧠 Note finale
Pile‑ou‑Face vise à rendre visible ce qui se passe en mémoire. Si l'outil permet à quelqu'un de « voir » la pile pour la première fois, il a atteint son objectif.

---

## 📄 Licence & contact
Licence : (ajouter la licence du projet, ex. MIT)  
Auteur / Contact : Just3Sandro (voir le dépôt GitHub)
