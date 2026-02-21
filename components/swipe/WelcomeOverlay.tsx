import React, { useState } from 'react';
import { Platform } from 'react-native';
import { useUIStore } from '../../stores/uiStore';
import { airports, Airport } from '../../data/airports';
import { colors, radii } from '../../constants/theme';

const TOP_CODES = ['JFK', 'LAX', 'ORD', 'MIA', 'ATL', 'DFW', 'SFO', 'SEA', 'BOS', 'DEN', 'TPA', 'IAH', 'PHX', 'MSP', 'DTW'];
const TOP_AIRPORTS: Airport[] = airports
  .filter((a: Airport) => TOP_CODES.includes(a.code))
  .sort((a: Airport, b: Airport) => a.city.localeCompare(b.city));

export function WelcomeOverlay() {
  const hasOnboarded = useUIStore(s => s.hasOnboarded);
  const setOnboarded = useUIStore(s => s.setOnboarded);
  const setDeparture = useUIStore(s => s.setDeparture);
  const [selectedCode, setSelectedCode] = useState('');

  if (hasOnboarded || Platform.OS !== 'web') return null;

  const handleStart = () => {
    const airport = TOP_AIRPORTS.find((a: Airport) => a.code === selectedCode);
    if (airport) {
      setDeparture(airport.city, airport.code, true);
    }
    setOnboarded();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: -1, marginBottom: 8 }}>
          SoGo<span style={{ color: '#38BDF8' }}>Jet</span> ✈️
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, margin: '0 0 32px 0', lineHeight: 1.5 }}>
          Discover cheap flights to amazing places.<br />Swipe through destinations like TikTok.
        </p>

        {/* Airport picker */}
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600, margin: '0 0 12px 0', textTransform: 'uppercase' as const, letterSpacing: 1 }}>
          Where are you flying from?
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          marginBottom: 32,
        }}>
          {TOP_AIRPORTS.map(airport => (
            <div
              key={airport.code}
              onClick={() => setSelectedCode(airport.code)}
              style={{
                padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
                textAlign: 'center', transition: 'all 0.15s',
                backgroundColor: selectedCode === airport.code ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)',
                border: selectedCode === airport.code ? '1.5px solid #38BDF8' : '1.5px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{airport.code}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{airport.city}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleStart}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 14,
            background: selectedCode ? '#38BDF8' : 'rgba(255,255,255,0.1)',
            border: 'none', color: selectedCode ? '#0F172A' : 'rgba(255,255,255,0.3)',
            fontSize: 18, fontWeight: 700, cursor: selectedCode ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          {selectedCode ? `Find Deals from ${selectedCode} →` : 'Select your airport'}
        </button>

        {/* Skip */}
        <div
          onClick={() => setOnboarded()}
          style={{
            color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 16,
            cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          Skip — detect my location
        </div>
      </div>
    </div>
  );
}
