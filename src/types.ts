export interface FileInfo {
  path: string;
  relativePath: string;
  lines: number;
  language: string;
  content: string;
}

export type IssueType =
  | 'long_file'
  | 'long_function'
  | 'bad_naming'
  | 'missing_readme'
  | 'missing_comments'
  | 'copy_paste'
  | 'high_complexity';

export interface Issue {
  type: IssueType;
  severity: 'low' | 'medium' | 'high';
  file?: string;
  line?: number;
  description: string;
  snippet?: string;
}

export interface AnalysisResult {
  repoUrl: string;
  repoName: string;
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  files: FileInfo[];
  issues: Issue[];
  stats: {
    avgFileLength: number;
    maxFileLength: number;
    commentRatio: number;
    hasReadme: boolean;
  };
}

export interface Callout {
  title: string;
  description: string;
  file?: string;
  snippet?: string;
}

export interface RoastReport {
  repoName: string;
  roastScore: number;
  summary: string;
  callouts: Callout[];
  verdict: string;
}
