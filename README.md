> *"If I see one more FactoryFactory interface for a string concatenation, I'm committing arson."*
> — Claude AI, roasting FizzBuzzEnterpriseEdition, 2025

---

# CODEBASE ROAST 🔥 — Does Your Code Deserve to Burn?

[![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/codebase-roast?color=ff4500)](https://www.npmjs.com/package/codebase-roast)
[![Live Demo](https://img.shields.io/badge/live_demo-vercel-black)](https://codebase-roast.vercel.app)

AI-powered code roasts. Paste a GitHub URL. Get destroyed. Learn something.  
Backed by Claude Opus — the only LLM brave enough to tell you what your tech lead won't.

---

## ✨ Live Demo

**[codebase-roast.vercel.app](https://codebase-roast.vercel.app)** — no install, runs in your browser.

![Screenshot placeholder — add your own after first deploy](https://via.placeholder.com/720x400/080808/ff4500?text=codebase-roast+screenshot)

---

## ⚙️ How It Works

1. **Analyse** — fetches up to 40 source files via the GitHub API and runs static analysis: long files, long functions, bad naming, copy-paste blocks, missing README, missing comments, high nesting complexity
2. **Roast** — sends the analysis to Claude Opus, which responds with a JSON roast: score, callouts, and a savage final sentence
3. **Report** — renders a colour-coded terminal report and saves a markdown file (CLI), or displays an animated results page (web)

---

## 🖥️ CLI

```bash
# Run directly — no install needed
npx codebase-roast https://github.com/owner/repo
```

### Provider setup (first match wins)

| Provider | Environment variable | Default model |
|---|---|---|
| **Anthropic** | `ANTHROPIC_API_KEY=sk-ant-...` | `claude-opus-4-6` |
| **Nebius AI Studio** | `NEBIUS_API_KEY=...` | `meta-llama/Meta-Llama-3.1-70B-Instruct-fast` |
| **OpenAI** | `OPENAI_API_KEY=sk-...` | `gpt-4o` |
| **Ollama / custom** | `LLM_BASE_URL=http://localhost:11434/v1` + `LLM_MODEL=llama3.1` | _(required)_ |

Override the model for any provider with `LLM_MODEL=<model-id>`.

### Development

```bash
git clone https://github.com/your-username/codebase-roast
cd codebase-roast
npm install
npm run build
node dist/index.js https://github.com/owner/repo

# or with ts-node
npm run dev https://github.com/owner/repo
```

---

## 🌐 Web App

The `web/` folder is a Next.js app you can deploy to Vercel in one click.

**Features:** glitchcore UI · browser-side Anthropic API calls (key never leaves your browser) · animated roast progress · Share on X button

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
```

**Deploy to Vercel:** import the repo, set **Root Directory** to `web/`, done.

---

## 📋 Sample Output

```
🔥  codebase-roast — Anthropic / claude-opus-4-6
──────────────────────────────────────────────────

📦  Cloning https://github.com/EnterpriseQualityCoding/FizzBuzzEnterpriseEdition …
    ✓ Cloned

🔍  Analysing codebase …
    ✓ 40 files · 2,731 lines · 18 issues

🎤  Generating roast (this may take ~20 s) …
    ✓ Roast generated
    ✓ Temp files cleaned up
```

### Roast Score

```
2/10  ██░░░░░░░░
ABANDON ALL HOPE
```

### The Roast

> You've successfully transformed a 5-line script into a 2,700-line enterprise-grade monument
> to YAGNI violations. This isn't FizzBuzz; it's a job security scheme written in Java that
> makes a simple loop look like a Spring Boot migration.

### Specific Callouts

**1. Package Naming Nightmares**
📁 `src/main/java/com/seriouscompany/business/java/fizzbuzz/packagenamingpackage/impl/`

com.seriouscompany.business.java.fizzbuzz.packagenamingpackage.impl? Did a committee vote on
this? Your directory structure has more layers than an onion made of bureaucracy.

**2. Strategy Pattern Overdose**

Using a Strategy pattern to decide whether to print 'Fizz' is like hiring a logistics
consultant to mail a postcard.

**3. Documentation Bloat**

100% comment coverage on FizzBuzz implies you're documenting what System.out.println does.

**4. Class Explosion**

89 files for logic that fits in a tweet. Your cyclomatic complexity is low, but your
cognitive load is astronomical.

### Final Verdict

> *"If I see one more FactoryFactory interface for a string concatenation, I'm committing arson."*

---

## 🗂️ Project Structure

```
codebase-roast/
├── src/                        # CLI source (TypeScript/CJS)
│   ├── index.ts                # Entry point — CLI args, orchestration, cleanup
│   ├── analyzer.ts             # Static analysis: long files, functions, naming, copy-paste, complexity
│   ├── roaster.ts              # LLM call (OpenAI-compatible SDK) + JSON parsing
│   ├── reporter.ts             # ANSI terminal output + markdown report generation
│   ├── providers.ts            # Provider auto-detection (Anthropic / Nebius / OpenAI / custom)
│   └── types.ts                # Shared TypeScript interfaces
├── web/                        # Next.js web app
│   └── src/
│       ├── app/                # Next.js App Router (layout, page, globals.css)
│       └── lib/                # Browser-compatible analysis + GitHub API + roaster
├── dist/                       # Compiled CLI output (git-ignored)
├── .env.example                # Provider configuration template
└── package.json                # CLI package — bin: codebase-roast
```

---

## 🛠️ Tech Stack

- **Runtime:** Node.js ≥ 18, TypeScript
- **LLM:** Claude Opus via Anthropic API (or any OpenAI-compatible endpoint)
- **Git:** `simple-git` for shallow cloning
- **Web:** Next.js 14, Tailwind CSS, React 18
- **GitHub API:** REST API for repo tree + file content (web mode)

---

## 🪞 Self-Roast

Even this repo has faced the tribunal.

[![Roast Score](https://img.shields.io/badge/roast_score-7%2F10-ff8c00)](https://codebase-roast.vercel.app)

> *"Solid with minor sins — the irony of a code-quality tool with a 300-line analyzer is not lost on this reviewer."*

---

## 🤝 Contributing

PRs welcome. Bad code especially.

---

## 📄 License

MIT
