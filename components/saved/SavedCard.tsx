import { Pressable, Text, View, Platform } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { formatFlightPrice } from '../../utils/formatPrice';
import { useSaveDestination } from '../../hooks/useSaveDestination';
import { colors, radii, spacing, fontSize, fontWeight, shadows } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface SavedCardProps {
  destination: Destination;
}

const HEART_FILLED_SM = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={colors.primary} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      stroke={colors.primary}
      strokeWidth="1.5"
    />
  </svg>
);

export function SavedCard({ destination }: SavedCardProps) {
  const { toggle } = useSaveDestination();
  const handlePress = () => router.push(`/destination/${destination.id}`);
  const handleUnsave = () => toggle(destination.id);

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
          .sg-saved-card:hover .sg-unsave-btn {
            opacity: 1;
          }
          .sg-saved-card:active {
            transform: scale(0.98);
          }
          .sg-unsave-btn {
            opacity: 0;
            transition: opacity 0.2s ease, transform 0.15s ease;
          }
          .sg-unsave-btn:hover {
            transform: scale(1.1);
            background: rgba(0,0,0,0.6) !important;
          }
          .sg-unsave-btn:active {
            transform: scale(0.9);
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
          {/* Unsave button */}
          <div
            className="sg-unsave-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleUnsave();
            }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 5,
            }}
          >
            {HEART_FILLED_SM}
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
            padding: `${spacing['8']}px ${spacing['4']}px ${spacing['4']}px ${spacing['4']}px`,
          }}>
            <div style={{ color: colors.card.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{destination.city}</div>
            <div style={{ color: colors.card.textSecondary, fontSize: fontSize.md, marginTop: 2 }}>{destination.country}</div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: spacing['1'],
            }}>
              <span style={{ color: colors.card.priceTint, fontSize: fontSize.md, fontWeight: fontWeight.semibold }}>
                {formatFlightPrice(destination.flightPrice, destination.currency)}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: fontSize.sm }}>
                {destination.rating}★
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <Pressable onPress={handlePress} style={{ borderRadius: radii['2xl'], overflow: 'hidden', aspectRatio: 0.75, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flex: 1 }}>
      <Image source={{ uri: destination.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
      {/* Unsave button */}
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          handleUnsave();
        }}
        hitSlop={8}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.4)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5,
        }}
      >
        {HEART_FILLED_SM}
      </Pressable>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing['3'], paddingTop: spacing['8'] }}
      >
        <Text style={{ color: colors.card.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{destination.city}</Text>
        <Text style={{ color: colors.card.textSecondary, fontSize: fontSize.md, marginTop: 2 }}>{destination.country}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing['1'] }}>
          <Text style={{ color: colors.card.priceTint, fontSize: fontSize.md, fontWeight: fontWeight.semibold }}>
            {formatFlightPrice(destination.flightPrice, destination.currency)}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: fontSize.sm }}>
            {destination.rating}★
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
