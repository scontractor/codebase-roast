#!/usr/bin/env node
import path from 'path';
import os from 'os';
import fs from 'fs';
import { analyzeRepo } from './analyzer';
import { generateRoast, resolveProvider } from './roaster';
import { formatMarkdownReport, printTerminalReport } from './reporter';

const GITHUB_URL_RE = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const rawUrl = args[0].trim().replace(/\/$/, '');

  if (!GITHUB_URL_RE.test(rawUrl)) {
    die(
      'Invalid GitHub URL.\n' +
      '  Expected format: https://github.com/owner/repo\n' +
      `  Got: ${rawUrl}`
    );
  }

  // Validate provider config early — fail fast with a clear message
  let provider;
  try {
    provider = resolveProvider();
  } catch (err) {
    die(errMsg(err));
  }

  // Normalise to bare repo URL (strip any trailing path components after /owner/repo)
  const match = rawUrl.match(GITHUB_URL_RE)!;
  const repoUrl = match[0].replace(/\.git$/, '');

  const tempDir = path.join(os.tmpdir(), `codebase-roast-${Date.now()}`);

  log('');
  log(`🔥  codebase-roast — ${provider!.providerName} / ${provider!.model}`);
  log('─'.repeat(50));
  log('');

  // ── 1. Clone ────────────────────────────────────────────
  log(`📦  Cloning ${repoUrl} …`);

  try {
    const { simpleGit } = await import('simple-git');
    await simpleGit().clone(repoUrl, tempDir, ['--depth=1', '--single-branch']);
    log('    ✓ Cloned');
  } catch (err) {
    cleanup(tempDir);
    die(`Clone failed: ${errMsg(err)}`);
  }

  // ── 2. Analyse ──────────────────────────────────────────
  log('');
  log('🔍  Analysing codebase …');

  let analysis;
  try {
    analysis = analyzeRepo(tempDir, repoUrl);
    log(`    ✓ ${analysis.totalFiles} files · ${analysis.totalLines.toLocaleString()} lines · ${analysis.issues.length} issues`);
  } catch (err) {
    cleanup(tempDir);
    die(`Analysis failed: ${errMsg(err)}`);
  }

  // ── 3. Roast ────────────────────────────────────────────
  log('');
  log('🎤  Generating roast (this may take ~20 s) …');

  let report;
  try {
    report = await generateRoast(analysis!);
    log('    ✓ Roast generated');
  } catch (err) {
    cleanup(tempDir);
    die(`Roast generation failed: ${errMsg(err)}`);
  }

  // ── 4. Clean up ─────────────────────────────────────────
  cleanup(tempDir);
  log('    ✓ Temp files cleaned up');
  log('');

  // ── 5. Print report ─────────────────────────────────────
  printTerminalReport(report!);

  // Save markdown report
  const slug = report!.repoName.replace('/', '-').replace(/[^a-zA-Z0-9-]/g, '');
  const outFile = `${slug}-roast.md`;
  const markdown = formatMarkdownReport(report!);

  try {
    fs.writeFileSync(outFile, markdown, 'utf-8');
    log(`💾  Markdown report saved → ${outFile}`);
    log('');
  } catch {
    // Non-fatal — skip silently if cwd isn't writable
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

function log(msg: string): void {
  process.stdout.write(msg + '\n');
}

function die(msg: string): never {
  process.stderr.write(`\n❌  ${msg}\n\n`);
  process.exit(1);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function printHelp(): void {
  log(`
🔥  codebase-roast — Roast any GitHub repo with AI

USAGE
  npx codebase-roast <github-url>

ARGUMENTS
  github-url    Public GitHub repository URL

PROVIDER (first match wins)
  ANTHROPIC_API_KEY   Anthropic Claude  (https://console.anthropic.com)
  NEBIUS_API_KEY      Nebius AI Studio  (https://studio.nebius.ai)
  OPENAI_API_KEY      OpenAI            (https://platform.openai.com)
  LLM_BASE_URL +      Any OpenAI-compatible endpoint (Ollama, Together AI, etc.)
  LLM_MODEL           LLM_BASE_URL=http://localhost:11434/v1  LLM_MODEL=llama3.1

  LLM_MODEL           Override the default model for any provider

EXAMPLES
  npx codebase-roast https://github.com/expressjs/express
  npx codebase-roast https://github.com/you/your-side-project

WHAT IT CHECKS
  • Very long files (> 300 lines)
  • Very long functions (> 50 lines)
  • Bad / generic variable naming
  • Missing README
  • Missing comments (> 30 % of files)
  • Copy-pasted code blocks
  • High cyclomatic complexity / deep nesting

OUTPUT
  Prints a coloured terminal report, then saves a markdown
  report as <repo-name>-roast.md in the current directory.
`);
}

main().catch(err => die(errMsg(err)));
