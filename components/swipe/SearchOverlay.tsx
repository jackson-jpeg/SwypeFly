import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { destinations } from '../../data/destinations';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';

interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export function SearchOverlay({ visible, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!visible) setQuery('');
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
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return destinations
      .filter(d =>
        d.city.toLowerCase().includes(q) ||
        d.country.toLowerCase().includes(q) ||
        d.vibeTags.some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query]);

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
            onChange={(e) => setQuery(e.target.value)}
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
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 40, fontSize: 14 }}>
            Try "beach", "Tokyo", "budget", or "romantic"
          </div>
        )}
      </div>
    </div>
  );
}
