'use client';

import { useState, useEffect } from 'react';
import { fetchRepoData } from '@/lib/github';
import { analyzeFiles } from '@/lib/analyzer';
import { generateRoast, generateRoastDefault } from '@/lib/roaster';
import { USER_PROVIDERS } from '@/lib/providers';
import type { WebProvider } from '@/lib/providers';
import type { RoastReport } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'loading' | 'results' | 'error';

interface LoadingStep {
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

// ── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score <= 3) return '#ff2200';
  if (score <= 5) return '#ff4500';
  if (score <= 7) return '#ff8c00';
  return '#a8e63c';
}

function scoreLabel(score: number): string {
  if (score <= 2) return 'ABANDON ALL HOPE';
  if (score <= 4) return 'TECH DEBT LIFESTYLE';
  if (score <= 6) return 'QUESTIONABLE CHOICES';
  if (score <= 8) return 'MINOR SINS';
  return 'SUSPICIOUSLY DECENT';
}

function truncateForTweet(text: string, max = 160): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

// ── Sub-components ─────────────────────────────────────────────────────────

function GlitchText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`glitch ${className}`} data-text={text}>
      {text}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((score / 10) * 100), 100);
    return () => clearTimeout(t);
  }, [score]);
  const color = scoreColor(score);
  return (
    <div className="mt-6">
      <div className="text-center mb-2" style={{ fontSize: '4rem', fontWeight: 700, color, lineHeight: 1 }}>
        {score}<span style={{ fontSize: '1.5rem', color: '#5a4a3e' }}>/10</span>
      </div>
      <div className="text-center mb-3" style={{ color, fontSize: '0.75rem', letterSpacing: '0.2em' }}>
        {scoreLabel(score)}
      </div>
      <div style={{ height: '6px', background: '#1a1a1a', border: '1px solid #2a1a14' }}>
        <div className="score-bar-fill" style={{ height: '100%', width: `${width}%` }} />
      </div>
    </div>
  );
}

function LoadingScreen({ steps }: { steps: LoadingStep[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 400);
    return () => clearInterval(id);
  }, []);
  const dots = '.'.repeat((tick % 3) + 1).padEnd(3, ' ');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="fire-text mb-8" style={{ fontSize: '1.5rem', letterSpacing: '0.15em' }}>
        🔥 ROASTING IN PROGRESS
      </div>
      <div style={{ background: '#0c0c0c', border: '1px solid #1e1414', padding: '1.5rem 2rem', width: '100%', maxWidth: '520px' }}>
        <div style={{ color: '#5a4a3e', fontSize: '0.7rem', marginBottom: '1rem', letterSpacing: '0.1em' }}>
          // codebase-roast v1.0.0
        </div>
        {steps.map((step, i) => {
          const icon = step.status === 'done' ? '✓' : step.status === 'error' ? '✗' : step.status === 'running' ? '>' : '·';
          const color = step.status === 'done' ? '#a8e63c' : step.status === 'error' ? '#ff2200' : step.status === 'running' ? '#ff4500' : '#2a2a2a';
          return (
            <div key={i} style={{ color, fontSize: '0.85rem', marginBottom: '0.5rem', transition: 'color 0.2s' }}>
              <span style={{ marginRight: '0.75rem', display: 'inline-block', width: '1ch' }}>{icon}</span>
              {step.label}
              {step.status === 'running' && <span style={{ color: '#ff4500' }}>{dots}</span>}
            </div>
          );
        })}
        {steps.every(s => s.status === 'done') && (
          <div style={{ color: '#ff4500', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            {'>'} Preparing your sentence<span className="cursor" />
          </div>
        )}
      </div>
      <div style={{ color: '#2a2a2a', fontSize: '0.7rem', marginTop: '2rem' }}>
        This may take 20–30 seconds
      </div>
    </div>
  );
}

function RoastResults({ report, onReset }: { report: RoastReport; onReset: () => void }) {
  const tweetText = encodeURIComponent(
    `🔥 My ${report.repoName} codebase scored ${report.roastScore}/10 on codebase-roast\n\n"${truncateForTweet(report.verdict, 160)}"\n\n`
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

  return (
    <div className="min-h-screen px-4 py-16" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div className="mb-2" style={{ color: '#5a4a3e', fontSize: '0.75rem', letterSpacing: '0.15em' }}>// ROAST COMPLETE</div>
      <h2 className="fire-text mb-8" style={{ fontSize: '1.25rem', letterSpacing: '0.1em', fontWeight: 700 }}>
        {report.repoName}
      </h2>

      <section style={{ background: '#0f0f0f', border: '1px solid #1e1414', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ color: '#5a4a3e', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.25rem' }}>ROAST SCORE</div>
        <ScoreBar score={report.roastScore} />
      </section>

      <section style={{ background: '#0f0f0f', border: '1px solid #1e1414', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ color: '#5a4a3e', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>THE ROAST</div>
        <p style={{ color: '#c8b8a8', fontSize: '0.9rem', lineHeight: 1.7, margin: 0 }}>{report.summary}</p>
      </section>

      {report.callouts.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ color: '#5a4a3e', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>SPECIFIC CALLOUTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {report.callouts.map((c, i) => (
              <div key={i} className="callout-card">
                <div style={{ color: '#ff4500', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                  {i + 1}. {c.title}
                </div>
                {c.file && (
                  <div style={{ color: '#5a4a3e', fontSize: '0.72rem', marginBottom: '0.4rem', fontStyle: 'italic' }}>
                    📁 {c.file}
                  </div>
                )}
                <p style={{ color: '#a89888', fontSize: '0.82rem', lineHeight: 1.65, margin: 0 }}>{c.description}</p>
                {c.snippet && (
                  <pre style={{ marginTop: '0.75rem', background: '#080808', border: '1px solid #1a1a1a', padding: '0.625rem 0.75rem', fontSize: '0.75rem', color: '#7a6a5a', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
                    {c.snippet.slice(0, 300)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ background: '#0f0f0f', border: '1px solid #2a1414', borderLeft: '3px solid #ff2200', padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ color: '#5a4a3e', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>FINAL VERDICT</div>
        <p style={{ color: '#ff4500', fontSize: '1rem', fontStyle: 'italic', lineHeight: 1.7, margin: 0, textShadow: '0 0 8px rgba(255,69,0,0.3)' }}>
          &ldquo;{report.verdict}&rdquo;
        </p>
      </section>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
          <button className="btn-fire-solid">Share on X</button>
        </a>
        <button className="btn-fire" onClick={onReset}>Roast Another</button>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div style={{ color: '#ff2200', fontSize: '1.25rem', marginBottom: '1rem', letterSpacing: '0.1em' }}>✗ ROAST FAILED</div>
      <div style={{ background: '#0c0c0c', border: '1px solid #2a1414', padding: '1.25rem 1.5rem', maxWidth: '520px', width: '100%', color: '#a88878', fontSize: '0.85rem', lineHeight: 1.6 }}>
        {message}
      </div>
      <button className="btn-fire mt-6" onClick={onReset}>Try Again</button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Home() {
  const [stage, setStage] = useState<Stage>('idle');
  const [repoUrl, setRepoUrl] = useState('');
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<WebProvider>(USER_PROVIDERS[0]);
  const [modelOverride, setModelOverride] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [steps, setSteps] = useState<LoadingStep[]>([]);
  const [report, setReport] = useState<RoastReport | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  function updateStep(index: number, status: LoadingStep['status']) {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, status } : s)));
  }

  function handleProviderChange(id: string) {
    const p = USER_PROVIDERS.find(p => p.id === id) ?? USER_PROVIDERS[0];
    setProvider(p);
    setModelOverride('');
    setApiKey('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    if (useOwnKey && !apiKey.trim()) return;

    const initialSteps: LoadingStep[] = [
      { label: 'Fetching repository files', status: 'running' },
      { label: 'Analysing code quality', status: 'pending' },
      {
        label: useOwnKey
          ? `Generating roast via ${provider.name}`
          : 'Generating roast via Groq',
        status: 'pending',
      },
    ];
    setSteps(initialSteps);
    setStage('loading');

    try {
      const repoData = await fetchRepoData(repoUrl.trim(), githubToken.trim() || undefined);
      updateStep(0, 'done');
      updateStep(1, 'running');

      const analysis = analyzeFiles(repoData.repoName, repoData.files, repoData.hasReadme);
      updateStep(1, 'done');
      updateStep(2, 'running');

      const roast = useOwnKey
        ? await generateRoast(analysis, apiKey.trim(), provider, modelOverride || undefined)
        : await generateRoastDefault(analysis, modelOverride || undefined);
      updateStep(2, 'done');

      await new Promise(r => setTimeout(r, 800));
      setReport(roast);
      setStage('results');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStage('error');
    }
  }

  function handleReset() {
    setStage('idle');
    setReport(null);
    setErrorMsg('');
    setSteps([]);
  }

  if (stage === 'loading') return <LoadingScreen steps={steps} />;
  if (stage === 'results' && report) return <RoastResults report={report} onReset={handleReset} />;
  if (stage === 'error') return <ErrorScreen message={errorMsg} onReset={handleReset} />;

  // ── Idle / Landing ───────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-12" style={{ maxWidth: '700px' }}>
        <div style={{ color: '#2a2a2a', fontSize: '0.7rem', letterSpacing: '0.3em', marginBottom: '2rem', textTransform: 'uppercase' }}>
          codebase-roast v1.0
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.01em', marginBottom: '1.5rem', color: '#e0d0c0' }}>
          <GlitchText text="DOES YOUR CODE" />
          <br />
          <span className="fire-text">DESERVE TO BURN?</span>
        </h1>
        <p className="flicker" style={{ color: '#5a4a3e', fontSize: '0.875rem', lineHeight: 1.7, maxWidth: '480px', margin: '0 auto' }}>
          Paste a GitHub repo URL. We&apos;ll analyse the code for sins against engineering
          and deliver a technically accurate, brutally funny roast.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '520px', background: '#0c0c0c', border: '1px solid #1e1414', padding: '2rem' }}>

        {/* Powered by Groq badge / own key section */}
        {!useOwnKey ? (
          <div style={{
            background: 'rgba(168, 230, 60, 0.04)',
            border: '1px solid rgba(168, 230, 60, 0.18)',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ color: '#a8e63c', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em' }}>
                ⚡ POWERED BY GROQ
              </div>
              <div style={{ color: '#5a4a3e', fontSize: '0.67rem', marginTop: '0.2rem' }}>
                Free — no API key needed
              </div>
            </div>
            <div style={{ color: '#3a2a24', fontSize: '0.67rem', textAlign: 'right' }}>
              llama-3.3-70b-versatile
            </div>
          </div>
        ) : (
          <>
            {/* Provider selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', color: '#5a4a3e', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
                LLM PROVIDER
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                {USER_PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    style={{
                      background: provider.id === p.id ? 'rgba(255,69,0,0.15)' : 'transparent',
                      border: `1px solid ${provider.id === p.id ? '#ff4500' : '#1e1414'}`,
                      color: provider.id === p.id ? '#ff4500' : '#5a4a3e',
                      fontFamily: 'inherit',
                      fontSize: '0.65rem',
                      padding: '0.4rem 0.3rem',
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                      transition: 'all 0.15s',
                      lineHeight: 1.3,
                      textAlign: 'center',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="api-key" style={{ display: 'block', color: '#5a4a3e', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
                {provider.keyLabel}
              </label>
              <input
                id="api-key"
                className="roast-input"
                type="password"
                placeholder={provider.keyPlaceholder}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
              <div style={{ marginTop: '0.4rem', fontSize: '0.68rem', color: '#3a2a24', lineHeight: 1.5 }}>
                🔒 Used only in your browser. Never sent to our servers.
              </div>
            </div>
          </>
        )}

        {/* Own key toggle */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => { setUseOwnKey(v => !v); setApiKey(''); }}
            style={{ background: 'none', border: 'none', color: '#3a2a24', fontSize: '0.7rem', cursor: 'pointer', padding: 0, letterSpacing: '0.1em' }}
          >
            {useOwnKey ? '▼ USING YOUR OWN API KEY' : '▶ USE YOUR OWN API KEY'}
          </button>
        </div>

        {/* GitHub URL */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="repo-url" style={{ display: 'block', color: '#5a4a3e', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
            GITHUB REPO URL
          </label>
          <input
            id="repo-url"
            className="roast-input"
            type="url"
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            required
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          style={{ background: 'none', border: 'none', color: '#3a2a24', fontSize: '0.7rem', cursor: 'pointer', padding: 0, letterSpacing: '0.1em', marginBottom: showAdvanced ? '1rem' : '1.5rem' }}
        >
          {showAdvanced ? '▼' : '▶'} ADVANCED OPTIONS
        </button>

        {showAdvanced && (
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#5a4a3e', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
                MODEL <span style={{ color: '#3a2a24' }}>(DEFAULT: {useOwnKey ? provider.defaultModel : 'llama-3.3-70b-versatile'})</span>
              </label>
              <input
                className="roast-input"
                type="text"
                placeholder={useOwnKey ? provider.defaultModel : 'llama-3.3-70b-versatile'}
                value={modelOverride}
                onChange={e => setModelOverride(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#5a4a3e', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
                GITHUB TOKEN <span style={{ color: '#3a2a24' }}>(OPTIONAL — raises rate limits)</span>
              </label>
              <input
                className="roast-input"
                type="password"
                placeholder="ghp_..."
                value={githubToken}
                onChange={e => setGithubToken(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <button
          className="btn-fire-solid"
          type="submit"
          disabled={!repoUrl.trim() || (useOwnKey && !apiKey.trim())}
          style={{ width: '100%' }}
        >
          🔥 ROAST THIS REPO
        </button>
      </form>

      {/* Footer */}
      <div style={{ marginTop: '3rem', color: '#2a2a2a', fontSize: '0.68rem', textAlign: 'center', lineHeight: 1.8 }}>
        <div>Analyses up to 40 largest source files · Public repos only (without GitHub token)</div>
        <div style={{ marginTop: '0.5rem' }}>
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#3a2a24', textDecoration: 'none' }}>get your own groq key (free)</a>
          {' · '}
          <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: '#3a2a24', textDecoration: 'none' }}>anthropic</a>
          {' · '}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: '#3a2a24', textDecoration: 'none' }}>openai</a>
        </div>
      </div>
    </main>
  );
}
