import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useUIStore } from '@/stores/uiStore';

const AIRPORTS = [
  { code: 'JFK', city: 'New York' },
  { code: 'LAX', city: 'Los Angeles' },
  { code: 'ORD', city: 'Chicago' },
  { code: 'MIA', city: 'Miami' },
  { code: 'SFO', city: 'San Francisco' },
  { code: 'ATL', city: 'Atlanta' },
  { code: 'DFW', city: 'Dallas' },
  { code: 'BOS', city: 'Boston' },
  { code: 'SEA', city: 'Seattle' },
  { code: 'DEN', city: 'Denver' },
];

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { hasOnboarded } = useUIStore();
  const canGoBack = hasOnboarded;
  const { setDeparture, setOnboarded } = useUIStore();
  const [selectedAirport, setSelectedAirport] = useState(AIRPORTS[0]!);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="screen-fixed" style={{ background: colors.duskSand, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'clip' }}>
      {/* Background photo — 10% opacity */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/images/login-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          opacity: 0.1,
        }}
      />

      {/* Header: Back + Logo */}
      <div style={{ position: 'relative', zIndex: 10, padding: '56px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {canGoBack && <button
            onClick={() => navigate(-1)}
            style={{
              position: 'absolute',
              left: 0,
              width: 36,
              height: 36,
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#C9A99A20',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>}
          <span
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontWeight: 800,
              fontSize: 15,
              lineHeight: '20px',
              textTransform: 'uppercase',
              color: colors.deepDusk,
            }}
          >
            SoGoJet
          </span>
        </div>
        {/* Progress bar — single step, fully filled */}
        <div style={{ paddingTop: 12 }}>
          <div style={{ height: 3, borderRadius: 2, backgroundColor: colors.sageDrift }} />
        </div>
      </div>

      {/* Question */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '40px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <h1
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontWeight: 800,
              fontSize: 32,
              lineHeight: '36px',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              color: colors.deepDusk,
              textAlign: 'center',
              margin: 0,
            }}
          >
            Where are you flying from?
          </h1>
          <p
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              lineHeight: '18px',
              color: colors.borderTint,
              textAlign: 'center',
              margin: 0,
            }}
          >
            Help us personalize your experience
          </p>
        </div>

        {/* Airport selector */}
        <div style={{ width: '100%', position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 56,
              borderRadius: 16,
              backgroundColor: colors.offWhite,
              border: '1px solid #C9A99A40',
              paddingInline: 16,
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 15,
                lineHeight: '18px',
                color: colors.deepDusk,
              }}
            >
              {selectedAirport.code} - {selectedAirport.city}
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.borderTint}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 60,
                left: 0,
                right: 0,
                backgroundColor: colors.offWhite,
                border: '1px solid #C9A99A40',
                borderRadius: 14,
                overflow: 'hidden',
                zIndex: 20,
                maxHeight: 240,
                overflowY: 'auto',
              }}
            >
              {AIRPORTS.map((airport) => (
                <button
                  key={airport.code}
                  onClick={() => {
                    setSelectedAirport(airport);
                    setDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    backgroundColor: airport.code === selectedAirport.code ? '#A8C4B820' : 'transparent',
                    cursor: 'pointer',
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 15,
                    color: colors.deepDusk,
                  }}
                >
                  {airport.code} - {airport.city}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Continue button */}
      <div style={{ position: 'relative', zIndex: 10, padding: '0 20px 40px', marginTop: 'auto' }}>
        <button
          onClick={() => { setDeparture(selectedAirport.city, selectedAirport.code); setOnboarded(); canGoBack ? navigate(-1) : navigate('/'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 56,
            borderRadius: 14,
            backgroundColor: colors.deepDusk,
            border: 'none',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 16,
              fontWeight: 600,
              lineHeight: '20px',
              color: colors.paleHorizon,
            }}
          >
            Continue
          </span>
        </button>
      </div>
    </div>
  );
}
