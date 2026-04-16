import type { AnalysisResult, Issue, FileInfo } from './types';
import type { GithubFile } from './github';

const LANG_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript',
  '.jsx': 'JavaScript', '.py': 'Python', '.java': 'Java',
  '.go': 'Go', '.rb': 'Ruby', '.rs': 'Rust', '.cpp': 'C++',
  '.c': 'C', '.cs': 'C#', '.php': 'PHP', '.swift': 'Swift',
  '.kt': 'Kotlin', '.scala': 'Scala', '.vue': 'Vue', '.svelte': 'Svelte',
};

function langOf(path: string): string {
  const ext = '.' + path.split('.').pop()?.toLowerCase();
  return LANG_MAP[ext] ?? 'Other';
}

// Simple djb2 hash for copy-paste detection
function hashChunk(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

function checkLongFiles(files: FileInfo[]): Issue[] {
  return files
    .filter(f => f.lines > 300)
    .map(f => ({
      type: 'long_file' as const,
      severity: (f.lines > 600 ? 'high' : 'medium') as Issue['severity'],
      file: f.path,
      description: `${f.path} is ${f.lines} lines long. Single Responsibility Principle filed a missing persons report.`,
    }));
}

function checkLongFunctions(file: FileInfo): Issue[] {
  const issues: Issue[] = [];
  const lines = file.content.split('\n');
  let depth = 0;
  let fnStart = -1;
  let fnName = '';

  const FN_RE = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*\{|def\s+(\w+)|func\s+(\w+))/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    if (depth === 0 && opens > 0) {
      const m = lines.slice(Math.max(0, i - 1), i + 1).join(' ').match(FN_RE);
      fnName = m ? (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? 'anonymous') : 'anonymous';
      fnStart = i;
    }

    depth += opens - closes;

    if (depth <= 0 && fnStart !== -1) {
      const len = i - fnStart + 1;
      if (len > 50) {
        const snippet = lines.slice(fnStart, Math.min(fnStart + 4, lines.length)).join('\n');
        issues.push({
          type: 'long_function',
          severity: len > 100 ? 'high' : 'medium',
          file: file.path,
          line: fnStart + 1,
          description: `Function \`${fnName}\` in ${file.path} is ${len} lines long`,
          snippet,
        });
      }
      depth = 0;
      fnStart = -1;
    }

    if (depth < 0) depth = 0;
  }

  return issues;
}

function checkBadNaming(file: FileInfo): Issue[] {
  const issues: Issue[] = [];
  const lines = file.content.split('\n');
  const SINGLE = /\b(?:var|let|const)\s+([a-zA-Z])\b(?!\s*[=:,)]?\s*(?:for|of|in))/;
  const GENERIC = /\b(?:var|let|const|int|string|bool)\s+(temp|data|obj|foo|bar|baz|test|result|ret|tmp|val|value2|x1|x2)\b/i;

  let reported = 0;
  for (let i = 0; i < lines.length && reported < 3; i++) {
    const line = lines[i];
    if (SINGLE.test(line)) {
      issues.push({
        type: 'bad_naming',
        severity: 'low',
        file: file.path,
        line: i + 1,
        description: `Single-letter variable in ${file.path}:${i + 1}`,
        snippet: line.trim().slice(0, 120),
      });
      reported++;
    } else if (GENERIC.test(line)) {
      issues.push({
        type: 'bad_naming',
        severity: 'low',
        file: file.path,
        line: i + 1,
        description: `Generic variable name in ${file.path}:${i + 1}`,
        snippet: line.trim().slice(0, 120),
      });
      reported++;
    }
  }

  return issues;
}

function checkMissingComments(files: FileInfo[]): Issue | null {
  const eligible = files.filter(f => f.lines > 20);
  if (eligible.length === 0) return null;

  const COMMENT_RE = /(?:\/\/|\/\*|#\s|\*\s|""")/;
  const uncommented = eligible.filter(f => !COMMENT_RE.test(f.content));
  const ratio = uncommented.length / eligible.length;

  if (ratio > 0.3) {
    return {
      type: 'missing_comments',
      severity: ratio > 0.6 ? 'high' : 'medium',
      description: `${Math.round(ratio * 100)}% of files have no comments. Future maintainers will leave passive-aggressive commit messages.`,
    };
  }
  return null;
}

function checkCopyPaste(files: FileInfo[]): Issue[] {
  const CHUNK_LINES = 8;
  const STRIDE = 4;
  const MIN_MATCHES = 3;

  const hashToFiles = new Map<number, string[]>();

  for (const file of files) {
    const lines = file.content.split('\n');
    for (let i = 0; i + CHUNK_LINES <= lines.length; i += STRIDE) {
      const chunk = lines.slice(i, i + CHUNK_LINES).join('\n').trim();
      if (chunk.length < 40) continue;
      const h = hashChunk(chunk);
      const existing = hashToFiles.get(h) ?? [];
      if (!existing.includes(file.path)) existing.push(file.path);
      hashToFiles.set(h, existing);
    }
  }

  const pairs = new Map<string, number>();
  for (const [, fileList] of hashToFiles) {
    if (fileList.length < 2) continue;
    for (let i = 0; i < fileList.length; i++) {
      for (let j = i + 1; j < fileList.length; j++) {
        const key = [fileList[i], fileList[j]].sort().join('|||');
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }

  const issues: Issue[] = [];
  for (const [pair, count] of pairs) {
    if (count >= MIN_MATCHES) {
      const [a, b] = pair.split('|||');
      issues.push({
        type: 'copy_paste',
        severity: count >= 6 ? 'high' : 'medium',
        description: `${a} and ${b} share ${count} duplicate code blocks. Ctrl+V is not an architecture pattern.`,
      });
    }
  }

  return issues.slice(0, 5);
}

function checkComplexity(file: FileInfo): Issue | null {
  const lines = file.content.split('\n');
  let maxDepth = 0;
  let depth = 0;
  let conditionals = 0;

  const COND_RE = /\b(?:if|else|elif|for|while|switch|catch|&&|\|\|)\b/g;

  for (const line of lines) {
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (depth > maxDepth) maxDepth = depth;
    if (depth < 0) depth = 0;
    const m = line.match(COND_RE);
    if (m) conditionals += m.length;
  }

  if (maxDepth >= 6 || conditionals > 40) {
    return {
      type: 'high_complexity',
      severity: maxDepth >= 8 || conditionals > 60 ? 'high' : 'medium',
      file: file.path,
      description: `${file.path}: nesting depth ${maxDepth}, ${conditionals} conditionals. This function could star in a Choose Your Own Adventure novel.`,
    };
  }
  return null;
}

export function analyzeFiles(
  repoName: string,
  rawFiles: GithubFile[],
  hasReadme: boolean
): AnalysisResult {
  const files: FileInfo[] = rawFiles.map(f => ({
    path: f.path,
    content: f.content,
    lines: f.content.split('\n').length,
    language: langOf(f.path),
  }));

  const issues: Issue[] = [];

  issues.push(...checkLongFiles(files));
  for (const f of files) issues.push(...checkLongFunctions(f));
  for (const f of files) issues.push(...checkBadNaming(f));
  if (!hasReadme) {
    issues.push({
      type: 'missing_readme',
      severity: 'medium',
      description: 'No README found. The repo is a mystery box, and not the fun kind.',
    });
  }
  const commentIssue = checkMissingComments(files);
  if (commentIssue) issues.push(commentIssue);
  issues.push(...checkCopyPaste(files));
  for (const f of files) {
    const c = checkComplexity(f);
    if (c) issues.push(c);
  }

  const languages: Record<string, number> = {};
  for (const f of files) languages[f.language] = (languages[f.language] ?? 0) + 1;

  const totalLines = files.reduce((s, f) => s + f.lines, 0);
  const lineCounts = files.map(f => f.lines);

  const eligible = files.filter(f => f.lines > 20);
  const COMMENT_RE = /(?:\/\/|\/\*|#\s|\*\s|""")/;
  const commentRatio = eligible.length
    ? eligible.filter(f => COMMENT_RE.test(f.content)).length / eligible.length
    : 1;

  return {
    repoName,
    totalFiles: files.length,
    totalLines,
    languages,
    issues,
    files: files.map(f => ({ relativePath: f.path, lines: f.lines, language: f.language })),
    stats: {
      avgFileLength: files.length ? Math.round(totalLines / files.length) : 0,
      maxFileLength: lineCounts.length ? Math.max(...lineCounts) : 0,
      hasReadme,
      commentRatio,
    },
  };
}
