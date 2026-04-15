import OpenAI from 'openai';
import type { AnalysisResult, RoastReport, Callout } from './types';
import { resolveProvider } from './providers';

export { resolveProvider };

const SYSTEM_PROMPT = `You are a brutally honest, technically sophisticated code reviewer who writes like a stand-up comedian crossed with a grizzled senior engineer. You analyze code quality metrics and produce hilarious but technically accurate roasts of GitHub repositories.

Your roasts must be:
- Specific to the actual issues found (no generic platitudes)
- Grounded in real engineering concepts: SOLID principles, DRY, complexity theory, maintainability
- Funny enough to make the developer laugh before they cry
- Constructive at heart — the developer should know exactly what to fix
- Developer-culture literate: reference Stack Overflow, tech debt, "it works on my machine", etc.

Respond with ONLY valid JSON — no markdown fences, no preamble, no trailing text. Schema:
{
  "roastScore": <integer 1-10: 1=catastrophe, 10=flawless>,
  "summary": "<2-3 sentence overall roast with a specific technical jab>",
  "callouts": [
    {
      "title": "<short punchy title>",
      "description": "<funny but technically accurate description of why this is a problem and what the ideal looks like>",
      "file": "<file path if specific to one file, otherwise omit>",
      "snippet": "<relevant code snippet if available, otherwise omit>"
    }
  ],
  "verdict": "<one devastating sentence final verdict — the judge delivering the sentence>"
}

Score calibration:
- 9-10: genuinely impressive, hard to roast
- 7-8: solid with minor sins
- 5-6: functional but questionable life choices
- 3-4: tech debt as a lifestyle brand
- 1-2: abandon all hope`;

export async function generateRoast(analysis: AnalysisResult): Promise<RoastReport> {
  const config = resolveProvider();

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const prompt = buildPrompt(analysis);

  const response = await client.chat.completions.create({
    model: config.model,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  const rawText = response.choices[0]?.message?.content?.trim() ?? '';

  if (!rawText) {
    throw new Error(`${config.providerName} returned an empty response`);
  }

  return parseRoastResponse(rawText, analysis.repoName);
}

// ── Response parsing ─────────────────────────────────────────────────────────

function parseRoastResponse(rawText: string, repoName: string): RoastReport {
  // Strip markdown fences if the model wrapped the JSON
  let text = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```$/im, '')
    .trim();

  // Find the outermost JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(
      `Could not find JSON in LLM response.\nRaw output (first 400 chars):\n${rawText.slice(0, 400)}`
    );
  }
  text = text.slice(start, end + 1);

  let parsed: { roastScore: number; summary: string; callouts: Callout[]; verdict: string };
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON from LLM response: ${e instanceof Error ? e.message : String(e)}\n` +
      `Raw JSON attempt (first 400 chars):\n${text.slice(0, 400)}`
    );
  }

  return {
    repoName,
    roastScore: Math.min(10, Math.max(1, Math.round(Number(parsed.roastScore) || 5))),
    summary: parsed.summary ?? '(no summary)',
    callouts: (parsed.callouts ?? []).slice(0, 5),
    verdict: parsed.verdict ?? '(no verdict)',
  };
}

// ── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(analysis: AnalysisResult): string {
  const parts: string[] = [];

  parts.push(`## Repository: ${analysis.repoName}`);
  parts.push('');
  parts.push('### Stats');
  parts.push(`- Files analyzed: ${analysis.totalFiles}`);
  parts.push(`- Total lines of code: ${analysis.totalLines.toLocaleString()}`);
  parts.push(`- Average file length: ${analysis.stats.avgFileLength} lines`);
  parts.push(`- Longest file: ${analysis.stats.maxFileLength} lines`);
  parts.push(`- README present: ${analysis.stats.hasReadme ? 'Yes' : '**NO**'}`);
  parts.push(`- Files with comments: ${Math.round(analysis.stats.commentRatio * 100)}%`);

  const topLanguages = Object.entries(analysis.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, count]) => `${lang} (${count})`)
    .join(', ');
  parts.push(`- Languages: ${topLanguages || 'unknown'}`);

  parts.push('');
  parts.push('### Issues Found');

  if (analysis.issues.length === 0) {
    parts.push('None detected — might actually be decent code.');
  } else {
    const byType = new Map<string, typeof analysis.issues>();
    for (const issue of analysis.issues) {
      if (!byType.has(issue.type)) byType.set(issue.type, []);
      byType.get(issue.type)!.push(issue);
    }

    for (const [type, issues] of byType) {
      const label = type.replace(/_/g, ' ').toUpperCase();
      parts.push(`\n**${label}** (${issues.length} instance${issues.length > 1 ? 's' : ''})`);
      for (const issue of issues.slice(0, 3)) {
        parts.push(`- [${issue.severity}] ${issue.description}`);
        if (issue.snippet) {
          parts.push(`  → \`${issue.snippet.slice(0, 120).replace(/\n/g, ' ↵ ')}\``);
        }
      }
    }
  }

  const longestFiles = [...analysis.files]
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);

  if (longestFiles.length > 0) {
    parts.push('');
    parts.push('### Largest Files');
    for (const f of longestFiles) {
      parts.push(`- \`${f.relativePath}\`: ${f.lines} lines (${f.language})`);
    }
  }

  const fnIssues = analysis.issues
    .filter(i => i.type === 'long_function' && i.snippet)
    .slice(0, 2);

  if (fnIssues.length > 0) {
    parts.push('');
    parts.push('### Sample Code (worst offenders)');
    for (const issue of fnIssues) {
      parts.push(`**${issue.file ?? ''}** (line ${issue.line ?? '?'}):`);
      parts.push('```');
      parts.push(issue.snippet!.slice(0, 300));
      parts.push('```');
    }
  }

  parts.push('');
  parts.push('Generate the roast. Be specific, be funny, be technically accurate. Return ONLY the JSON object.');

  return parts.join('\n');
}
