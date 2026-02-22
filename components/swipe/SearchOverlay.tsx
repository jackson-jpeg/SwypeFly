import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { destinations } from '../../data/destinations';
import { useUIStore } from '../../stores/uiStore';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';

interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export function SearchOverlay({ visible, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState(2000);
  const inputRef = useRef<HTMLInputElement>(null);
  const departureCode = useUIStore(s => s.departureCode);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback((val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 150);
  }, []);

  useEffect(() => {
    if (visible && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!visible) { setQuery(''); setDebouncedQuery(''); }
  }, [visible]);

  // Close on Escape
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    return destinations
      .filter(d => {
        const price = d.livePrice ?? d.flightPrice;
        return price <= maxPrice && (
          d.city.toLowerCase().includes(q) ||
          d.country.toLowerCase().includes(q) ||
          d.vibeTags.some(t => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (a.livePrice ?? a.flightPrice) - (b.livePrice ?? b.flightPrice))
      .slice(0, 10);
  }, [debouncedQuery, maxPrice]);

  if (!visible || Platform.OS !== 'web') return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', paddingTop: 80,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Search input */}
      <div style={{ width: '90%', maxWidth: 500 }}>
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search cities, countries, vibes..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            style={{
              width: '100%', padding: '16px 20px 16px 48px',
              fontSize: 18, fontWeight: 500,
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 16, color: '#fff',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <span style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            fontSize: 20, opacity: 0.5,
          }}>🔍</span>
        </div>

        {/* Budget slider */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>💰 Max</span>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={maxPrice}
            onChange={e => setMaxPrice(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#38BDF8' }}
          />
          <span style={{
            color: maxPrice < 2000 ? '#38BDF8' : 'rgba(255,255,255,0.4)',
            fontSize: 14, fontWeight: 700, minWidth: 50, textAlign: 'right',
          }}>
            {maxPrice < 2000 ? `$${maxPrice}` : 'Any'}
          </span>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {results.map((dest) => (
              <div
                key={dest.id}
                onClick={() => {
                  onClose();
                  router.push(`/destination/${dest.id}`);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', cursor: 'pointer',
                  borderRadius: 12, marginBottom: 4,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <img
                  src={dest.imageUrl}
                  alt={dest.city}
                  style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover' }}
                />
                <div>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
                    {dest.city}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500 }}>
                    {dest.country} · {dest.vibeTags.slice(0, 2).join(', ')}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', color: '#38BDF8', fontSize: 15, fontWeight: 700 }}>
                  ${dest.flightPrice}
                </div>
              </div>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginTop: 40, fontSize: 16 }}>
            No destinations found for "{query}"
          </div>
        )}

        {!query.trim() && (
          <div style={{ marginTop: 32 }}>
            {/* Surprise Me */}
            <button
              onClick={() => {
                const rand = destinations[Math.floor(Math.random() * destinations.length)];
                onClose();
                router.push(`/destination/${rand.id}`);
              }}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 14, marginBottom: 24,
                background: 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(168,85,247,0.15) 100%)',
                border: '1px solid rgba(56,189,248,0.2)',
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              🎲 Surprise Me
            </button>

            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 12 }}>
              Explore by vibe
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { emoji: '🏖️', label: 'Beach' },
                { emoji: '🏔️', label: 'Mountain' },
                { emoji: '🌃', label: 'City' },
                { emoji: '💕', label: 'Romantic' },
                { emoji: '🍜', label: 'Foodie' },
                { emoji: '🎉', label: 'Nightlife' },
                { emoji: '🏛️', label: 'Historic' },
                { emoji: '🌴', label: 'Tropical' },
                { emoji: '🎿', label: 'Winter' },
                { emoji: '💰', label: 'Budget' },
                { emoji: '⛰️', label: 'Nature' },
                { emoji: '🧗', label: 'Adventure' },
              ].map(({ emoji, label }) => (
                <div
                  key={label}
                  onClick={() => setQuery(label.toLowerCase())}
                  style={{
                    padding: '8px 16px', borderRadius: 20,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(56,189,248,0.15)';
                    e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                >
                  {emoji} {label}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Cheapest destinations hint */}
        {!query.trim() && (
          <div style={{ marginTop: 24 }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 12 }}>
              Top deals from {departureCode}
            </div>
            {destinations
              .filter(d => {
                const p = d.livePrice ?? d.flightPrice;
                return p > 0 && p <= maxPrice;
              })
              .sort((a, b) => (a.livePrice ?? a.flightPrice) - (b.livePrice ?? b.flightPrice))
              .slice(0, 5)
              .map(dest => (
                <div
                  key={dest.id}
                  onClick={() => { onClose(); router.push(`/destination/${dest.id}`); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '10px 16px', cursor: 'pointer', borderRadius: 12, marginBottom: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span style={{ fontSize: 18 }}>🔥</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{dest.city}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginLeft: 8 }}>{dest.country}</span>
                  </div>
                  <span style={{ color: '#4ADE80', fontSize: 15, fontWeight: 700 }}>${dest.livePrice ?? dest.flightPrice}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
