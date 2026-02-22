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
  savedAt?: number; // timestamp
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

function getDaysSaved(): string {
  const days = Math.floor(Math.random() * 14) + 1; // placeholder
  return days === 1 ? '1 day ago' : `${days}d ago`;
}

export function SavedCard({ destination }: SavedCardProps) {
  const { toggle } = useSaveDestination();
  const handlePress = () => router.push(`/destination/${destination.id}`);
  const handleUnsave = () => toggle(destination.id);

  if (Platform.OS === 'web') {
    const priceDrop =
      destination.priceDirection === 'down' && destination.previousPrice != null
        ? Math.round(
            ((destination.previousPrice - destination.flightPrice) / destination.previousPrice) * 100,
          )
        : null;

    return (
      <>
        <style>{`
          .sg-saved-card {
            transition: transform 0.25s cubic-bezier(.4,0,.2,1), box-shadow 0.25s ease;
          }
          .sg-saved-card:hover {
            transform: translateY(-4px) scale(1.01);
            box-shadow: ${shadows.web.xl}, 0 0 0 1px rgba(56,189,248,0.15);
          }
          .sg-saved-card:hover .sg-saved-img {
            transform: scale(1.05);
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
            transform: scale(1.15) !important;
            background: rgba(239,68,68,0.7) !important;
          }
        `}</style>
        <div
          className="sg-saved-card"
          onClick={handlePress}
          style={{
            position: 'relative',
            borderRadius: 20,
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
              transition: 'transform 0.4s cubic-bezier(.4,0,.2,1)',
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
              position: 'absolute', top: 10, right: 10,
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 5,
            }}
          >
            {HEART_FILLED_SM}
          </div>
          {/* Top-left badges */}
          <div style={{
            position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 5,
          }}>
            {priceDrop !== null && (
              <div style={{
                backgroundColor: 'rgba(34,197,94,0.2)',
                borderRadius: radii.full,
                padding: '4px 10px',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(34,197,94,0.3)',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: colors.success }}>
                  ↓ {priceDrop}% drop
                </span>
              </div>
            )}
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.35)',
              borderRadius: radii.full,
              padding: '3px 8px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                🕐 {getDaysSaved()}
              </span>
            </div>
          </div>
          {/* Price overlay pill */}
          <div style={{
            position: 'absolute', top: 10, right: 52,
            backgroundColor: 'rgba(15,23,42,0.75)',
            borderRadius: radii.full,
            padding: '5px 12px',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 4,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 800,
              color: destination.priceDirection === 'down' ? colors.success : '#7DD3FC',
            }}>
              {formatFlightPrice(destination.flightPrice, destination.currency)}
            </span>
          </div>
          {/* Bottom gradient */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
            padding: '40px 14px 14px',
          }}>
            {destination.vibeTags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {destination.vibeTags.slice(0, 2).map((tag) => (
                  <span key={tag} style={{
                    fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.45)',
                    textTransform: 'uppercase', letterSpacing: 1.2,
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div style={{
              color: '#fff', fontSize: 20, fontWeight: 800,
              lineHeight: 1.2, letterSpacing: -0.3,
            }}>
              {destination.city}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500 }}>
                {destination.country}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                {destination.rating}★
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Native version (unchanged)
  return (
    <Pressable onPress={handlePress} style={{ borderRadius: radii['2xl'], overflow: 'hidden', aspectRatio: 0.75, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flex: 1 }}>
      <Image source={{ uri: destination.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
      <Pressable
        onPress={(e) => { e.stopPropagation?.(); handleUnsave(); }}
        hitSlop={8}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.4)',
          alignItems: 'center', justifyContent: 'center', zIndex: 5,
        }}
      >
        {HEART_FILLED_SM}
      </Pressable>
      {destination.priceDirection === 'down' && destination.previousPrice != null && (
        <View style={{
          position: 'absolute', top: 8, left: 8,
          backgroundColor: 'rgba(34,197,94,0.25)', borderRadius: radii.full,
          paddingVertical: 3, paddingHorizontal: 8,
          borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', zIndex: 5,
        }}>
          <Text style={{ fontSize: 10, fontWeight: fontWeight.bold, color: colors.success }}>
            ↓ {Math.round(((destination.previousPrice - destination.flightPrice) / destination.previousPrice) * 100)}%
          </Text>
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing['3'], paddingTop: spacing['8'] }}
      >
        {destination.vibeTags.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
            {destination.vibeTags.slice(0, 2).map((tag) => (
              <Text key={tag} style={{ fontSize: 9, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>{tag}</Text>
            ))}
          </View>
        )}
        <Text style={{ color: colors.card.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{destination.city}</Text>
        <Text style={{ color: colors.card.textSecondary, fontSize: fontSize.md, marginTop: 2 }}>{destination.country}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing['1'] }}>
          <Text style={{ color: destination.priceDirection === 'down' ? colors.success : colors.card.priceTint, fontSize: fontSize.md, fontWeight: fontWeight.semibold }}>
            {formatFlightPrice(destination.flightPrice, destination.currency)}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: fontSize.sm }}>{destination.rating}★</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
