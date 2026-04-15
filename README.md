# codebase-roast 🔥

> Roast any GitHub repository with AI-powered technical humor, backed by Claude.

```
npx codebase-roast https://github.com/owner/repo
```

---

## What it does

1. **Clones** the repo to a temp folder (`--depth=1`)
2. **Analyses** the code for:
   - Very long files (> 300 lines)
   - Very long functions (> 50 lines)
   - Bad or generic variable naming (`temp`, `data`, single-letter vars)
   - Missing README
   - Missing comments (flagged when > 30% of files have none)
   - Copy-pasted code blocks (chunk hashing across files)
   - High cyclomatic complexity / deep nesting
3. **Generates** a funny but technically accurate roast using Claude Opus
4. **Prints** a coloured terminal report and saves a markdown file
5. **Cleans up** the temp folder

## Output

```
🔥  CODEBASE ROAST: owner/repo
────────────────────────────────────────────────────────────

ROAST SCORE
  4/10  ████░░░░░░
  More red flags than a Formula 1 race. Please seek help.

THE ROAST
  This codebase reads like a developer discovered the concept
  of "it works on my machine" and decided to ship it as a
  philosophy. 1,247-line files, zero comments, and enough
  copy-paste to make Ctrl+V file a restraining order.

SPECIFIC CALLOUTS

  1. The Monolith Strikes Back
     📁 src/everything.ts

     At 1,247 lines, this file handles authentication,
     database queries, email sending, and presumably your
     taxes. The Single Responsibility Principle has left
     the chat.

  ...

FINAL VERDICT

  "Sentenced to six months of mandatory refactoring, with
  possible parole if you write at least one comment."
```

A markdown report is also saved as `<repo-name>-roast.md`.

## Setup

Pick **one** provider and export the relevant key, then run:

```bash
npx codebase-roast https://github.com/owner/repo
```

### Providers (first match wins)

| Provider | Environment variable | Default model |
|---|---|---|
| **Anthropic** | `ANTHROPIC_API_KEY=sk-ant-...` | `claude-opus-4-6` |
| **Nebius AI Studio** | `NEBIUS_API_KEY=...` | `meta-llama/Meta-Llama-3.1-70B-Instruct-fast` |
| **OpenAI** | `OPENAI_API_KEY=sk-...` | `gpt-4o` |
| **Ollama / custom** | `LLM_BASE_URL=http://localhost:11434/v1` + `LLM_MODEL=llama3.1` | _(required)_ |

Override the model for any provider with `LLM_MODEL=<model-id>`.

```bash
# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# Nebius AI Studio
export NEBIUS_API_KEY=...

# OpenAI
export OPENAI_API_KEY=sk-...

# Ollama (local)
export LLM_BASE_URL=http://localhost:11434/v1
export LLM_MODEL=llama3.1
```

## Development

```bash
git clone https://github.com/your-username/codebase-roast
cd codebase-roast
npm install
npm run build
node dist/index.js https://github.com/owner/repo
```

Or use `ts-node` for development:

```bash
npm run dev https://github.com/owner/repo
```

## Requirements

- Node.js ≥ 18
- `git` installed and on your PATH
- At least one LLM provider key (see Setup above)

## License

MIT
