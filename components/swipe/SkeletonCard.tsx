import { View, Platform, useWindowDimensions } from 'react-native';
import { useEffect } from 'react';

export function SkeletonCard() {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'sg-skeleton-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes sg-shimmer {
        0% { opacity: 0.15; }
        50% { opacity: 0.35; }
        100% { opacity: 0.15; }
      }
      .sg-shimmer { animation: sg-shimmer 2s ease-in-out infinite; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  if (Platform.OS === 'web') {
    return (
      <div style={{ width: '100%', height: '100vh', backgroundColor: '#0F172A', position: 'relative' }}>
        {/* Freshness pill skeleton — top left */}
        <div style={{ position: 'absolute', top: 56, left: 20 }}>
          <div className="sg-shimmer" style={{ width: 110, height: 28, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        </div>
        <div style={{ position: 'absolute', bottom: 84, left: 28, right: 28 }}>
          {/* Deal badge skeleton */}
          <div className="sg-shimmer" style={{ width: '80%', height: 70, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 16 }} />
          {/* Tags: two small pill placeholders */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div className="sg-shimmer" style={{ width: 60, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <div className="sg-shimmer" style={{ width: 72, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          </div>
          {/* City name */}
          <div className="sg-shimmer" style={{ width: 220, height: 40, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 10 }} />
          {/* Country · Duration · Rating line */}
          <div className="sg-shimmer" style={{ width: 240, height: 16, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        </div>
      </div>
    );
  }

  return (
    <View style={{ width, height, backgroundColor: '#0F172A', position: 'relative' }}>
      {/* Freshness pill skeleton — top left */}
      <View style={{ position: 'absolute', top: 56, left: 20 }}>
        <View style={{ width: 110, height: 28, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </View>
      <View style={{ position: 'absolute', bottom: 100, left: 28, right: 28 }}>
        {/* Deal badge skeleton */}
        <View style={{ width: '80%', height: 70, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <View style={{ width: 60, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <View style={{ width: 72, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        </View>
        <View style={{ width: 220, height: 40, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 10 }} />
        <View style={{ width: 240, height: 16, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </View>
    </View>
  );
}
