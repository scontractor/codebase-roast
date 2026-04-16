import type { AnalysisResult, RoastReport, Callout } from './types';
import type { WebProvider } from './providers';

export const SYSTEM_PROMPT = `You are a brutally honest, technically sophisticated code reviewer who writes like a stand-up comedian crossed with a grizzled senior engineer. You analyze code quality metrics and produce hilarious but technically accurate roasts of GitHub repositories.

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

export function buildPrompt(analysis: AnalysisResult): string {
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
    for (const [type, issues] of Array.from(byType)) {
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

  parts.push('');
  parts.push('Generate the roast. Be specific, be funny, be technically accurate. Return ONLY the JSON object.');

  return parts.join('\n');
}

export function parseRoastResponse(rawText: string, repoName: string): RoastReport {
  let text = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```$/im, '')
    .trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`The AI ignored the JSON brief and went off-script. We got prose when we needed data. Try again.`);
  }
  text = text.slice(start, end + 1);

  let parsed: { roastScore: number; summary: string; callouts: Callout[]; verdict: string };
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`The AI's JSON is as broken as the code it was analyzing. ${e instanceof Error ? e.message : 'Try again.'}`);
  }

  return {
    repoName,
    roastScore: Math.min(10, Math.max(1, Math.round(Number(parsed.roastScore) || 5))),
    summary: parsed.summary ?? '(no summary)',
    callouts: (parsed.callouts ?? []).slice(0, 5),
    verdict: parsed.verdict ?? '(no verdict)',
  };
}

async function callOpenAI(
  prompt: string,
  apiKey: string,
  baseURL: string,
  model: string
): Promise<string> {
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403)
      throw new Error('Your API key got rejected like a bad pull request. Double-check it and try again.');
    if (response.status === 429)
      throw new Error("You've been throttled. The API gods demand patience. Try again in a moment.");
    if (response.status === 404)
      throw new Error(`Model "${model}" ghosted us — it either doesn't exist or you've misspelled it. Check Advanced Options.`);
    throw new Error(`The API returned ${response.status} — it's not you, it's them. (Probably.) ${body.slice(0, 120)}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content as string) ?? '';
}

async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 401) throw new Error('Anthropic rejected your key. Either it\'s wrong or you\'ve been blacklisted for crimes against code.');
    if (response.status === 429) throw new Error('Anthropic needs a breather. You\'re roasting too aggressively. Try again in a moment.');
    throw new Error(`Anthropic returned ${response.status} — it's not you, it's them. (Probably.) ${body.slice(0, 120)}`);
  }

  const data = await response.json();
  return (
    (data.content as Array<{ type: string; text?: string }>)
      ?.find(c => c.type === 'text')?.text ?? ''
  );
}

/** Calls the server-side /api/roast route — Groq key stays on the server. */
export async function generateRoastDefault(
  analysis: AnalysisResult,
  modelOverride?: string,
): Promise<RoastReport> {
  const res = await fetch('/api/roast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysis, model: modelOverride }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Server error ${res.status}`);
  }
  return (data as { report: RoastReport }).report;
}

export async function generateRoast(
  analysis: AnalysisResult,
  apiKey: string,
  provider: WebProvider,
  modelOverride?: string,
): Promise<RoastReport> {
  const model = modelOverride?.trim() || provider.defaultModel;
  const prompt = buildPrompt(analysis);

  let rawText: string;

  if (provider.format === 'anthropic') {
    rawText = await callAnthropic(prompt, apiKey, model);
  } else {
    const baseURL = provider.id === 'custom'
      ? provider.baseURL
      : provider.baseURL;
    rawText = await callOpenAI(prompt, apiKey, baseURL, model);
  }

  if (!rawText) throw new Error('The model took one look at your code and chose silence. Nothing came back — try again.');

  return parseRoastResponse(rawText, analysis.repoName);
}
