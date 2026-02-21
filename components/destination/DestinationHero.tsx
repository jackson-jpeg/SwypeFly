// ─── Destination Hero ────────────────────────────────────────────────────────
// Title, rating, tagline, tags, flight schedule — above the fold.

import { View, Text, Platform } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface DestinationHeroProps {
  destination: Destination;
}

export function DestinationHero({ destination }: DestinationHeroProps) {
  if (Platform.OS === 'web') {
    return (
      <div>
        <h1 style={{
          margin: 0, color: colors.navy, fontSize: fontSize['7xl'], fontWeight: fontWeight.extrabold,
          letterSpacing: -0.5, lineHeight: 1.1,
        }}>
          {destination.city}, {destination.country}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginTop: spacing['2'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <span style={{ color: colors.warning, fontSize: fontSize.lg }}>&#9733;</span>
            <span style={{ color: colors.text.dark, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
              {destination.rating.toFixed(1)}
            </span>
            <span style={{ color: colors.text.muted, fontSize: fontSize.base }}>
              ({destination.reviewCount.toLocaleString()})
            </span>
          </div>
          <span style={{ color: colors.borderSoft }}>|</span>
          <span style={{ color: colors.text.secondary, fontSize: fontSize.lg }}>
            {destination.flightDuration} flight
          </span>
        </div>
        <p style={{
          margin: `${spacing['2']}px 0 0 0`, color: colors.text.secondary, fontSize: fontSize.xl,
          fontStyle: 'italic',
        }}>
          &ldquo;{destination.tagline}&rdquo;
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['4'] }}>
          {destination.vibeTags.map((tag) => (
            <span key={tag} style={{
              backgroundColor: colors.primaryTint, borderRadius: radii['3xl'],
              padding: `5px ${spacing['4']}px`, border: `1px solid ${colors.primaryBorder}`,
              color: colors.primaryDarker, fontSize: fontSize.base, fontWeight: fontWeight.semibold,
              textTransform: 'capitalize' as const,
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <View>
      <Text style={{ color: colors.navy, fontSize: fontSize['6xl'], fontWeight: fontWeight.extrabold, letterSpacing: -0.5 }}>
        {destination.city}, {destination.country}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['3'], marginTop: spacing['2'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['1'] }}>
          <Text style={{ color: colors.warning, fontSize: fontSize.lg }}>{'\u2733'}</Text>
          <Text style={{ color: colors.text.dark, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
            {destination.rating.toFixed(1)}
          </Text>
          <Text style={{ color: colors.text.muted, fontSize: fontSize.base }}>
            ({destination.reviewCount.toLocaleString()})
          </Text>
        </View>
        <Text style={{ color: colors.borderSoft }}>|</Text>
        <Text style={{ color: colors.text.secondary, fontSize: fontSize.lg }}>
          {destination.flightDuration} flight
        </Text>
      </View>
      <Text style={{ color: colors.text.secondary, fontSize: fontSize.xl, fontStyle: 'italic', marginTop: spacing['2'] }}>
        &ldquo;{destination.tagline}&rdquo;
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
