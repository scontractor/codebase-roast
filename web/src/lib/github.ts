const MAX_FILES = 40;
const MAX_FILE_SIZE = 200_000;

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'vendor',
  '__pycache__', '.venv', 'venv', 'coverage', '.nyc_output',
  'target', 'out', 'bin', 'obj', 'pkg', '.gradle', '.idea',
  '.vscode', 'bower_components', '.cache',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go',
  '.rb', '.rs', '.cpp', '.c', '.cs', '.php', '.swift',
  '.kt', '.scala', '.r', '.m', '.lua', '.dart', '.ex',
  '.exs', '.clj', '.hs', '.sh', '.bash', '.vue', '.svelte',
]);

export interface GithubFile {
  path: string;
  content: string;
  size: number;
}

export interface GithubRepoData {
  repoName: string;
  hasReadme: boolean;
  files: GithubFile[];
}

function buildHeaders(githubToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`;
  return headers;
}

function isCodeFile(path: string, size: number): boolean {
  if (size > MAX_FILE_SIZE) return false;
  const parts = path.split('/');
  if (parts.some(p => IGNORE_DIRS.has(p))) return false;
  const ext = '.' + path.split('.').pop()?.toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

export async function fetchRepoData(
  repoUrl: string,
  githubToken?: string
): Promise<GithubRepoData> {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match) throw new Error('Invalid GitHub URL');

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  const headers = buildHeaders(githubToken);
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  // Get default branch
  const repoRes = await fetch(base, { headers });
  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error('Repository not found or is private');
    if (repoRes.status === 403) throw new Error('GitHub rate limit hit — provide a GitHub token to increase limits');
    throw new Error(`GitHub API error: ${repoRes.status}`);
  }
  const repoMeta = await repoRes.json();
  const branch: string = repoMeta.default_branch ?? 'main';

  // Get full tree
  const treeRes = await fetch(`${base}/git/trees/${branch}?recursive=1`, { headers });
  if (!treeRes.ok) throw new Error(`Failed to fetch repository tree: ${treeRes.status}`);
  const treeData = await treeRes.json();

  if (treeData.truncated) {
    console.warn('Repository tree was truncated by GitHub — only partial analysis possible');
  }

  type TreeEntry = { path: string; type: string; sha: string; size: number };
  const allEntries: TreeEntry[] = treeData.tree ?? [];

  const hasReadme = allEntries.some(
    e => e.type === 'blob' && /^readme(\.(md|txt|rst|adoc))?$/i.test(e.path.split('/').pop() ?? '')
  );

  const codeEntries = allEntries
    .filter(e => e.type === 'blob' && isCodeFile(e.path, e.size ?? 0))
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
    .slice(0, MAX_FILES);

  // Fetch file contents in parallel (batched to avoid overwhelming the API)
  const BATCH = 10;
  const files: GithubFile[] = [];

  for (let i = 0; i < codeEntries.length; i += BATCH) {
    const batch = codeEntries.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async entry => {
        try {
          const blobRes = await fetch(`${base}/git/blobs/${entry.sha}`, { headers });
          if (!blobRes.ok) return null;
          const blob = await blobRes.json();
          const content = atob((blob.content as string).replace(/\n/g, ''));
          return { path: entry.path, content, size: entry.size ?? 0 };
        } catch {
          return null;
        }
      })
    );
    files.push(...(results.filter(Boolean) as GithubFile[]));
  }

  return { repoName: `${owner}/${repo}`, hasReadme, files };
}
