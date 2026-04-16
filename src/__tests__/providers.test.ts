import { describe, it, expect, beforeEach } from 'vitest';
import { resolveProvider } from '../providers';

// Save and restore env around each test
beforeEach(() => {
  delete process.env.GROQ_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.NEBIUS_API_KEY;
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_API_KEY;
});

describe('resolveProvider — key detection', () => {
  it('picks Groq when GROQ_API_KEY is set', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    const p = resolveProvider();
    expect(p.providerName).toBe('Groq');
    expect(p.apiKey).toBe('gsk_test');
    expect(p.model).toBe('llama-3.3-70b-versatile');
    expect(p.baseURL).toContain('groq.com');
  });

  it('picks Anthropic when only ANTHROPIC_API_KEY is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const p = resolveProvider();
    expect(p.providerName).toBe('Anthropic');
    expect(p.model).toBe('claude-opus-4-6');
  });

  it('picks OpenAI when only OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const p = resolveProvider();
    expect(p.providerName).toBe('OpenAI');
    expect(p.model).toBe('gpt-4o');
  });

  it('picks Nebius when only NEBIUS_API_KEY is set', () => {
    process.env.NEBIUS_API_KEY = 'v1-test';
    const p = resolveProvider();
    expect(p.providerName).toBe('Nebius AI Studio');
  });

  it('Groq wins over Anthropic when both are set', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(resolveProvider().providerName).toBe('Groq');
  });

  it('custom LLM_BASE_URL wins over all keys', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.LLM_BASE_URL = 'http://localhost:11434/v1';
    process.env.LLM_MODEL = 'llama3.1';
    expect(resolveProvider().providerName).toBe('Custom');
  });

  it('throws a helpful error when nothing is configured', () => {
    expect(() => resolveProvider()).toThrowError(/No LLM provider configured/);
    expect(() => resolveProvider()).toThrowError(/GROQ_API_KEY/);
  });
});

describe('resolveProvider — LLM_MODEL override', () => {
  it('overrides the default model for Groq', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.LLM_MODEL = 'llama-3.1-8b-instant';
    expect(resolveProvider().model).toBe('llama-3.1-8b-instant');
  });

  it('overrides the default model for Anthropic', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.LLM_MODEL = 'claude-haiku-4-5-20251001';
    expect(resolveProvider().model).toBe('claude-haiku-4-5-20251001');
  });
});

describe('resolveProvider — custom endpoint', () => {
  it('throws if LLM_BASE_URL is set without LLM_MODEL', () => {
    process.env.LLM_BASE_URL = 'http://localhost:11434/v1';
    expect(() => resolveProvider()).toThrowError(/LLM_MODEL/);
  });

  it('uses LLM_API_KEY="none" by default for local endpoints', () => {
    process.env.LLM_BASE_URL = 'http://localhost:11434/v1';
    process.env.LLM_MODEL = 'llama3.1';
    expect(resolveProvider().apiKey).toBe('none');
  });

  it('uses provided LLM_API_KEY for authenticated endpoints', () => {
    process.env.LLM_BASE_URL = 'https://my-proxy.example.com/v1';
    process.env.LLM_MODEL = 'gpt-4o';
    process.env.LLM_API_KEY = 'proxy-secret';
    expect(resolveProvider().apiKey).toBe('proxy-secret');
  });
});
