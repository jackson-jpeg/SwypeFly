import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useUIStore } from '@/stores/uiStore';
import { searchAirports, AIRPORTS, type Airport } from '@/data/airports';

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { hasOnboarded } = useUIStore();
  const canGoBack = hasOnboarded;
  const { setDeparture, setOnboarded } = useUIStore();
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const results = query.trim() ? searchAirports(query, 8) : AIRPORTS.slice(0, 8);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (airport: Airport) => {
    setSelectedAirport(airport);
    setQuery(`${airport.code} - ${airport.city}`);
    setOpen(false);
  };

  const handleContinue = () => {
    if (!selectedAirport) return;
    setDeparture(selectedAirport.city, selectedAirport.code);
    setOnboarded();
    if (canGoBack) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

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
          {canGoBack && (
            <button
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
            </button>
          )}
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
            Search by airport code or city name
          </p>
        </div>

        {/* Airport search input + dropdown */}
        <div ref={dropdownRef} style={{ width: '100%', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 56,
              borderRadius: 16,
              backgroundColor: colors.offWhite,
              border: `1px solid ${open ? colors.sageDrift : '#C9A99A40'}`,
              paddingInline: 16,
              gap: 10,
              transition: 'border-color 0.2s',
            }}
          >
            {/* Search icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Try JFK, London, or LAX..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                if (selectedAirport && e.target.value !== `${selectedAirport.code} - ${selectedAirport.city}`) {
                  setSelectedAirport(null);
                }
              }}
              onFocus={() => setOpen(true)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 15,
                lineHeight: '18px',
                color: colors.deepDusk,
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setSelectedAirport(null); inputRef.current?.focus(); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.borderTint} strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown results */}
          {open && results.length > 0 && (
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
                maxHeight: 280,
                overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              }}
            >
              {results.map((airport) => (
                <button
                  key={airport.code}
                  onClick={() => handleSelect(airport)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    backgroundColor: selectedAirport?.code === airport.code ? '#A8C4B820' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                        fontSize: 14,
                        fontWeight: 700,
                        color: colors.deepDusk,
                        width: 36,
                      }}
                    >
                      {airport.code}
                    </span>
                    <span
                      style={{
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        fontSize: 14,
                        color: colors.bodyText,
                      }}
                    >
                      {airport.city}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 11,
                      color: colors.borderTint,
                    }}
                  >
                    {airport.country}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {open && query.trim() && results.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: 60,
                left: 0,
                right: 0,
                backgroundColor: colors.offWhite,
                border: '1px solid #C9A99A40',
                borderRadius: 14,
                padding: '16px',
                zIndex: 20,
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              }}
            >
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.borderTint }}>
                No airports found for "{query}"
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Continue button */}
      <div style={{ position: 'relative', zIndex: 10, padding: '0 20px 40px', marginTop: 'auto' }}>
        <button
          disabled={!selectedAirport}
          onClick={handleContinue}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 56,
            borderRadius: 14,
            backgroundColor: selectedAirport ? colors.deepDusk : colors.sageDrift,
            border: 'none',
            cursor: selectedAirport ? 'pointer' : 'not-allowed',
            width: '100%',
            opacity: selectedAirport ? 1 : 0.6,
            transition: 'background-color 0.2s, opacity 0.2s',
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
            {selectedAirport ? `Continue from ${selectedAirport.code}` : 'Select an airport'}
          </span>
        </button>
      </div>
    </div>
  );
}
