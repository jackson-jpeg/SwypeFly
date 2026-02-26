import { useState, useMemo } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { destinations } from '../data/destinations';
import { useUIStore } from '../stores/uiStore';
import { colors } from '../constants/theme';

export default function BudgetCalculator() {
  const departureCode = useUIStore(s => s.departureCode);
  const [budget, setBudget] = useState(1000);
  const [nights, setNights] = useState(5);
  const [travelers, setTravelers] = useState(2);

  const affordable = useMemo(() => {
    return destinations
      .filter(d => {
        const flightCost = (d.livePrice ?? d.flightPrice) * travelers;
        const hotelCost = d.hotelPricePerNight * nights;
        return flightCost + hotelCost <= budget;
      })
      .sort((a, b) => {
        const costA = (a.livePrice ?? a.flightPrice) * travelers + a.hotelPricePerNight * nights;
        const costB = (b.livePrice ?? b.flightPrice) * travelers + b.hotelPricePerNight * nights;
        return costA - costB;
      })
      .slice(0, 12);
  }, [budget, nights, travelers]);

  if (Platform.OS !== 'web') return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0F172A', padding: '60px 20px 40px' }}>
      <button
        onClick={() => router.back()}
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 50,
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.1)', border: 'none',
          color: 'rgba(255,255,255,0.6)', fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 8px 0', textAlign: 'center' }}>
          💰 Trip Budget Calculator
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', margin: '0 0 32px 0' }}>
          Find destinations that fit your budget from {departureCode}
        </p>

        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600 }}>Total Budget</span>
              <span style={{ color: colors.primary, fontSize: 15, fontWeight: 700 }}>${budget.toLocaleString()}</span>
            </div>
            <input type="range" min={500} max={10000} step={100} value={budget} onChange={e => setBudget(Number(e.target.value))}
              style={{ width: '100%', accentColor: colors.primary }} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600 }}>Nights</span>
                <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{nights}</span>
              </div>
              <input type="range" min={1} max={14} value={nights} onChange={e => setNights(Number(e.target.value))}
                style={{ width: '100%', accentColor: colors.primary }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600 }}>Travelers</span>
                <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{travelers}</span>
              </div>
              <input type="range" min={1} max={6} value={travelers} onChange={e => setTravelers(Number(e.target.value))}
                style={{ width: '100%', accentColor: colors.primary }} />
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          {affordable.length} destinations fit your budget
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {affordable.map(dest => {
            const flightCost = (dest.livePrice ?? dest.flightPrice) * travelers;
            const hotelCost = dest.hotelPricePerNight * nights;
            const total = flightCost + hotelCost;
            return (
              <button
                key={dest.id}
                onClick={() => router.push(`/destination/${dest.id}`)}
                style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer', position: 'relative', aspectRatio: '3/2', border: 'none', padding: 0, textAlign: 'left' }}
              >
                <img src={dest.imageUrl} alt={`${dest.city}, ${dest.country}`} loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.8))' }} />
                <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{dest.city}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{dest.country}</span>
                    <span style={{ color: '#4ADE80', fontSize: 13, fontWeight: 700 }}>${total.toLocaleString()}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {affordable.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>
            No destinations fit this budget. Try increasing it or reducing travelers/nights.
          </div>
        )}
      </div>
    </div>
  );
}
