import { Platform } from 'react-native';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { useSwipeFeed } from '../../hooks/useSwipeFeed';
import { formatFlightPrice } from '../../utils/formatPrice';
import { colors, radii, fontSize, fontWeight, shadows, spacing } from '../../constants/theme';
import type { Destination } from '../../types/destination';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getCurrentMonthAbbr() {
  return MONTH_ABBR[new Date().getMonth()];
}

function TrendingCard({ destination, rank }: { destination: Destination; rank: number }) {
  return (
    <div
      onClick={() => router.push(`/destination/${destination.id}`)}
      style={{
        position: 'relative', minWidth: 180, width: 180, height: 240,
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
        boxShadow: shadows.web.lg,
        transition: 'transform 0.2s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <img
        src={destination.imageUrl}
        alt={destination.city}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        loading="lazy"
      />
      {/* Rank badge */}
      <div style={{
        position: 'absolute', top: 8, left: 8,
        width: 28, height: 28, borderRadius: 14,
        background: `linear-gradient(135deg, ${colors.primary}, #0284C7)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>#{rank}</span>
      </div>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        padding: '30px 12px 12px',
      }}>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>{destination.city}</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
          {destination.country}
        </div>
        <div style={{
          color: '#7DD3FC', fontSize: 13, fontWeight: 700, marginTop: 4,
        }}>
          {formatFlightPrice(destination.flightPrice, destination.currency)}
        </div>
      </div>
    </div>
  );
}

function DropCard({ destination, dropPct }: { destination: Destination; dropPct: number }) {
  return (
    <div
      onClick={() => router.push(`/destination/${destination.id}`)}
      style={{
        minWidth: 160, width: 160, padding: 14,
        borderRadius: 16, cursor: 'pointer', flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))',
        border: '1px solid rgba(34,197,94,0.2)',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.03)';
        e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.borderColor = 'rgba(34,197,94,0.2)';
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>📉</div>
      <div style={{ color: colors.text.primary, fontSize: 15, fontWeight: 800 }}>{destination.city}</div>
      <div style={{ color: colors.text.muted, fontSize: 12, marginTop: 2 }}>{destination.country}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
      }}>
        <span style={{
          color: colors.success, fontSize: 16, fontWeight: 900,
        }}>
          ↓{dropPct}%
        </span>
        <span style={{ color: colors.text.secondary, fontSize: 12 }}>
          {formatFlightPrice(destination.flightPrice, destination.currency)}
        </span>
      </div>
    </div>
  );
}

function WeatherCard({ destination }: { destination: Destination }) {
  return (
    <div
      onClick={() => router.push(`/destination/${destination.id}`)}
      style={{
        minWidth: 160, width: 160, padding: 14,
        borderRadius: 16, cursor: 'pointer', flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.02))',
        border: '1px solid rgba(251,191,36,0.2)',
        transition: 'transform 0.2s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>☀️</div>
      <div style={{ color: colors.text.primary, fontSize: 15, fontWeight: 800 }}>{destination.city}</div>
      <div style={{ color: colors.text.muted, fontSize: 12, marginTop: 2 }}>{destination.country}</div>
      <div style={{ color: colors.text.secondary, fontSize: 12, marginTop: 8 }}>
        {destination.averageTemp}°C · {formatFlightPrice(destination.flightPrice, destination.currency)}
      </div>
    </div>
  );
}

function HScrollStrip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 12, overflowX: 'auto', overflowY: 'hidden',
      padding: `0 ${spacing['5']}px 4px`, scrollbarWidth: 'none',
    }}>
      {children}
    </div>
  );
}

interface TrendingSectionProps {
  onClose?: () => void;
}

export function TrendingSection({ onClose }: TrendingSectionProps) {
  if (Platform.OS !== 'web') return null;

  const { data } = useSwipeFeed();
  const destinations = useMemo(
    () => data?.pages.flatMap((p) => p.destinations) ?? [],
    [data],
  );

  const currentMonth = getCurrentMonthAbbr();

  const trending = useMemo(
    () => [...destinations].sort((a, b) => b.rating * b.reviewCount - a.rating * a.reviewCount).slice(0, 6),
    [destinations],
  );

  const biggestDrops = useMemo(
    () =>
      destinations
        .filter((d) => d.priceDirection === 'down' && d.previousPrice != null)
        .map((d) => ({
          dest: d,
          dropPct: Math.round(((d.previousPrice! - d.flightPrice) / d.previousPrice!) * 100),
        }))
        .sort((a, b) => b.dropPct - a.dropPct)
        .slice(0, 6),
    [destinations],
  );

  const perfectWeather = useMemo(
    () => destinations.filter((d) => d.bestMonths.includes(currentMonth)).slice(0, 6),
    [destinations, currentMonth],
  );

  if (destinations.length === 0) return null;

  return (
    <div style={{
      background: colors.background,
      borderRadius: 24,
      paddingTop: 20, paddingBottom: 24,
      overflow: 'hidden',
    }}>
      <style>{`
        .sg-trending-section::-webkit-scrollbar { display: none; }
      `}</style>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${spacing['5']}px ${spacing['3']}px`,
      }}>
        <h2 style={{
          margin: 0, color: colors.text.primary, fontSize: 22, fontWeight: 800,
        }}>
          ✨ Discover
        </h2>
        {onClose && (
          <div
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.surfaceElevated, cursor: 'pointer',
              border: `1px solid ${colors.border}`,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.border)}
            onMouseLeave={(e) => (e.currentTarget.style.background = colors.surfaceElevated)}
          >
            <span style={{ fontSize: 14, color: colors.text.secondary }}>✕</span>
          </div>
        )}
      </div>

      {/* Trending */}
      {trending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            padding: `0 ${spacing['5']}px 10px`,
            fontSize: 15, fontWeight: 700, color: colors.text.dark,
          }}>
            🔥 Trending This Week
          </div>
          <HScrollStrip>
            {trending.map((d, i) => (
              <TrendingCard key={d.id} destination={d} rank={i + 1} />
            ))}
          </HScrollStrip>
        </div>
      )}

      {/* Biggest Drops */}
      {biggestDrops.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            padding: `0 ${spacing['5']}px 10px`,
            fontSize: 15, fontWeight: 700, color: colors.text.dark,
          }}>
            💰 Biggest Price Drops
          </div>
          <HScrollStrip>
            {biggestDrops.map(({ dest, dropPct }) => (
              <DropCard key={dest.id} destination={dest} dropPct={dropPct} />
            ))}
          </HScrollStrip>
        </div>
      )}

      {/* Perfect Weather */}
      {perfectWeather.length > 0 && (
        <div>
          <div style={{
            padding: `0 ${spacing['5']}px 10px`,
            fontSize: 15, fontWeight: 700, color: colors.text.dark,
          }}>
            ☀️ Perfect Weather Right Now
          </div>
          <HScrollStrip>
            {perfectWeather.map((d) => (
              <WeatherCard key={d.id} destination={d} />
            ))}
          </HScrollStrip>
        </div>
      )}
    </div>
  );
}
