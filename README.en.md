<div align="center">

<img src="public/logoSmallSombre.png#gh-dark-mode-only" alt="JSON Anonymizer" height="96" />
<img src="public/logoSmallClair.png#gh-light-mode-only" alt="JSON Anonymizer" height="96" />

# JSON Anonymizer

**Anonymize your JSON files in a few clicks — without ever sending them anywhere.**

All processing happens **100% in your browser**: no data ever leaves your machine.

[**▶ Open the app**](https://jlad75.github.io/JSON-Anonymizer/) · [Report a bug](https://github.com/JLAD75/JSON-Anonymizer/issues) · [Contribute](#-contributing)

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)](LICENSE)
[![GitHub Pages deployment](https://img.shields.io/badge/Demo-GitHub%20Pages-8b5cf6.svg)](https://jlad75.github.io/JSON-Anonymizer/)
![React 19](https://img.shields.io/badge/React-19-149eca.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)
![Vite](https://img.shields.io/badge/Vite-⚡-646cff.svg)

🌍 **[Lire en français →](README.md)**

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/screenshot-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/screenshot-light.png" />
  <img src="docs/screenshots/screenshot-light.png" alt="JSON Anonymizer app preview" width="900" />
</picture>

</div>

---

## ✨ Why this tool?

Sharing a JSON dataset for a support ticket, a demo, a test, or a public repository often means stripping out sensitive information first: names, e-mails, company names, amounts… Doing it by hand is tedious and risky.

**JSON Anonymizer** automates this with a 4-step wizard. It **detects fields**, **suggests a type** for each one, **replaces values** with believable fake data, and hands you back a **ready-to-share ZIP archive** — all with no server, no account, no installation.

> 🔒 **Privacy by design.** The app is a static page. Your file is read, analyzed, and transformed in memory, inside the browser tab. Nothing is uploaded, logged, or stored anywhere.

---

## 🎬 At a glance

The wizard walks you through **4 steps**:

| Step | What happens |
| :---: | :--- |
| **1. Upload** | Drag & drop (or pick) your `.json` file. The encoding is auto-detected (UTF-8, UTF-16, Windows-1252/Latin-1). |
| **2. Configure** | Variables are detected and a type is suggested for each. Toggle anonymization field by field, tweak types, set numeric bounds… |
| **3. Process** | The selected values are anonymized locally. A SHA‑256 fingerprint of the file is used as a deterministic seed. |
| **4. Download** | You get a ZIP containing the anonymized JSON **and** the configuration used. A before/after comparator is available. |

---

## 🧠 How it works

### Variable detection

The file is walked recursively and every leaf is grouped by **generic path**: array indices are collapsed into `[]`. That way, a list of 10,000 rows produces **a single variable per field**.

```
client.invoices[].amount       ← one variable, no matter how many invoices
client.invoices[].issuer
manager.email
```

For each variable, the tool keeps track of the detected primitive kind (string, number, boolean, null, mixed), the number of occurrences, a few sample values, and the observed numeric bounds (min/max).

### Automatic type suggestion

The type is guessed from the **field name** (e.g. `prenom`, `raison_sociale`, `email`, `ville`, `nom_complet`…) and, failing that, from the **content** of the samples (a value that looks like `First Last` or an e-mail address). Booleans, identifiers (`id`, `uuid`…), statuses, and dates are left **off by default**. You always have the final say.

### Anonymization strategies

| Type | Strategy |
| :--- | :--- |
| **Numeric** | Generates a number with the **same shape** (same sign, magnitude, and decimal count) but a different value. Optional **min/max bounds** let you draw the value within a range. |
| **Company name** | Replaces it with a randomly drawn fictitious company name. |
| **Last / First name** | Replaces it with a random fake last / first name. |
| **Full name** | Builds a fake "First Last" while **preserving the separator** (space, comma, dash) and the casing. |
| **E-mail** | Forges a `first.last@…` address on a **reserved domain** (`.example`, `.test`, `.invalid` — RFC 2606 / 6761), so it can never be real. |
| **City** | Replaces it with another real French-speaking city (public, non-personal data), casing preserved. |
| **Other** | Substitutes **each character** with another of the same kind (letter/digit), keeping casing, spaces, and punctuation. Ideal for phone numbers, references, codes… |

**Casing** is mirrored for all list-backed types: `PARIS → MARSEILLE`, `paris → marseille`, `Paris → Marseille`.

### The "Other" mode: deterministic and irreversible

The **Other** type deserves a closer look, as it's the "cryptographic" heart of the tool.

On launch, the app computes the **SHA‑256 of the source file**. This fingerprint is used as the **seed** (salt) for a pseudo-random generator (xmur3 + sfc32) that drives the character-by-character substitution. Consequences:

- ♻️ **Intra-file consistency** — two occurrences of the same value always map to the same anonymized value (`+33 6 12 34 56 78` → always the same result within this file).
- 🔁 **Reproducibility** — re-running the anonymization on the same file produces the same result.
- 🚫 **Irreversibility** — without the original document's fingerprint, there's no way back to the initial value. The result is not a mere anagram (you can't "re-sort" the characters to recover the original).
- 🧩 **Preserved silhouette** — spaces and punctuation stay in place: `+33 6 12 34 56 78` → `+87 4 91 03 27 65`.

> ⚠️ List-backed types (last name, first name, city, e-mail…) and the numeric type use a **fresh random draw on every run**: they are intentionally **not** reproducible, to maximize scrambling.

### The output archive

The downloaded ZIP contains:

```
my-file.anonymise.zip
├── my-file.anonymise.json   ← your JSON, anonymized
├── my-file.config.json      ← the applied configuration (type + on/off + bounds)
└── README.txt               ← a reminder of the contents
```

The **configuration file** can be re-imported: drop it in at step 2 to replay the exact same setup on a new file with an identical structure.

---

## 🚀 Getting started

### Use the online app

Nothing to install: **[jlad75.github.io/JSON-Anonymizer](https://jlad75.github.io/JSON-Anonymizer/)**.

### Run it locally

> Requirements: **Node.js 22+** and [**pnpm**](https://pnpm.io/) (the project uses pnpm, but npm/yarn work too).

```bash
# 1. Clone the repo
git clone https://github.com/JLAD75/JSON-Anonymizer.git
cd JSON-Anonymizer

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm dev
# → http://127.0.0.1:5173
```

### Available scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Development server with hot reload. |
| `pnpm build` | Type-check (`tsc`) then production build. |
| `pnpm preview` | Serves the production build locally (port 4173). |
| `pnpm lint` | Static analysis with ESLint. |
| `pnpm smoke` | Node smoke test that replays the anonymization algorithms on the sample dataset. |

A sample dataset is provided in [`sample/jeu-de-test.json`](sample/jeu-de-test.json) so you can try the tool right away.

---

## 🛠️ Tech stack

- **[React 19](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)** (strict mode)
- **[Vite](https://vite.dev/)** for build and dev server
- **[Tailwind CSS v4](https://tailwindcss.com/)** + **[shadcn/ui](https://ui.shadcn.com/)** components on **[Radix UI](https://www.radix-ui.com/)**
- **[Zustand](https://zustand-demo.pmnd.rs/)** for the wizard state
- **[Framer Motion](https://www.framer.com/motion/)** for animations
- **[JSZip](https://stuk.github.io/jszip/)** + **[FileSaver](https://github.com/eligrey/FileSaver.js)** for the ZIP archive
- **[Web Crypto API](https://developer.mozilla.org/docs/Web/API/Web_Crypto_API)** (`crypto.subtle`) for SHA‑256

### Project structure

```
src/
├── components/
│   ├── wizard/        Wizard steps (Upload, Configure, Process, Download…)
│   └── ui/            shadcn/ui components (button, select, switch, tooltip…)
├── lib/
│   ├── anonymizer.ts    Anonymization core (seeded PRNG, per-type strategies)
│   ├── jsonAnalyzer.ts  JSON traversal, variable and type detection
│   ├── textDecoder.ts   Encoding detection (BOM, strict UTF-8, Windows-1252 fallback)
│   ├── fakeData.ts      Fictitious datasets (companies, names, first names, cities…)
│   └── zipExporter.ts   ZIP archive construction
├── store/             Global state (Zustand)
└── types/             Shared types
```

---

## 🤝 Contributing

**Contributions are welcome — this project is open to everyone!** 🎉

Whether you're fixing a typo, improving a detection heuristic, enriching the fake-data lists, or adding a feature, your help is appreciated.

1. **Fork** the repo and create a branch: `git checkout -b my-awesome-improvement`
2. Make your changes, then make sure everything passes:
   ```bash
   pnpm lint && pnpm build && pnpm smoke
   ```
3. Commit and push your branch.
4. Open a **Pull Request** describing your change.

A few improvement ideas: new variable types, internationalization, smarter field detection, additional export formats… Feel free to [open an issue](https://github.com/JLAD75/JSON-Anonymizer/issues) to discuss an idea before diving in.

---

## 📄 License

Released under the **[MIT](LICENSE)** license. You are free to use, modify, and redistribute it.

Copyright © 2026 Jonathan Latgé-Delaite.

---

<div align="center">

Made with ❤️ and a deep respect for your privacy.

🌍 **[Lire en français →](README.md)**

</div>
