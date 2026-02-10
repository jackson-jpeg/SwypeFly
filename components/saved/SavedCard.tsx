import { Pressable, Text, Platform } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { formatFlightPrice } from '../../utils/formatPrice';
import { colors, radii, spacing, fontSize, fontWeight, shadows } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface SavedCardProps {
  destination: Destination;
}

export function SavedCard({ destination }: SavedCardProps) {
  const handlePress = () => router.push(`/destination/${destination.id}`);

  if (Platform.OS === 'web') {
    return (
      <>
        <style>{`
          .sg-saved-card {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .sg-saved-card:hover {
            transform: scale(1.02);
            box-shadow: ${shadows.web.xl};
          }
          .sg-saved-card:hover .sg-saved-img {
            filter: brightness(1.08);
          }
          .sg-saved-card:active {
            transform: scale(0.98);
          }
        `}</style>
        <div
          className="sg-saved-card"
          onClick={handlePress}
          style={{
            position: 'relative',
            borderRadius: radii['2xl'],
            overflow: 'hidden',
            cursor: 'pointer',
            aspectRatio: '3/4',
            backgroundColor: colors.surface,
            boxShadow: shadows.web.md,
            border: `1px solid ${colors.border}`,
          }}
        >
          <img
            className="sg-saved-img"
            src={destination.imageUrl}
            alt={destination.city}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transition: 'filter 0.2s ease',
            }}
            loading="lazy"
          />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
            padding: `${spacing['8']}px ${spacing['4']}px ${spacing['4']}px ${spacing['4']}px`,
          }}>
            <div style={{ color: colors.card.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{destination.city}</div>
            <div style={{ color: colors.card.textSecondary, fontSize: fontSize.md, marginTop: 2 }}>{destination.country}</div>
            <div style={{ color: colors.card.priceTint, fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginTop: spacing['1'] }}>
              {formatFlightPrice(destination.flightPrice, destination.currency)}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <Pressable onPress={handlePress} style={{ borderRadius: radii['2xl'], overflow: 'hidden', aspectRatio: 0.75, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Image source={{ uri: destination.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
      {/* Gradient overlay on native (was flat rgba) */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing['3'], paddingTop: spacing['8'] }}
      >
        <Text style={{ color: colors.card.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{destination.city}</Text>
        <Text style={{ color: colors.card.textSecondary, fontSize: fontSize.md, marginTop: 2 }}>{destination.country}</Text>
        <Text style={{ color: colors.card.priceTint, fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginTop: spacing['1'] }}>
          {formatFlightPrice(destination.flightPrice, destination.currency)}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
