// ─── Destination Hero ────────────────────────────────────────────────────────
import { View, Text, Platform } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';
import type { Destination, VibeTag } from '../../types/destination';

interface DestinationHeroProps {
  destination: Destination;
  saved?: boolean;
  onToggleSave?: () => void;
}

const VIBE_EMOJIS: Record<VibeTag, string> = {
  beach: '🏖️', mountain: '⛰️', city: '🏙️', culture: '🏛️',
  adventure: '🏞️', romantic: '💕', foodie: '🍜', nightlife: '🌃',
  nature: '🌿', historic: '🏛️', tropical: '🌴', winter: '❄️',
  luxury: '✨', budget: '💰',
};

export function DestinationHero({ destination, saved, onToggleSave }: DestinationHeroProps) {
  if (Platform.OS === 'web') {
    return (
      <div style={{ position: 'relative' }}>
        {/* Heart / favorite button */}
        {onToggleSave && (
          <button
            onClick={onToggleSave}
            style={{
              position: 'absolute', top: 0, right: 0,
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${colors.dark.borderLight}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 20,
            }}
          >
            {saved ? '❤️' : '🤍'}
          </button>
        )}

        <h1 style={{
          margin: 0, color: colors.dark.text.primary, fontSize: fontSize['7xl'], fontWeight: fontWeight.extrabold,
          letterSpacing: -0.5, lineHeight: 1.1,
        }}>
          {destination.city}, {destination.country}
        </h1>

        {/* Tagline */}
        <p style={{
          margin: `${spacing['2']}px 0 0 0`, color: colors.dark.text.secondary, fontSize: fontSize.xl,
          fontStyle: 'italic',
        }}>
          &ldquo;{destination.tagline}&rdquo;
        </p>

        {/* Category tags with emoji - inline style */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], marginTop: spacing['3'], flexWrap: 'wrap' }}>
          {destination.vibeTags.slice(0, 4).map((tag) => (
            <span key={tag} style={{
              color: colors.dark.text.secondary, fontSize: fontSize.lg, fontWeight: fontWeight.medium,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {VIBE_EMOJIS[tag] || '🏷️'} {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </span>
          ))}
        </div>

        {/* Rating row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginTop: spacing['2'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <span style={{ color: colors.warning, fontSize: fontSize.lg }}>&#9733;</span>
            <span style={{ color: colors.dark.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
              {destination.rating.toFixed(1)}
            </span>
            <span style={{ color: colors.dark.text.muted, fontSize: fontSize.base }}>
              ({destination.reviewCount.toLocaleString()})
            </span>
          </div>
          <span style={{ color: colors.dark.border }}>|</span>
          <span style={{ color: colors.dark.text.secondary, fontSize: fontSize.lg }}>
            {destination.flightDuration} flight
          </span>
        </div>
      </div>
    );
  }

  // ─── Native ──────────────────────────────────────────────────────
  return (
    <View>
      <Text style={{ color: colors.dark.text.primary, fontSize: fontSize['6xl'], fontWeight: fontWeight.extrabold, letterSpacing: -0.5 }}>
        {destination.city}, {destination.country}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['3'], marginTop: spacing['2'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['1'] }}>
          <Text style={{ color: colors.warning, fontSize: fontSize.lg }}>{'\u2733'}</Text>
          <Text style={{ color: colors.dark.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
            {destination.rating.toFixed(1)}
          </Text>
          <Text style={{ color: colors.dark.text.muted, fontSize: fontSize.base }}>
            ({destination.reviewCount.toLocaleString()})
          </Text>
        </View>
        <Text style={{ color: colors.dark.border }}>|</Text>
        <Text style={{ color: colors.dark.text.secondary, fontSize: fontSize.lg }}>
          {destination.flightDuration} flight
        </Text>
      </View>
      <Text style={{ color: colors.dark.text.secondary, fontSize: fontSize.xl, fontStyle: 'italic', marginTop: spacing['2'] }}>
        {'\u201C'}{destination.tagline}{'\u201D'}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['4'] }}>
        {destination.vibeTags.map((tag) => (
          <View key={tag} style={{
            backgroundColor: colors.primaryTint, borderRadius: radii['3xl'],
            paddingHorizontal: spacing['4'], paddingVertical: 5,
            borderWidth: 1, borderColor: colors.primaryBorder,
          }}>
            <Text style={{ color: colors.primaryDarker, fontSize: fontSize.base, fontWeight: fontWeight.semibold, textTransform: 'capitalize' }}>
              {tag}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
