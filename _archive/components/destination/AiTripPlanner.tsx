import React, { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { colors, textPresets } from '../../constants/theme';

interface AiTripPlannerProps {
  city: string;
  country: string;
}

const DURATIONS = [3, 5, 7] as const;
const STYLES = ['budget', 'comfort', 'luxury'] as const;
const STYLE_EMOJIS: Record<string, string> = { budget: '💰', comfort: '✨', luxury: '👑' };

export function AiTripPlanner({ city, country }: AiTripPlannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [duration, setDuration] = useState<number>(5);
  const [style, setStyle] = useState<string>('comfort');
  const [interests, setInterests] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generatePlan = useCallback(async () => {
    setIsLoading(true);
    setResult('');
    setCopied(false);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, unknown> = { city, country, duration, style };
      if (interests.trim()) body.interests = interests.trim();

      const res = await fetch('/api/ai/trip-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setResult('Failed to generate trip plan. Please try again.');
        setIsLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setResult(text);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setResult('Failed to generate trip plan. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [city, country, duration, style, interests]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = result;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: `${duration}-Day ${city} Trip Plan`,
      text: result,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed — fall back to copy
        handleCopy();
      }
    } else {
      handleCopy();
    }
  }, [result, duration, city, handleCopy]);

  if (Platform.OS !== 'web') return null;

  return (
    <div style={{ marginTop: 24 }}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', padding: '16px 20px',
          background: isOpen
            ? 'rgba(168,196,184,0.15)'
            : 'rgba(168,196,184,0.1)',
          border: `1px solid rgba(168,196,184,0.25)`,
          borderRadius: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'all 0.2s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <span style={{ color: colors.deepDusk, fontSize: 16, fontWeight: 700 }}>Plan My Trip with AI</span>
        </span>
        <span style={{ color: colors.text.muted, fontSize: 14, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {/* Expanded panel */}
      {isOpen && (
        <div style={{
          marginTop: 12, padding: 20,
          backgroundColor: colors.paleHorizon,
          border: `1px solid ${colors.divider}`,
          borderRadius: 16,
        }}>
          {/* Duration picker */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ ...textPresets.body.sectionLabel }}>Duration</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {DURATIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    backgroundColor: duration === d ? 'rgba(168,196,184,0.2)' : colors.duskSand,
                    border: duration === d ? `1px solid rgba(168,196,184,0.4)` : `1px solid ${colors.divider}`,
                    color: duration === d ? colors.deepDusk : colors.text.secondary,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >{d} days</button>
              ))}
            </div>
          </div>

          {/* Style picker */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ ...textPresets.body.sectionLabel }}>Travel Style</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    backgroundColor: style === s ? 'rgba(168,196,184,0.2)' : colors.duskSand,
                    border: style === s ? `1px solid rgba(168,196,184,0.4)` : `1px solid ${colors.divider}`,
                    color: style === s ? colors.deepDusk : colors.text.secondary,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    textTransform: 'capitalize' as const,
                  }}
                >{STYLE_EMOJIS[s]} {s}</button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ ...textPresets.body.sectionLabel }}>Interests (optional)</span>
            <input
              type="text"
              placeholder="e.g. street food, museums, hiking, nightlife..."
              aria-label="Trip interests"
              value={interests}
              onChange={e => setInterests(e.target.value)}
              maxLength={500}
              style={{
                width: '100%', marginTop: 8, padding: '12px 14px',
                backgroundColor: colors.duskSand,
                border: `1px solid ${colors.divider}`,
                borderRadius: 10, color: colors.deepDusk,
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(168,196,184,0.4)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = colors.divider; }}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={generatePlan}
            disabled={isLoading}
            style={{
              width: '100%', padding: '14px 0',
              background: isLoading ? 'rgba(168,196,184,0.3)' : colors.deepDusk,
              border: 'none', borderRadius: 12,
              color: colors.paleHorizon, fontSize: 15, fontWeight: 700, cursor: isLoading ? 'default' : 'pointer',
              boxShadow: isLoading ? 'none' : '0 4px 20px rgba(44,31,26,0.15)',
              transition: 'all 0.2s',
            }}
          >
            {isLoading ? '✨ Generating...' : `✨ Generate ${duration}-Day Itinerary`}
          </button>

          {/* Result */}
          {result && (
            <div style={{ marginTop: 16 }}>
              {/* Copy / Share toolbar */}
              {!isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={handleCopy}
                    aria-label="Copy trip plan to clipboard"
                    style={{
                      padding: '6px 14px', borderRadius: 8,
                      backgroundColor: copied ? colors.successBackground : colors.duskSand,
                      border: copied ? `1px solid ${colors.successBorder}` : `1px solid ${colors.divider}`,
                      color: copied ? colors.sageDrift : colors.text.secondary,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s',
                    }}
                  >
                    {copied ? '✓ Copied' : '📋 Copy'}
                  </button>
                  <button
                    onClick={handleShare}
                    aria-label="Share trip plan"
                    style={{
                      padding: '6px 14px', borderRadius: 8,
                      backgroundColor: colors.duskSand,
                      border: `1px solid ${colors.divider}`,
                      color: colors.text.secondary,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s',
                    }}
                  >
                    📤 Share
                  </button>
                </div>
              )}
              <div style={{
                padding: 20,
                backgroundColor: colors.duskSand,
                borderRadius: 12, border: `1px solid ${colors.divider}`,
                maxHeight: 500, overflowY: 'auto',
              }}>
                <pre style={{
                  margin: 0, color: colors.text.body,
                  fontSize: 14, lineHeight: 1.6,
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  whiteSpace: 'pre-wrap', wordWrap: 'break-word',
                }}>{result}{isLoading ? '▊' : ''}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
