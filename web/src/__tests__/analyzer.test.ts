import { describe, it, expect } from 'vitest';
import { analyzeFiles } from '@/lib/analyzer';

// ── Helpers ──────────────────────────────────────────────────────────────────

const file = (path: string, content: string) => ({ path, content });

// ── Stats ─────────────────────────────────────────────────────────────────────

describe('analyzeFiles — stats', () => {
  it('counts total files and lines', () => {
    // no trailing newline so split('\n').length is exact
    const files = [
      file('src/a.ts', 'const x = 1;\nconst y = 2;'),
      file('src/b.ts', 'export {};'),
    ];
    const result = analyzeFiles('my-repo', files, true);
    expect(result.totalFiles).toBe(2);
    expect(result.totalLines).toBe(3); // 2 + 1
  });

  it('computes average and max file lengths', () => {
    const files = [
      file('a.ts', Array(10).fill('x').join('\n')),
      file('b.ts', Array(30).fill('x').join('\n')),
    ];
    const result = analyzeFiles('repo', files, true);
    expect(result.stats.maxFileLength).toBe(30);
    expect(result.stats.avgFileLength).toBe(20);
  });

  it('counts languages by extension', () => {
    const files = [
      file('a.ts', 'x'), file('b.ts', 'x'), file('c.py', 'x'), file('d.go', 'x'),
    ];
    const result = analyzeFiles('repo', files, true);
    expect(result.languages['TypeScript']).toBe(2);
    expect(result.languages['Python']).toBe(1);
    expect(result.languages['Go']).toBe(1);
  });

  it('handles an empty file list', () => {
    const result = analyzeFiles('empty-repo', [], true);
    expect(result.totalFiles).toBe(0);
    expect(result.totalLines).toBe(0);
    expect(result.stats.avgFileLength).toBe(0);
    expect(result.stats.maxFileLength).toBe(0);
  });
});

// ── README ───────────────────────────────────────────────────────────────────

describe('analyzeFiles — README', () => {
  it('records hasReadme: true when passed true', () => {
    const result = analyzeFiles('repo', [file('src/index.ts', 'x')], true);
    expect(result.stats.hasReadme).toBe(true);
    expect(result.issues.some(i => i.type === 'missing_readme')).toBe(false);
  });

  it('records hasReadme: false and creates an issue when passed false', () => {
    const result = analyzeFiles('repo', [file('src/index.ts', 'x')], false);
    expect(result.stats.hasReadme).toBe(false);
    expect(result.issues.some(i => i.type === 'missing_readme')).toBe(true);
  });
});

// ── Long files ───────────────────────────────────────────────────────────────

describe('analyzeFiles — long file detection', () => {
  it('flags files over 300 lines', () => {
    const content = Array(310).fill('const x = 1;').join('\n');
    const result = analyzeFiles('repo', [file('src/god.ts', content)], true);
    expect(result.issues.some(i => i.type === 'long_file')).toBe(true);
  });

  it('assigns high severity above 600 lines', () => {
    const content = Array(610).fill('const x = 1;').join('\n');
    const result = analyzeFiles('repo', [file('src/beast.ts', content)], true);
    const issue = result.issues.find(i => i.type === 'long_file')!;
    expect(issue.severity).toBe('high');
  });

  it('does not flag files under 300 lines', () => {
    const content = Array(100).fill('const x = 1;').join('\n');
    const result = analyzeFiles('repo', [file('src/fine.ts', content)], true);
    expect(result.issues.some(i => i.type === 'long_file')).toBe(false);
  });
});

// ── Bad naming ───────────────────────────────────────────────────────────────

describe('analyzeFiles — bad naming', () => {
  it('flags single-letter variable names', () => {
    const content = 'const a = 1;\nconst b = 2;\nconst c = 3;\n';
    const result = analyzeFiles('repo', [file('src/x.ts', content)], true);
    expect(result.issues.some(i => i.type === 'bad_naming')).toBe(true);
  });

  it('flags generic names like temp, data, obj', () => {
    const content = 'const temp = 1;\nconst data = 2;\nconst obj = {};\n';
    const result = analyzeFiles('repo', [file('src/y.ts', content)], true);
    expect(result.issues.some(i => i.type === 'bad_naming')).toBe(true);
  });
});

// ── Comments ─────────────────────────────────────────────────────────────────

describe('analyzeFiles — missing comments', () => {
  it('flags repos where more than 30% of files have no comments', () => {
    // 4 files over 20 lines, none with comments
    const bare = Array(25).fill('const x = 1;').join('\n');
    const files = [
      file('a.ts', bare), file('b.ts', bare), file('c.ts', bare), file('d.ts', bare),
    ];
    const result = analyzeFiles('repo', files, true);
    expect(result.issues.some(i => i.type === 'missing_comments')).toBe(true);
  });

  it('does not flag well-commented code', () => {
    const commented = '// This does something\nconst x = 1;\n'.repeat(12);
    const result = analyzeFiles('repo', [file('a.ts', commented)], true);
    expect(result.issues.some(i => i.type === 'missing_comments')).toBe(false);
  });
});

// ── Copy-paste ────────────────────────────────────────────────────────────────

describe('analyzeFiles — copy-paste detection', () => {
  it('flags files with large identical blocks', () => {
    // 40 unique lines so each 8-line chunk gets a distinct hash, giving ≥3 matching pairs
    const sharedBlock = Array.from({ length: 40 }, (_, i) =>
      `processRecord${i}(ctx, record, options);`
    ).join('\n');
    const fileA = `function initA() {\n${sharedBlock}\n}`;
    const fileB = `function initB() {\n${sharedBlock}\n}`;
    const result = analyzeFiles('repo', [file('a.ts', fileA), file('b.ts', fileB)], true);
    expect(result.issues.some(i => i.type === 'copy_paste')).toBe(true);
  });

  it('does not flag completely different files', () => {
    const fileA = Array(40).fill('const alpha = doAlpha();').join('\n');
    const fileB = Array(40).fill('const beta = doBeta();').join('\n');
    const result = analyzeFiles('repo', [file('a.ts', fileA), file('b.ts', fileB)], true);
    expect(result.issues.some(i => i.type === 'copy_paste')).toBe(false);
  });
});

// ── Complexity ────────────────────────────────────────────────────────────────

describe('analyzeFiles — complexity', () => {
  it('flags deeply nested code', () => {
    const content = `
function labyrinth() {
  if (a) { if (b) { if (c) { if (d) { if (e) { if (f) { if (g) {
    doIt();
  } } } } } } }
}`;
    const result = analyzeFiles('repo', [file('src/maze.ts', content)], true);
    expect(result.issues.some(i => i.type === 'high_complexity')).toBe(true);
  });

  it('does not flag flat code', () => {
    const content = `
function add(a, b) { return a + b; }
function sub(a, b) { return a - b; }
function mul(a, b) { return a * b; }`;
    const result = analyzeFiles('repo', [file('src/math.ts', content)], true);
    expect(result.issues.some(i => i.type === 'high_complexity')).toBe(false);
  });
});
