import { NextRequest, NextResponse } from 'next/server';
import { buildPrompt, parseRoastResponse, SYSTEM_PROMPT } from '@/lib/roaster';
import type { AnalysisResult } from '@/lib/types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The server left its API key at home. Add GROQ_API_KEY to web/.env.local — or hit '▶ USE YOUR OWN API KEY' and bring your own." },
      { status: 503 }
    );
  }

  let body: { analysis: AnalysisResult; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'The request body arrived more broken than the code you wanted roasted. Try again.' },
      { status: 400 }
    );
  }

  const { analysis, model } = body;
  if (!analysis) {
    return NextResponse.json(
      { error: "You somehow submitted a repo without any analysis data. That's impressively backwards." },
      { status: 400 }
    );
  }

  const effectiveModel = model?.trim() || GROQ_DEFAULT_MODEL;
  const prompt = buildPrompt(analysis);

  const groqRes = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: effectiveModel,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!groqRes.ok) {
    const errBody = await groqRes.text().catch(() => '');
    if (groqRes.status === 429)
      return NextResponse.json(
        { error: "Groq held up a hand and said 'not so fast'. You're roasting too aggressively — rate limited. Give it a few seconds and try again." },
        { status: 429 }
      );
    if (groqRes.status === 404)
      return NextResponse.json(
        { error: `Model '${effectiveModel}' ghosted us. It either doesn't exist or is off crying somewhere.` },
        { status: 502 }
      );
    return NextResponse.json(
      { error: `Groq returned ${groqRes.status} — it's not you, it's them. (Probably.) ${errBody.slice(0, 120)}` },
      { status: 502 }
    );
  }

  const data = await groqRes.json();
  const rawText: string = data.choices?.[0]?.message?.content ?? '';
  if (!rawText) {
    return NextResponse.json(
      { error: 'Groq stared at your code and was speechless. Even the AI has no words. Try again.' },
      { status: 502 }
    );
  }

  try {
    const report = parseRoastResponse(rawText, analysis.repoName);
    return NextResponse.json({ report });
  } catch (err) {
    return NextResponse.json(
      { error: `The AI's JSON is as broken as the code it was roasting. ${err instanceof Error ? err.message : 'Try again.'}` },
      { status: 502 }
    );
  }
}
