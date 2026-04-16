import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { analyzeRepo } from '../analyzer';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRepo(): string {
  return mkdtempSync(join(tmpdir(), 'roast-test-'));
}

function writeFile(repoPath: string, relPath: string, content: string) {
  const full = join(repoPath, relPath);
  mkdirSync(join(repoPath, relPath.split('/').slice(0, -1).join('/')), { recursive: true });
  writeFileSync(full, content);
}

function makeUrl(repoPath: string) {
  return `https://github.com/testorg/testrepo`;
}

let repoPath: string;

beforeEach(() => { repoPath = makeRepo(); });
afterEach(() => { rmSync(repoPath, { recursive: true, force: true }); });

// ── Stats ─────────────────────────────────────────────────────────────────────

describe('analyzeRepo — stats', () => {
  it('counts files and lines correctly', () => {
    // no trailing newline → split('\n').length is exact
    writeFile(repoPath, 'src/a.ts', 'const x = 1;\nconst y = 2;');
    writeFile(repoPath, 'src/b.ts', 'export default {};');
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    expect(result.totalFiles).toBe(2);
    expect(result.totalLines).toBe(3); // 2 + 1
  });

  it('extracts repoName from github URL', () => {
    const result = analyzeRepo(repoPath, 'https://github.com/acme/my-app');
    expect(result.repoName).toBe('acme/my-app');
  });

  it('counts languages', () => {
    writeFile(repoPath, 'a.ts', 'x');
    writeFile(repoPath, 'b.ts', 'x');
    writeFile(repoPath, 'c.py', 'x');
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    expect(result.languages['TypeScript']).toBe(2);
    expect(result.languages['Python']).toBe(1);
  });

  it('skips node_modules and .git directories', () => {
    writeFile(repoPath, 'src/real.ts', 'const x = 1;\n');
    writeFile(repoPath, 'node_modules/pkg/index.js', 'module.exports = {};\n');
    writeFile(repoPath, '.git/config', '[core]\n');
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    expect(result.totalFiles).toBe(1);
  });
});

// ── README ───────────────────────────────────────────────────────────────────

describe('analyzeRepo — README detection', () => {
  it('flags missing README', () => {
    writeFile(repoPath, 'src/index.ts', 'export {};\n');
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    expect(result.stats.hasReadme).toBe(false);
    expect(result.issues.some(i => i.type === 'missing_readme')).toBe(true);
  });

  it('detects README.md', () => {
    writeFile(repoPath, 'README.md', '# Hello\n');
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    expect(result.stats.hasReadme).toBe(true);
    expect(result.issues.some(i => i.type === 'missing_readme')).toBe(false);
  });
});

// ── Long files ───────────────────────────────────────────────────────────────

describe('analyzeRepo — long file detection', () => {
  it('flags files over 300 lines as medium severity', () => {
    const content = Array(310).fill('const x = 1;').join('\n');
    writeFile(repoPath, 'src/big.ts', content);
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    const issue = result.issues.find(i => i.type === 'long_file');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('medium');
  });

  it('flags files over 600 lines as high severity', () => {
    const content = Array(610).fill('const x = 1;').join('\n');
    writeFile(repoPath, 'src/monster.ts', content);
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    const issue = result.issues.find(i => i.type === 'long_file');
    expect(issue!.severity).toBe('high');
  });

  it('does not flag short files', () => {
    writeFile(repoPath, 'src/tiny.ts', 'const x = 1;\n');
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    expect(result.issues.some(i => i.type === 'long_file')).toBe(false);
  });
});

// ── Bad naming ───────────────────────────────────────────────────────────────

describe('analyzeRepo — bad naming', () => {
  it('flags generic variable names', () => {
    const content = [
      'const temp = getValue();',
      'const data = fetch();',
      'const obj = create();',
      'const foo = run();',
    ].join('\n');
    writeFile(repoPath, 'src/names.ts', content);
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    expect(result.issues.some(i => i.type === 'bad_naming')).toBe(true);
  });

  it('does not flag loop index variables i, j, k', () => {
    const content = [
      'for (let i = 0; i < 10; i++) {}',
      'for (let j = 0; j < 10; j++) {}',
      'for (let k = 0; k < 10; k++) {}',
    ].join('\n');
    writeFile(repoPath, 'src/loops.ts', content);
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    expect(result.issues.some(i => i.type === 'bad_naming')).toBe(false);
  });
});

// ── Complexity ───────────────────────────────────────────────────────────────

describe('analyzeRepo — complexity detection', () => {
  it('flags deeply nested code', () => {
    // 6 levels of nesting
    const content = `
function process() {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          if (e) {
            if (f) {
              doSomething();
            }
          }
        }
      }
    }
  }
}`;
    writeFile(repoPath, 'src/maze.ts', content);
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    expect(result.issues.some(i => i.type === 'high_complexity')).toBe(true);
  });

  it('does not flag simple flat code', () => {
    const content = `
function greet(name: string) {
  return 'Hello, ' + name;
}
function add(a: number, b: number) {
  return a + b;
}`;
    writeFile(repoPath, 'src/simple.ts', content);
    const result = analyzeRepo(repoPath, makeUrl(repoPath));
    expect(result.issues.some(i => i.type === 'high_complexity')).toBe(false);
  });
});
