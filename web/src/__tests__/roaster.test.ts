import { describe, it, expect } from 'vitest';
import { parseRoastResponse, buildPrompt } from '@/lib/roaster';
import type { AnalysisResult } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    repoName: 'acme/test-repo',
    totalFiles: 5,
    totalLines: 200,
    languages: { TypeScript: 4, Python: 1 },
    issues: [],
    files: [{ relativePath: 'src/index.ts', lines: 100, language: 'TypeScript' }],
    stats: { avgFileLength: 40, maxFileLength: 100, hasReadme: true, commentRatio: 0.8 },
    ...overrides,
  };
}

// ── parseRoastResponse ────────────────────────────────────────────────────────

describe('parseRoastResponse — happy path', () => {
  it('parses a complete valid roast', () => {
    const raw = JSON.stringify({
      roastScore: 4,
      summary: 'This codebase is held together with duct tape and prayers.',
      callouts: [{ title: 'God Object', description: 'One class does everything.' }],
      verdict: 'Delete it and start over.',
    });
    const result = parseRoastResponse(raw, 'my/repo');
    expect(result.repoName).toBe('my/repo');
    expect(result.roastScore).toBe(4);
    expect(result.summary).toContain('duct tape');
    expect(result.callouts).toHaveLength(1);
    expect(result.verdict).toBe('Delete it and start over.');
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"roastScore":7,"summary":"ok","callouts":[],"verdict":"fine"}\n```';
    expect(() => parseRoastResponse(raw, 'r')).not.toThrow();
    expect(parseRoastResponse(raw, 'r').roastScore).toBe(7);
  });

  it('extracts JSON embedded in surrounding text', () => {
    const raw = 'Here is the analysis:\n{"roastScore":5,"summary":"meh","callouts":[],"verdict":"whatever"}\nEnd.';
    expect(parseRoastResponse(raw, 'r').roastScore).toBe(5);
  });
});

describe('parseRoastResponse — score clamping', () => {
  it('clamps score above 10 down to 10', () => {
    const raw = JSON.stringify({ roastScore: 99, summary: 'x', callouts: [], verdict: 'y' });
    expect(parseRoastResponse(raw, 'r').roastScore).toBe(10);
  });

  it('clamps score below 1 up to 1', () => {
    const raw = JSON.stringify({ roastScore: -5, summary: 'x', callouts: [], verdict: 'y' });
    expect(parseRoastResponse(raw, 'r').roastScore).toBe(1);
  });

  it('rounds fractional scores', () => {
    const raw = JSON.stringify({ roastScore: 6.7, summary: 'x', callouts: [], verdict: 'y' });
    expect(parseRoastResponse(raw, 'r').roastScore).toBe(7);
  });

  it('defaults to 5 for non-numeric score', () => {
    const raw = JSON.stringify({ roastScore: 'bad', summary: 'x', callouts: [], verdict: 'y' });
    expect(parseRoastResponse(raw, 'r').roastScore).toBe(5);
  });
});

describe('parseRoastResponse — callouts', () => {
  it('limits callouts to 5', () => {
    const callouts = Array(10).fill({ title: 'bad thing', description: 'it is bad' });
    const raw = JSON.stringify({ roastScore: 2, summary: 'x', callouts, verdict: 'y' });
    expect(parseRoastResponse(raw, 'r').callouts).toHaveLength(5);
  });

  it('returns empty array when callouts missing', () => {
    const raw = JSON.stringify({ roastScore: 5, summary: 'x', verdict: 'y' });
    expect(parseRoastResponse(raw, 'r').callouts).toEqual([]);
  });
});

describe('parseRoastResponse — missing fields', () => {
  it('falls back gracefully when summary is missing', () => {
    const raw = JSON.stringify({ roastScore: 5, callouts: [], verdict: 'ok' });
    expect(parseRoastResponse(raw, 'r').summary).toBe('(no summary)');
  });

  it('falls back gracefully when verdict is missing', () => {
    const raw = JSON.stringify({ roastScore: 5, summary: 'fine', callouts: [] });
    expect(parseRoastResponse(raw, 'r').verdict).toBe('(no verdict)');
  });
});

describe('parseRoastResponse — error cases', () => {
  it('throws a funny error when no JSON object found', () => {
    expect(() => parseRoastResponse('just some prose, no JSON here', 'r'))
      .toThrowError(/off-script|JSON/i);
  });

  it('throws a funny error when JSON is malformed', () => {
    expect(() => parseRoastResponse('{roastScore: 5, broken:', 'r'))
      .toThrowError(/broken|AI/i);
  });
});

// ── buildPrompt ───────────────────────────────────────────────────────────────

describe('buildPrompt — structure', () => {
  it('includes the repo name', () => {
    const prompt = buildPrompt(makeAnalysis({ repoName: 'spaghetti-factory/core' }));
    expect(prompt).toContain('spaghetti-factory/core');
  });

  it('includes file and line counts', () => {
    const prompt = buildPrompt(makeAnalysis({ totalFiles: 42, totalLines: 9999 }));
    expect(prompt).toContain('42');
    expect(prompt).toContain('9,999');
  });

  it('highlights missing README loudly', () => {
    const prompt = buildPrompt(makeAnalysis({ stats: { avgFileLength: 40, maxFileLength: 100, hasReadme: false, commentRatio: 0.5 } }));
    expect(prompt).toContain('**NO**');
  });

  it('shows present README normally', () => {
    const prompt = buildPrompt(makeAnalysis());
    expect(prompt).toContain('Yes');
  });

  it('lists the top languages', () => {
    const prompt = buildPrompt(makeAnalysis({ languages: { TypeScript: 10, Python: 3 } }));
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('Python');
  });

  it('includes issue descriptions', () => {
    const analysis = makeAnalysis({
      issues: [{
        type: 'long_file',
        severity: 'high',
        file: 'src/monster.ts',
        description: 'This file has 700 lines of regret.',
      }],
    });
    const prompt = buildPrompt(analysis);
    expect(prompt).toContain('700 lines of regret');
  });

  it('lists the largest files', () => {
    const analysis = makeAnalysis({
      files: [
        { relativePath: 'src/chonky.ts', lines: 800, language: 'TypeScript' },
        { relativePath: 'src/tiny.ts', lines: 5, language: 'TypeScript' },
      ],
    });
    const prompt = buildPrompt(analysis);
    expect(prompt).toContain('chonky.ts');
    expect(prompt).toContain('800');
  });

  it('ends with the roast instruction', () => {
    const prompt = buildPrompt(makeAnalysis());
    expect(prompt).toContain('Return ONLY the JSON object');
  });
});
