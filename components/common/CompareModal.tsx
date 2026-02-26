import React, { useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { destinations } from '../../data/destinations';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface CompareModalProps {
  destination: Destination;
  visible: boolean;
  onClose: () => void;
}

export function CompareModal({ destination, visible, onClose }: CompareModalProps) {
  const [compareId, setCompareId] = useState('');
  const [query, setQuery] = useState('');

  if (!visible || Platform.OS !== 'web') return null;

  const searchResults = query.trim()
    ? destinations.filter(d => d.id !== destination.id && d.city.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  const compareWith = destinations.find(d => d.id === compareId);

  const statRow = (label: string, aVal: string, bVal: string) => (
    <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>{aVal}</div>
      <div style={{ width: 100, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500, alignSelf: 'center' }}>{label}</div>
      <div style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>{bVal}</div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        overflowY: 'auto', padding: '60px 20px 40px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0 }}>Compare</h2>
          <button onClick={onClose} aria-label="Close comparison" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 24, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>✕</button>
        </div>

        {!compareWith ? (
          <>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '0 0 16px 0' }}>
              Compare <strong style={{ color: '#fff' }}>{destination.city}</strong> with:
            </p>
            <input
              type="text"
              placeholder="Search a city..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '14px 18px', borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 16, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{ marginTop: 8 }}>
              {searchResults.map(d => (
                <div
                  key={d.id}
                  onClick={() => { setCompareId(d.id); setQuery(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', cursor: 'pointer', borderRadius: 10,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <img src={d.imageUrl} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                  <div>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{d.city}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{d.country}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Header images */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[destination, compareWith].map(d => (
                <div key={d.id} style={{ flex: 1, position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '4/3' }}>
                  <img src={d.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '24px 12px 10px' }}>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{d.city}</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{d.country}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats comparison */}
            {statRow('Flight', `$${destination.livePrice ?? destination.flightPrice}`, `$${compareWith.livePrice ?? compareWith.flightPrice}`)}
            {statRow('Hotel/night', `$${destination.hotelPricePerNight}`, `$${compareWith.hotelPricePerNight}`)}
            {statRow('Rating', `${destination.rating} ⭐`, `${compareWith.rating} ⭐`)}
            {statRow('Flight time', destination.flightDuration, compareWith.flightDuration)}
            {statRow('Avg temp', `${destination.averageTemp}°C`, `${compareWith.averageTemp}°C`)}
            {statRow('Best months', destination.bestMonths.slice(0, 3).join(', '), compareWith.bestMonths.slice(0, 3).join(', '))}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setCompareId('')}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >Change Comparison</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
