/**
 * Provider auto-detection.
 *
 * Priority order (first env var found wins):
 *   1. Explicit override  – LLM_BASE_URL + LLM_MODEL + LLM_API_KEY
 *   2. Groq               – GROQ_API_KEY  ← recommended default (free tier)
 *   3. Anthropic          – ANTHROPIC_API_KEY
 *   4. OpenAI             – OPENAI_API_KEY
 *   5. Nebius             – NEBIUS_API_KEY  (OpenAI-compatible endpoint)
 *   6. Ollama / local     – LLM_BASE_URL alone (no key required)
 *
 * Any provider can be fine-tuned with:
 *   LLM_MODEL   – override the default model for that provider
 */

export interface ProviderConfig {
  /** API key (or the string "none" for unauthenticated local endpoints) */
  apiKey: string;
  /** Base URL for the OpenAI-compatible endpoint */
  baseURL: string;
  /** Model ID to pass in each request */
  model: string;
  /** Human-readable name shown in the CLI */
  providerName: string;
}

// ── Known provider defaults ─────────────────────────────────────────────────

const PROVIDERS: Record<string, Omit<ProviderConfig, 'apiKey'>> = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    providerName: 'Groq',
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    model: 'claude-opus-4-6',
    providerName: 'Anthropic',
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    providerName: 'OpenAI',
  },
  nebius: {
    baseURL: 'https://api.studio.nebius.ai/v1/',
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-fast',
    providerName: 'Nebius AI Studio',
  },
};

// ── Resolution ──────────────────────────────────────────────────────────────

export function resolveProvider(): ProviderConfig {
  const modelOverride = process.env.LLM_MODEL;

  // 1. Fully explicit override (custom or Ollama)
  if (process.env.LLM_BASE_URL) {
    if (!modelOverride) {
      throw new Error(
        'LLM_BASE_URL is set but LLM_MODEL is missing.\n' +
        '  Set LLM_MODEL to the model ID your endpoint expects (e.g. llama3.1).'
      );
    }
    return {
      apiKey: process.env.LLM_API_KEY ?? 'none',
      baseURL: process.env.LLM_BASE_URL,
      model: modelOverride,
      providerName: 'Custom',
    };
  }

  // 2. Groq (recommended — fast, free tier available)
  if (process.env.GROQ_API_KEY) {
    return {
      apiKey: process.env.GROQ_API_KEY,
      ...PROVIDERS.groq,
      model: modelOverride ?? PROVIDERS.groq.model,
    };
  }

  // 3. Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...PROVIDERS.anthropic,
      model: modelOverride ?? PROVIDERS.anthropic.model,
    };
  }

  // 4. OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      ...PROVIDERS.openai,
      model: modelOverride ?? PROVIDERS.openai.model,
    };
  }

  // 5. Nebius
  if (process.env.NEBIUS_API_KEY) {
    return {
      apiKey: process.env.NEBIUS_API_KEY,
      ...PROVIDERS.nebius,
      model: modelOverride ?? PROVIDERS.nebius.model,
    };
  }

  throw new Error(
    'No LLM provider configured. Set one of the following:\n\n' +
    '  Groq       →  GROQ_API_KEY=gsk_...          ← recommended (free tier)\n' +
    '  Anthropic  →  ANTHROPIC_API_KEY=sk-ant-...\n' +
    '  OpenAI     →  OPENAI_API_KEY=sk-...\n' +
    '  Nebius     →  NEBIUS_API_KEY=...\n' +
    '  Ollama     →  LLM_BASE_URL=http://localhost:11434/v1  LLM_MODEL=llama3.1\n' +
    '  Custom     →  LLM_BASE_URL=https://...  LLM_API_KEY=...  LLM_MODEL=...\n\n' +
    'Optional: set LLM_MODEL to override the default model for any provider.'
  );
}
