import React, { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { colors } from '../../constants/theme';

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
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generatePlan = useCallback(async () => {
    setIsLoading(true);
    setResult('');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ai/trip-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, country, duration, style }),
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
  }, [city, country, duration, style]);

  if (Platform.OS !== 'web') return null;

  return (
    <div style={{ marginTop: 24 }}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', padding: '16px 20px',
          background: isOpen
            ? 'linear-gradient(135deg, rgba(129,140,248,0.15), rgba(56,189,248,0.15))'
            : 'linear-gradient(135deg, rgba(129,140,248,0.1), rgba(56,189,248,0.1))',
          border: '1px solid rgba(129,140,248,0.25)',
          borderRadius: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'all 0.2s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <span style={{ color: '#C4B5FD', fontSize: 16, fontWeight: 700 }}>Plan My Trip with AI</span>
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {/* Expanded panel */}
      {isOpen && (
        <div style={{
          marginTop: 12, padding: 20,
          backgroundColor: 'rgba(15,23,42,0.6)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, backdropFilter: 'blur(12px)',
        }}>
          {/* Duration picker */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5 }}>Duration</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {DURATIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    backgroundColor: duration === d ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)',
                    border: duration === d ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    color: duration === d ? '#38BDF8' : 'rgba(255,255,255,0.6)',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >{d} days</button>
              ))}
            </div>
          </div>

          {/* Style picker */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5 }}>Travel Style</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    backgroundColor: style === s ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.05)',
                    border: style === s ? '1px solid rgba(129,140,248,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    color: style === s ? '#C4B5FD' : 'rgba(255,255,255,0.6)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    textTransform: 'capitalize' as const,
                  }}
                >{STYLE_EMOJIS[s]} {s}</button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={generatePlan}
            disabled={isLoading}
            style={{
              width: '100%', padding: '14px 0',
              background: isLoading ? 'rgba(129,140,248,0.2)' : 'linear-gradient(135deg, #818CF8, #38BDF8)',
              border: 'none', borderRadius: 12,
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: isLoading ? 'default' : 'pointer',
              boxShadow: isLoading ? 'none' : '0 4px 20px rgba(56,189,248,0.25)',
              transition: 'all 0.2s',
            }}
          >
            {isLoading ? '✨ Generating...' : `✨ Generate ${duration}-Day Itinerary`}
          </button>

          {/* Result */}
          {result && (
            <div style={{
              marginTop: 16, padding: 20,
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
              maxHeight: 500, overflowY: 'auto',
            }}>
              <pre style={{
                margin: 0, color: 'rgba(255,255,255,0.85)',
                fontSize: 14, lineHeight: 1.6,
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                whiteSpace: 'pre-wrap', wordWrap: 'break-word',
              }}>{result}{isLoading ? '▊' : ''}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
