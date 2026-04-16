export type ApiFormat = 'openai' | 'anthropic';

export interface WebProvider {
  id: string;
  name: string;
  baseURL: string;
  defaultModel: string;
  format: ApiFormat;
  keyPlaceholder: string;
  keyLabel: string;
}

export const PROVIDERS: WebProvider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    format: 'openai',
    keyPlaceholder: 'AIza...',
    keyLabel: 'GOOGLE API KEY',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-opus-4-6',
    format: 'anthropic',
    keyPlaceholder: 'sk-ant-...',
    keyLabel: 'ANTHROPIC API KEY',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    format: 'openai',
    keyPlaceholder: 'sk-...',
    keyLabel: 'OPENAI API KEY',
  },
  {
    id: 'groq',
    name: 'Groq (free tier)',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    format: 'openai',
    keyPlaceholder: 'gsk_...',
    keyLabel: 'GROQ API KEY',
  },
  {
    id: 'nebius',
    name: 'Nebius AI Studio',
    baseURL: 'https://api.studio.nebius.ai/v1',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-fast',
    format: 'openai',
    keyPlaceholder: 'v1...',
    keyLabel: 'NEBIUS API KEY',
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    baseURL: '',
    defaultModel: '',
    format: 'openai',
    keyPlaceholder: 'your-api-key',
    keyLabel: 'API KEY',
  },
];

/** Providers available when the user supplies their own API key. */
export const USER_PROVIDERS = PROVIDERS.filter(p =>
  ['anthropic', 'openai', 'groq'].includes(p.id)
);

export const DEFAULT_PROVIDER = PROVIDERS[0]; // Gemini (kept for backwards compat)
