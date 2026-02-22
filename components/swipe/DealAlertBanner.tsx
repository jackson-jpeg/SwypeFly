import React, { useState } from 'react';
import { Platform } from 'react-native';
import { useUIStore } from '../../stores/uiStore';

export function DealAlertBanner() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const departureCode = useUIStore(s => s.departureCode);

  if (Platform.OS !== 'web' || dismissed) return null;

  // Check localStorage to not show again
  if (typeof localStorage !== 'undefined') {
    try {
      if (localStorage.getItem('sogojet-deal-alert-dismissed') === 'true') return null;
    } catch {}
  }

  const handleSubmit = () => {
    if (!email.includes('@')) return;
    // Store locally for now — will integrate with email service later
    try {
      const existing = JSON.parse(localStorage.getItem('sogojet-deal-emails') || '[]');
      existing.push({ email, airport: departureCode, date: new Date().toISOString() });
      localStorage.setItem('sogojet-deal-emails', JSON.stringify(existing));
    } catch {}
    setSubmitted(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem('sogojet-deal-alert-dismissed', 'true'); } catch {}
  };

  if (submitted) {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 40,
        padding: '14px 20px', borderRadius: 16,
        backgroundColor: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        textAlign: 'center',
      }}>
        <span style={{ color: '#4ADE80', fontSize: 14, fontWeight: 600 }}>
          ✅ We'll notify you about deals from {departureCode}!
        </span>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 40,
      padding: '14px 16px', borderRadius: 16,
      backgroundColor: 'rgba(15,23,42,0.9)',
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>🔔 Get deal alerts from {departureCode}</span>
        <span onClick={handleDismiss} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 14, outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSubmit}
          style={{
            padding: '10px 18px', borderRadius: 10,
            backgroundColor: '#38BDF8', border: 'none',
            color: '#0F172A', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >Notify Me</button>
      </div>
    </div>
  );
}
