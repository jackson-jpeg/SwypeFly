import { useState } from 'react';
import { Platform, View, Text } from 'react-native';
import { router } from 'expo-router';
import { useUIStore } from '../stores/uiStore';
import { colors } from '../constants/theme';
import { API_BASE } from '../services/apiHelpers';

export default function SubscribePage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const departureCode = useUIStore(s => s.departureCode);

  const handleSubmit = async () => {
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, airport: departureCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Something went wrong' }));
        setError(data.error || 'Something went wrong');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  if (Platform.OS !== 'web') return null;

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#0F172A',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <button
        onClick={() => router.back()}
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 50,
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.1)', border: 'none',
          color: 'rgba(255,255,255,0.6)', fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>

      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        {submitted ? (
          <>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 8px 0' }}>You're in!</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, margin: '0 0 24px 0' }}>
              We'll send you the best deals from {departureCode} every week.
            </p>
            <button
              onClick={() => router.replace('/')}
              style={{
                padding: '14px 28px', borderRadius: 9999,
                backgroundColor: colors.primary, border: 'none',
                color: '#0F172A', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >Back to Exploring</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✈️</div>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 8px 0' }}>
              Get Weekly Deal Alerts
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, margin: '0 0 32px 0', lineHeight: 1.5 }}>
              The cheapest flights from {departureCode} delivered to your inbox every week. No spam, just deals.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{
                  flex: 1, padding: '14px 18px', borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: 16, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  padding: '14px 24px', borderRadius: 14,
                  backgroundColor: loading ? 'rgba(56,189,248,0.5)' : colors.primary, border: 'none',
                  color: '#0F172A', fontSize: 16, fontWeight: 700,
                  cursor: loading ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: loading ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                }}
              >{loading ? 'Subscribing...' : 'Subscribe'}</button>
            </div>
            {error && (
              <p style={{ color: '#EF4444', fontSize: 13, margin: '12px 0 0 0' }}>
                {error}
              </p>
            )}
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, margin: '16px 0 0 0' }}>
              Unsubscribe anytime. We respect your inbox.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
