import React, { useState, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { destinations } from '../../data/destinations';

export function DealsTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const deals = useMemo(() => {
    return destinations
      .filter(d => d.livePrice != null && d.livePrice < d.flightPrice * 0.9)
      .sort((a, b) => (a.livePrice! / a.flightPrice) - (b.livePrice! / b.flightPrice))
      .slice(0, 10);
  }, []);

  useEffect(() => {
    if (deals.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % deals.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [deals.length]);

  if (Platform.OS !== 'web' || deals.length === 0) return null;

  const deal = deals[currentIndex];
  const savings = Math.round(((deal.flightPrice - deal.livePrice!) / deal.flightPrice) * 100);

  return (
    <button
      onClick={() => router.push(`/destination/${deal.id}`)}
      aria-label={`Deal: ${deal.city} $${deal.livePrice}, ${savings}% off`}
      style={{
        position: 'fixed', top: 82, left: '50%', transform: 'translateX(-50%)',
        zIndex: 28, cursor: 'pointer',
        padding: '4px 14px', borderRadius: 9999,
        backgroundColor: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.25)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'opacity 0.3s',
        whiteSpace: 'nowrap', fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 12 }}>🔥</span>
      <span style={{ color: '#4ADE80', fontSize: 11, fontWeight: 700 }}>
        {deal.city} ${deal.livePrice} ({savings}% off)
      </span>
    </button>
  );
}
