import { View, Text, Platform } from 'react-native';
import { colors, radii, spacing, fontSize, fontWeight } from '../../constants/theme';
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

  if (!isLive) return null;

  const hoursAgo = getHoursAgo(priceFetchedAt);
  const daysUntilDep = getDaysUntil(departureDate);

  const isDepartingSoon = daysUntilDep != null && daysUntilDep < 14 && daysUntilDep > 0;

  const dotColor = isDepartingSoon ? colors.warningLight : colors.success;
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
          gap: spacing['1.5'],
          backgroundColor: colors.overlay.card,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: radii['3xl'],
          padding: `${spacing['1.5']}px ${spacing['3']}px`,
          border: `1px solid ${colors.overlay.white}`,
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
        <span style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: 'rgba(255,255,255,0.8)', letterSpacing: 1, textTransform: 'uppercase' as const }}>
          {label}
        </span>
        {sublabel && (
          <>
            <span style={{ color: colors.card.textTag, fontSize: fontSize.xs }}>·</span>
            <span style={{ fontSize: fontSize.xs, color: colors.card.textMuted, fontWeight: fontWeight.medium }}>
              {sublabel}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['1.5'],
        backgroundColor: colors.overlay.card,
        borderRadius: radii['3xl'],
        paddingVertical: spacing['1.5'],
        paddingHorizontal: spacing['3'],
        borderWidth: 1,
        borderColor: colors.overlay.white,
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
      <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: 'rgba(255,255,255,0.8)', letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </Text>
      {sublabel ? (
        <>
          <Text style={{ color: colors.card.textTag, fontSize: fontSize.xs }}>·</Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.card.textMuted, fontWeight: fontWeight.medium }}>
            {sublabel}
          </Text>
        </>
      ) : null}
    </View>
  );
}
