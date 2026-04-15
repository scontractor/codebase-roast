import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { FileInfo, Issue, AnalysisResult } from './types';

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs',
  '.rb', '.php', '.cpp', '.c', '.cs', '.swift', '.kt', '.scala',
  '.vue', '.svelte', '.ex', '.exs',
]);

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out',
  'coverage', 'vendor', '__pycache__', '.pytest_cache', 'target',
  'bin', 'obj', '.gradle', 'Pods', 'venv', '.venv', 'env',
  'bower_components', '.turbo', '.cache', 'public',
]);

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript',
  '.py': 'Python', '.java': 'Java',
  '.go': 'Go', '.rs': 'Rust',
  '.rb': 'Ruby', '.php': 'PHP',
  '.cpp': 'C++', '.c': 'C',
  '.cs': 'C#', '.swift': 'Swift',
  '.kt': 'Kotlin', '.scala': 'Scala',
  '.vue': 'Vue', '.svelte': 'Svelte',
  '.ex': 'Elixir', '.exs': 'Elixir',
};

const LONG_FILE_THRESHOLD = 300;
const VERY_LONG_FILE_THRESHOLD = 600;
const LONG_FUNCTION_THRESHOLD = 50;
const VERY_LONG_FUNCTION_THRESHOLD = 100;
const MAX_NESTING_DEPTH = 5;
const HIGH_CONDITIONAL_COUNT = 30;
const MAX_FILES_TO_ANALYZE = 300;
const MAX_FILE_SIZE_BYTES = 300_000;

export function analyzeRepo(repoPath: string, repoUrl: string): AnalysisResult {
  const repoName = repoUrl
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .split('/')
    .slice(0, 2)
    .join('/');

  const files = scanFiles(repoPath);
  const limitedFiles = files.slice(0, MAX_FILES_TO_ANALYZE);

  const issues: Issue[] = [];

  issues.push(...checkMissingReadme(repoPath));
  issues.push(...checkLongFiles(limitedFiles));
  issues.push(...checkMissingComments(limitedFiles));
  issues.push(...checkCopyPaste(limitedFiles));

  for (const file of limitedFiles) {
    issues.push(...checkLongFunctions(file));
    issues.push(...checkBadNaming(file));
    issues.push(...checkComplexity(file));
  }

  const totalLines = limitedFiles.reduce((sum, f) => sum + f.lines, 0);
  const maxFileLength = limitedFiles.length > 0
    ? Math.max(...limitedFiles.map(f => f.lines))
    : 0;

  const codeFiles = limitedFiles.filter(f => f.lines > 20);
  const filesWithComments = codeFiles.filter(f => hasComments(f.content)).length;
  const commentRatio = codeFiles.length > 0
    ? filesWithComments / codeFiles.length
    : 1;

  const languages: Record<string, number> = {};
  for (const file of limitedFiles) {
    languages[file.language] = (languages[file.language] || 0) + 1;
  }

  return {
    repoUrl,
    repoName,
    totalFiles: limitedFiles.length,
    totalLines,
    languages,
    files: limitedFiles,
    issues,
    stats: {
      avgFileLength: limitedFiles.length > 0
        ? Math.round(totalLines / limitedFiles.length)
        : 0,
      maxFileLength,
      commentRatio,
      hasReadme: !issues.some(i => i.type === 'missing_readme'),
    },
  };
}

function scanFiles(dir: string, base = dir): FileInfo[] {
  const files: FileInfo[] = [];

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry) || entry.startsWith('.')) continue;

    const fullPath = path.join(dir, entry);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      files.push(...scanFiles(fullPath, base));
    } else if (stat.isFile()) {
      const ext = path.extname(entry).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
      if (stat.size > MAX_FILE_SIZE_BYTES) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({
          path: fullPath,
          relativePath: path.relative(base, fullPath).replace(/\\/g, '/'),
          lines: content.split('\n').length,
          language: LANGUAGE_MAP[ext] ?? 'Unknown',
          content,
        });
      } catch {
        // skip unreadable files
      }
    }
  }

  // Sort by line count descending — most interesting files first
  return files.sort((a, b) => b.lines - a.lines);
}

// ─── Individual checks ──────────────────────────────────────────────────────

function checkMissingReadme(repoPath: string): Issue[] {
  const variants = ['README.md', 'readme.md', 'README.MD', 'README.txt', 'README'];
  const hasReadme = variants.some(name =>
    fs.existsSync(path.join(repoPath, name))
  );

  if (!hasReadme) {
    return [{
      type: 'missing_readme',
      severity: 'high',
      description: 'No README.md found. This repo is a black box. Future you (and everyone else) is already crying.',
    }];
  }
  return [];
}

function checkLongFiles(files: FileInfo[]): Issue[] {
  return files
    .filter(f => f.lines > LONG_FILE_THRESHOLD)
    .slice(0, 5)
    .map(f => ({
      type: 'long_file' as const,
      severity: (f.lines > VERY_LONG_FILE_THRESHOLD ? 'high' : 'medium') as Issue['severity'],
      file: f.relativePath,
      description: `\`${f.relativePath}\` is ${f.lines} lines long. The Single Responsibility Principle called — it's sobbing.`,
    }));
}

function checkLongFunctions(file: FileInfo): Issue[] {
  const issues: Issue[] = [];
  const lines = file.content.split('\n');

  // Matches: function foo(), const foo = () =>, foo() { (method), async foo() {
  const FUNC_START = /(?:^|\s)(?:async\s+)?(?:function\s+(\w+)|(?:export\s+)?(?:default\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(?|(?:public|private|protected|static|\s)*(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>[\],\s]+)?\s*\{)/;

  let funcStart = -1;
  let funcName = 'anonymous';
  let depth = 0;
  let inFunc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inFunc) {
      const m = FUNC_START.exec(line);
      if (m) {
        funcName = m[1] ?? m[2] ?? m[3] ?? 'anonymous';
        funcStart = i;
        depth = countChar(line, '{') - countChar(line, '}');
        if (depth > 0) inFunc = true;
      }
    } else {
      depth += countChar(line, '{') - countChar(line, '}');

      if (depth <= 0) {
        const len = i - funcStart + 1;
        if (len > LONG_FUNCTION_THRESHOLD) {
          const severity: Issue['severity'] = len > VERY_LONG_FUNCTION_THRESHOLD ? 'high' : 'medium';
          issues.push({
            type: 'long_function',
            severity,
            file: file.relativePath,
            line: funcStart + 1,
            description: `Function \`${funcName}\` in \`${file.relativePath}\` is ${len} lines long (starts at line ${funcStart + 1}). Have you considered... splitting it up?`,
            snippet: lines.slice(funcStart, Math.min(funcStart + 4, i)).join('\n').slice(0, 200),
          });
        }
        inFunc = false;
        depth = 0;
      }
    }
  }

  return issues.slice(0, 3);
}

function checkBadNaming(file: FileInfo): Issue[] {
  const lines = file.content.split('\n');
  const badNames: string[] = [];

  // Single-letter vars that aren't loop indices
  const SINGLE_LETTER = /\b(?:var|let|const)\s+([a-z])\b\s*[=:]/g;
  // Suspiciously generic names
  const GENERIC_NAME = /\b(?:var|let|const)\s+(temp\d*|tmp\d*|data\d*|info\d*|obj\d*|val\d*|res\d*|stuff\d*|foo\d*|bar\d*|baz\d*|blah\d*)\s*=/gi;

  for (let i = 0; i < Math.min(lines.length, 300); i++) {
    const line = lines[i];

    let m: RegExpExecArray | null;
    SINGLE_LETTER.lastIndex = 0;
    while ((m = SINGLE_LETTER.exec(line)) !== null) {
      const name = m[1];
      if (!['i', 'j', 'k', 'e', 'n', 'm', '_'].includes(name)) {
        badNames.push(`\`${name}\` (line ${i + 1})`);
      }
    }

    GENERIC_NAME.lastIndex = 0;
    while ((m = GENERIC_NAME.exec(line)) !== null) {
      badNames.push(`\`${m[1]}\` (line ${i + 1})`);
    }
  }

  if (badNames.length >= 3) {
    return [{
      type: 'bad_naming',
      severity: 'medium',
      file: file.relativePath,
      description: `\`${file.relativePath}\` has ${badNames.length} suspiciously named variables: ${badNames.slice(0, 4).join(', ')}. Did a cat walk across the keyboard?`,
      snippet: badNames.slice(0, 4).join(', '),
    }];
  }

  return [];
}

function hasComments(content: string): boolean {
  return /\/\/|\/\*|\*\/|#\s|<!--/.test(content);
}

function checkMissingComments(files: FileInfo[]): Issue[] {
  const codeFiles = files.filter(f => f.lines > 20);
  if (codeFiles.length === 0) return [];

  const uncommented = codeFiles.filter(f => !hasComments(f.content));
  const ratio = uncommented.length / codeFiles.length;

  if (ratio < 0.3) return [];

  const severity: Issue['severity'] = ratio > 0.6 ? 'high' : 'medium';
  return [{
    type: 'missing_comments',
    severity,
    description: `${uncommented.length} of ${codeFiles.length} files (${Math.round(ratio * 100)}%) contain zero comments. The code apparently explains itself — telepathically.`,
    snippet: uncommented.slice(0, 3).map(f => f.relativePath).join(', '),
  }];
}

function checkCopyPaste(files: FileInfo[]): Issue[] {
  const candidates = files.filter(f => f.lines > 30).slice(0, 60);
  if (candidates.length < 2) return [];

  const CHUNK_SIZE = 8;
  const STRIDE = 4;

  // hash -> set of files that contain that chunk
  const hashToFiles = new Map<string, Set<string>>();

  for (const file of candidates) {
    const trimmed = file.content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5);

    for (let i = 0; i <= trimmed.length - CHUNK_SIZE; i += STRIDE) {
      const chunk = trimmed.slice(i, i + CHUNK_SIZE).join('\n');
      if (chunk.length < 80) continue;

      const hash = crypto.createHash('md5').update(chunk).digest('hex');
      if (!hashToFiles.has(hash)) hashToFiles.set(hash, new Set());
      hashToFiles.get(hash)!.add(file.relativePath);
    }
  }

  // Count shared chunks between each pair of files
  const pairCounts = new Map<string, number>();

  for (const fileSet of hashToFiles.values()) {
    if (fileSet.size < 2) continue;
    const paths = [...fileSet];
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const key = [paths[i], paths[j]].sort().join('|||');
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const issues: Issue[] = [];
  const top = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  for (const [pair, count] of top) {
    if (count < 3) continue;
    const [file1, file2] = pair.split('|||');
    issues.push({
      type: 'copy_paste',
      severity: count >= 8 ? 'high' : 'medium',
      file: file1,
      description: `Suspicious similarity between \`${file1}\` and \`${file2}\` (${count} matching blocks). Ctrl+C, Ctrl+V is not a design pattern.`,
    });
  }

  return issues;
}

function checkComplexity(file: FileInfo): Issue[] {
  const lines = file.content.split('\n');

  let depth = 0;
  let maxDepth = 0;
  let maxDepthLine = 0;
  let conditionals = 0;

  const CONDITIONAL = /\b(if|else\s+if|for|while|switch|catch|\?\s|\|\||&&)\b/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    depth += countChar(line, '{') - countChar(line, '}');
    depth = Math.max(0, depth);

    if (depth > maxDepth) {
      maxDepth = depth;
      maxDepthLine = i + 1;
    }

    const matches = line.match(CONDITIONAL);
    if (matches) conditionals += matches.length;
  }

  if (maxDepth <= MAX_NESTING_DEPTH && conditionals <= HIGH_CONDITIONAL_COUNT) {
    return [];
  }

  const severity: Issue['severity'] =
    maxDepth > 7 || conditionals > 50 ? 'high' : 'medium';

  const start = Math.max(0, maxDepthLine - 3);
  const snippet = lines.slice(start, start + 5).join('\n').slice(0, 200);

  return [{
    type: 'high_complexity',
    severity,
    file: file.relativePath,
    line: maxDepthLine,
    description: `\`${file.relativePath}\` has a max nesting depth of ${maxDepth} and ${conditionals} conditional branches. This is less code, more labyrinth.`,
    snippet,
  }];
}

function countChar(str: string, ch: string): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ch) count++;
  }
  return count;
}
