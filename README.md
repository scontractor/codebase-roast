> *"If I see one more FactoryFactory interface for a string concatenation, I'm committing arson."*
> — the AI, roasting FizzBuzzEnterpriseEdition, 2025

---

# CODEBASE ROAST 🔥 — Does Your Code Deserve to Burn?

[![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/codebase-roast?color=ff4500)](https://www.npmjs.com/package/codebase-roast)
[![Live Demo](https://img.shields.io/badge/live_demo-vercel-black)](https://codebase-roast.vercel.app)

Paste a GitHub URL. Watch an AI destroy your life choices. Learn something.

Two ways to use it: a **web app** (no install, no key needed) and a **CLI** (runs locally, supports any LLM).

---

## 🌐 Web App — Free, No Setup

**[codebase-roast.vercel.app](https://codebase-roast.vercel.app)**

Powered by Groq on the backend. You don't need an API key. You don't need to install anything. You just need a GitHub URL and the emotional fortitude to read the results.

### How to use it

1. Go to the site
2. Paste a public GitHub repo URL
3. Click **🔥 ROAST THIS REPO**
4. Contemplate your career choices

That's it. The AI does the rest.

### Hit a GitHub rate limit?

The GitHub API allows 60 unauthenticated requests per hour — enough for casual use, not enough if you're roasting your entire portfolio in one sitting.

**Fix:** click **▶ ADVANCED OPTIONS** and paste a GitHub personal access token into the **GITHUB TOKEN** field.

Get one at **github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)**.  
Only the `public_repo` scope is needed. Takes 60 seconds.

### Want to use your own LLM?

Click **▶ USE YOUR OWN API KEY** to pick your provider and bring your own key. Supported: Anthropic, OpenAI, or Groq. Your key is used only in your browser — it never touches the server.

---

## 🖥️ CLI — Local, Flexible, No Browser Required

For when you want to roast repos from your terminal like a grizzled senior engineer.

### Quickstart

```bash
# No install needed
npx codebase-roast https://github.com/owner/repo
```

Set an API key first or it will throw an error and judge you for that too.

### Provider setup

The CLI auto-detects which provider to use based on which key is present in your environment. First match wins.

| Priority | Provider | Environment variable | Default model |
|---|---|---|---|
| ★ 1 | **Groq** ← recommended | `GROQ_API_KEY=gsk_...` | `llama-3.3-70b-versatile` |
| 2 | **Anthropic** | `ANTHROPIC_API_KEY=sk-ant-...` | `claude-opus-4-6` |
| 3 | **OpenAI** | `OPENAI_API_KEY=sk-...` | `gpt-4o` |
| 4 | **Nebius AI Studio** | `NEBIUS_API_KEY=...` | `meta-llama/Meta-Llama-3.1-70B-Instruct-fast` |
| 5 | **Ollama / any OpenAI-compatible** | `LLM_BASE_URL=http://localhost:11434/v1` + `LLM_MODEL=llama3.1` | _(required)_ |

Override the model for any provider with `LLM_MODEL=<model-id>`.

Copy `.env.example` to `.env` and uncomment the block for your provider.

```bash
cp .env.example .env
# edit .env, add your key
npx codebase-roast https://github.com/owner/repo
```

### Local development

```bash
git clone https://github.com/scontractor/codebase-roast
cd codebase-roast
npm install
npm run dev https://github.com/owner/repo   # via ts-node
# or
npm run build && node dist/index.js https://github.com/owner/repo
```

---

## ⚙️ How It Works

Same pipeline whether you use the web app or CLI:

1. **Fetch** — grabs up to 40 of the largest source files (CLI clones via `git clone --depth=1`, web uses the GitHub REST API)
2. **Analyse** — static checks with no LLM involved:
   - Files over 300 lines
   - Functions over 50 lines
   - Bad variable naming (`temp`, `data`, `obj`, single-letter vars outside loops)
   - Missing README
   - Missing comments (flagged when >30% of files have none)
   - Copy-pasted code blocks (chunk hashing across files)
   - High nesting depth / cyclomatic complexity
3. **Roast** — the analysis summary is sent to an LLM, which responds with a JSON roast: score (1–10), callouts, and a final verdict
4. **Report** — CLI renders a colour-coded terminal report and saves a `.md` file; web renders an animated results page with a Share on X button

---

## 🚀 Deploying Your Own Web Instance

If you want your own hosted version:

1. Fork the repo
2. Import it on [vercel.com](https://vercel.com) → set **Root Directory** to `web/`
3. Add one environment variable:
   ```
   GROQ_API_KEY = gsk_...
   ```
4. Deploy

The `GROQ_API_KEY` is server-side only. It never appears in the browser bundle. Users who visit your instance get free roasts courtesy of your Groq account. You've been warned.

---

## 📋 Sample Output (CLI)

```
🔥  codebase-roast — Groq / llama-3.3-70b-versatile
──────────────────────────────────────────────────────

📦  Cloning https://github.com/EnterpriseQualityCoding/FizzBuzzEnterpriseEdition …
    ✓ Cloned

🔍  Analysing codebase …
    ✓ 40 files · 2,731 lines · 18 issues

🎤  Generating roast …
    ✓ Done

ROAST SCORE  2/10  ██░░░░░░░░  ABANDON ALL HOPE

THE ROAST
You've successfully transformed a 5-line script into a 2,700-line enterprise-grade monument
to YAGNI violations. This isn't FizzBuzz — it's a job security scheme written in Java that
makes a simple loop look like a Spring Boot migration.

FINAL VERDICT
"If I see one more FactoryFactory interface for string concatenation, I'm committing arson."
```

---

## 🗂️ Project Structure

```
codebase-roast/
├── src/                     # CLI source (TypeScript)
│   ├── index.ts             # Entry point — args, orchestration, cleanup
│   ├── analyzer.ts          # Static analysis engine
│   ├── roaster.ts           # LLM call + JSON parsing
│   ├── reporter.ts          # Terminal output + markdown report
│   ├── providers.ts         # Auto-detects provider from env vars
│   └── types.ts             # Shared interfaces
├── web/                     # Next.js web app
│   └── src/
│       ├── app/
│       │   ├── page.tsx     # Main UI (form, results, loading)
│       │   └── api/roast/   # Server-side route — Groq key lives here
│       └── lib/             # GitHub API, analyzer, roaster, providers
├── .env.example             # Provider config template (CLI)
└── package.json             # CLI package — bin: codebase-roast
```

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| CLI runtime | Node.js ≥ 18, TypeScript |
| LLM client | OpenAI SDK (OpenAI-compatible, works with Groq/Anthropic/Nebius/Ollama) |
| Git | `simple-git` for shallow cloning |
| Web framework | Next.js 14, React 18, Tailwind CSS |
| Default LLM | Groq — `llama-3.3-70b-versatile` |
| GitHub API | REST (repo tree + file blobs) |
| Tests | Vitest — 63 tests across CLI and web |

---

## 🧪 Tests

```bash
npm test          # CLI — 25 tests (providers, analyzer)
cd web && npm test  # Web — 38 tests (analyzer, roaster, prompt builder)
```

---

## 🪞 Self-Roast

Even this repo has faced the tribunal.

[![Roast Score](https://img.shields.io/badge/roast_score-7%2F10-ff8c00)](https://codebase-roast.vercel.app)

> *"Solid with minor sins — the irony of a code-quality tool with a 300-line analyzer is not lost on this reviewer."*

---

## 🤝 Contributing

PRs welcome. Bad code especially — the test suite needs more victims.

---

## 📄 License

MIT
