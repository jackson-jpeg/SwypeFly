import { View, Text, Platform } from 'react-native';
import type { Destination } from '../../types/destination';

interface CardFreshnessPillProps {
  destination: Destination;
}

function getHoursAgo(isoStr?: string): number | null {
  if (!isoStr) return null;
  const ms = Date.now() - new Date(isoStr).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
}

function getDaysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function CardFreshnessPill({ destination }: CardFreshnessPillProps) {
  const { priceSource, priceFetchedAt, departureDate } = destination;
  const isLive = priceSource === 'travelpayouts' || priceSource === 'amadeus';

  // Don't show for estimate prices
  if (!isLive) return null;

  const hoursAgo = getHoursAgo(priceFetchedAt);
  const daysUntilDep = getDaysUntil(departureDate);

  // Departure <14 days takes priority
  const isDepartingSoon = daysUntilDep != null && daysUntilDep < 14 && daysUntilDep > 0;

  const dotColor = isDepartingSoon ? '#FBBF24' : '#4ADE80'; // amber or green
  const label = isDepartingSoon ? 'DEPARTS SOON' : 'LIVE DEAL';
  const sublabel = isDepartingSoon
    ? (daysUntilDep === 1 ? 'Tomorrow' : `In ${daysUntilDep} days`)
    : (hoursAgo != null ? (hoursAgo < 1 ? 'Just now' : `${hoursAgo}h ago`) : '');

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 20,
          padding: '6px 12px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <style>{`
          @keyframes sg-pulse-dot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: dotColor,
            boxShadow: `0 0 6px ${dotColor}80`,
            animation: 'sg-pulse-dot 2s ease-in-out infinite',
            display: 'inline-block',
          }}
        />
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: 1, textTransform: 'uppercase' as const }}>
          {label}
        </span>
        {sublabel && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>·</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
              {sublabel}
            </span>
          </>
        )}
      </div>
    );
  }

  // ── Native ──
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: dotColor,
        }}
      />
      <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </Text>
      {sublabel ? (
        <>
          <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>·</Text>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>
            {sublabel}
          </Text>
        </>
      ) : null}
    </View>
  );
}
