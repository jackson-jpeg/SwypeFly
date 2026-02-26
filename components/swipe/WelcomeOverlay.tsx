import React, { useState, useMemo } from 'react';
import { Platform } from 'react-native';
import { useUIStore } from '../../stores/uiStore';
import { airports, Airport } from '../../data/airports';
import { destinations } from '../../data/destinations';
import { colors } from '../../constants/theme';

const TOP_CODES = ['JFK', 'LAX', 'ORD', 'MIA', 'ATL', 'DFW', 'SFO', 'SEA', 'BOS', 'DEN', 'TPA', 'IAH', 'PHX', 'MSP', 'DTW'];
const ALL_TOP_AIRPORTS: Airport[] = airports
  .filter((a: Airport) => TOP_CODES.includes(a.code))
  .sort((a: Airport, b: Airport) => a.city.localeCompare(b.city));

export function WelcomeOverlay() {
  const hasOnboarded = useUIStore(s => s.hasOnboarded);
  const setOnboarded = useUIStore(s => s.setOnboarded);
  const setDeparture = useUIStore(s => s.setDeparture);
  const [selectedCode, setSelectedCode] = useState('');
  const [airportSearch, setAirportSearch] = useState('');

  const filteredAirports = useMemo(() => {
    if (!airportSearch.trim()) return ALL_TOP_AIRPORTS;
    const q = airportSearch.toLowerCase();
    return ALL_TOP_AIRPORTS.filter(a =>
      a.code.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
    );
  }, [airportSearch]);

  // Popular deals preview for selected airport
  const popularDeals = useMemo(() => {
    if (!selectedCode) return [];
    return destinations
      .filter(d => (d.livePrice ?? d.flightPrice) > 0)
      .sort((a, b) => (a.livePrice ?? a.flightPrice) - (b.livePrice ?? b.flightPrice))
      .slice(0, 3);
  }, [selectedCode]);

  if (hasOnboarded || Platform.OS !== 'web') return null;

  const handleStart = () => {
    const airport = ALL_TOP_AIRPORTS.find((a: Airport) => a.code === selectedCode);
    if (airport) {
      setDeparture(airport.city, airport.code, true);
    }
    setOnboarded();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'linear-gradient(135deg, #0a0f1e 0%, #162041 30%, #1a1040 60%, #0f172a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, overflowY: 'auto',
    }}>
      <style>{`
        @keyframes sg-welcome-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes sg-welcome-fade {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sg-welcome-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(56,189,248,0.1); }
          50% { box-shadow: 0 0 40px rgba(56,189,248,0.2); }
        }
        @keyframes sg-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      <div style={{
        textAlign: 'center', maxWidth: 420, width: '100%',
        animation: 'sg-welcome-fade 0.6s ease-out',
      }}>
        {/* Decorative orb */}
        <div style={{
          width: 80, height: 80, borderRadius: 40, margin: '0 auto 20px',
          background: `linear-gradient(135deg, ${colors.primary}, #818CF8, #C084FC)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'sg-welcome-float 3s ease-in-out infinite',
          boxShadow: '0 8px 32px rgba(56,189,248,0.3)',
        }}>
          <span style={{ fontSize: 36 }}>✈️</span>
        </div>

        {/* Logo */}
        <div style={{
          fontSize: 40, fontWeight: 800, color: '#fff', letterSpacing: -1.5, marginBottom: 8,
          background: `linear-gradient(90deg, #fff 0%, ${colors.primary} 50%, #C084FC 100%)`,
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'sg-shimmer 4s linear infinite',
        }}>
          SoGoJet
        </div>
        <p style={{
          color: 'rgba(255,255,255,0.45)', fontSize: 16, margin: '0 0 36px 0', lineHeight: 1.6,
          fontWeight: 400,
        }}>
          Discover incredible flight deals.<br />Swipe through destinations like magic.
        </p>

        {/* Airport picker with search */}
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, margin: '0 0 10px 0', textTransform: 'uppercase' as const, letterSpacing: 1.5 }}>
          Where are you flying from?
        </p>

        {/* Search filter */}
        <input
          type="text"
          placeholder="Search airports..."
          value={airportSearch}
          onChange={e => setAirportSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 16px', marginBottom: 12,
            fontSize: 14, fontWeight: 500,
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, color: '#fff', outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          marginBottom: 24, maxHeight: 240, overflowY: 'auto',
        }}>
          {filteredAirports.map(airport => (
            <button
              key={airport.code}
              onClick={() => setSelectedCode(airport.code)}
              style={{
                padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
                textAlign: 'center', transition: 'all 0.2s', fontFamily: 'inherit',
                backgroundColor: selectedCode === airport.code ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                border: selectedCode === airport.code ? '1.5px solid rgba(56,189,248,0.5)' : '1.5px solid rgba(255,255,255,0.06)',
                animation: selectedCode === airport.code ? 'sg-welcome-glow 2s ease-in-out infinite' : 'none',
              }}
            >
              <div style={{ color: selectedCode === airport.code ? colors.primary : '#fff', fontSize: 15, fontWeight: 700 }}>{airport.code}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{airport.city}</div>
            </button>
          ))}
        </div>

        {/* Popular from airport — preview deals */}
        {selectedCode && popularDeals.length > 0 && (
          <div style={{
            marginBottom: 24, padding: 16, borderRadius: 14,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            animation: 'sg-welcome-fade 0.3s ease-out',
          }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 10 }}>
              🔥 Popular from {selectedCode}
            </div>
            {popularDeals.map(dest => (
              <div key={dest.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
              }}>
                <img src={dest.imageUrl} alt={dest.city} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{dest.city}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginLeft: 6 }}>{dest.country}</span>
                </div>
                <span style={{ color: '#4ADE80', fontSize: 13, fontWeight: 700 }}>${dest.livePrice ?? dest.flightPrice}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={!selectedCode}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 14,
            background: selectedCode
              ? `linear-gradient(135deg, ${colors.primary}, #818CF8)`
              : 'rgba(255,255,255,0.08)',
            border: 'none',
            color: selectedCode ? '#fff' : 'rgba(255,255,255,0.25)',
            fontSize: 18, fontWeight: 700, cursor: selectedCode ? 'pointer' : 'default',
            transition: 'all 0.3s',
            boxShadow: selectedCode ? '0 8px 24px rgba(56,189,248,0.25)' : 'none',
            letterSpacing: -0.3,
          }}
        >
          {selectedCode ? `Explore Deals from ${selectedCode} →` : 'Select your airport'}
        </button>

        {/* Skip */}
        <button
          onClick={() => setOnboarded()}
          style={{
            color: 'rgba(255,255,255,0.25)', fontSize: 13, marginTop: 16,
            cursor: 'pointer', background: 'none', border: 'none',
            fontFamily: 'inherit', padding: 0,
          }}
        >
          Skip — detect my location
        </button>
      </div>
    </div>
  );
}
