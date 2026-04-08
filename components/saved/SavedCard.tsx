import { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '../../theme/tokens';
import SplitFlapRow from '../board/SplitFlapRow';
import type { BoardDeal } from '../../types/deal';

const CARD_GAP = 12;
const CARD_W = (Dimensions.get('window').width - spacing.md * 2 - CARD_GAP) / 2;
const CARD_H = CARD_W * 1.55;

function upgradeUnsplashUrl(url: string, width: number): string {
  if (!url || !url.includes('unsplash.com')) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('w', String(width));
    u.searchParams.set('q', '80');
    u.searchParams.set('auto', 'format');
    u.searchParams.set('fit', 'crop');
    return u.toString();
  } catch {
    return url;
  }
}

const DEAL_TIER_COLORS: Record<string, string> = {
  amazing: colors.dealAmazing,
  great: colors.dealGreat,
  good: colors.dealGood,
  fair: colors.muted,
};

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const dep = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(dep.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((dep.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

interface SavedCardProps {
  deal: BoardDeal;
  index?: number;
  onPress: () => void;
  onRemove: () => void;
  onBook?: () => void;
  onLongPress?: () => void;
}

function SavedCard({ deal, index = 0, onPress, onRemove, onBook, onLongPress }: SavedCardProps) {
  const countdown = daysUntil(deal.departureDate);
  const tierColor = deal.dealTier ? DEAL_TIER_COLORS[deal.dealTier] : null;

  // Memoize dynamic styles to prevent re-render churn
  const tierStyle = useMemo(() =>
    tierColor ? { backgroundColor: tierColor + '25', borderColor: tierColor + '50' } : undefined,
    [tierColor],
  );
  const tierTextStyle = useMemo(() =>
    tierColor ? { color: tierColor } : undefined,
    [tierColor],
  );

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${deal.destination}, ${deal.country}. ${deal.priceFormatted || 'Price varies'}. ${deal.airline}`}
      accessibilityHint="Tap to view details, long press for options"
    >
      {Platform.OS === 'web' && deal.imageUrl ? (
        <img
          src={upgradeUnsplashUrl(deal.imageUrl, 600)}
          srcSet={`${upgradeUnsplashUrl(deal.imageUrl, 400)} 400w, ${upgradeUnsplashUrl(deal.imageUrl, 600)} 600w, ${upgradeUnsplashUrl(deal.imageUrl, 800)} 800w`}
          sizes="50vw"
          alt={`${deal.destination}, ${deal.country}`}
          loading="lazy"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Image
          source={{ uri: deal.imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          placeholder={deal.blurHash ? { blurhash: deal.blurHash } : undefined}
          transition={300}
        />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(10,8,6,0.4)', 'rgba(10,8,6,0.92)']}
        locations={[0.3, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top row: badges left, remove right */}
      <View style={styles.topRow}>
        <View style={styles.topBadges}>
          {/* Deal tier badge */}
          {tierColor && deal.dealTier !== 'fair' && (
            <View style={[styles.tierBadge, tierStyle]}>
              <Text style={[styles.tierText, tierTextStyle]}>
                {deal.savingsPercent && deal.savingsPercent > 0
                  ? `${deal.savingsPercent}% OFF`
                  : deal.dealTier === 'amazing' ? 'AMAZING' : deal.dealTier === 'great' ? 'GREAT' : 'GOOD'}
              </Text>
            </View>
          )}
          {/* Nonstop badge */}
          {deal.isNonstop === true && (
            <View style={styles.nonstopBadge}>
              <Text style={styles.nonstopText}>NONSTOP</Text>
            </View>
          )}
        </View>
        <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${deal.destination} from saved`}>
          <Ionicons name="heart" size={16} color="#E85D4A" />
        </Pressable>
      </View>

      {/* Trip countdown — top left below badges */}
      {countdown != null && (
        <View style={[styles.countdownBadge, countdown <= 3 && styles.countdownUrgent]}>
          <Ionicons name="time-outline" size={10} color={countdown <= 3 ? '#E85D4A' : colors.muted} />
          <Text style={[styles.countdownText, countdown <= 3 && { color: '#E85D4A' }]}>
            {countdown === 0 ? 'TODAY' : countdown === 1 ? '1 DAY' : `${countdown} DAYS`}
          </Text>
        </View>
      )}

      {/* Bottom info */}
      <View style={styles.bottom}>
        {/* Price */}
        <View style={styles.priceBadge}>
          <SplitFlapRow
            text={deal.priceFormatted || ''}
            maxLength={6}
            size="sm"
            color={colors.yellow}
            align="left"
            startDelay={index * 50 + 100}
            animate={true}
          />
        </View>

        {/* City name */}
        <SplitFlapRow
          text={deal.destination || ''}
          maxLength={10}
          size="sm"
          color={colors.white}
          align="left"
          startDelay={index * 50}
          animate={true}
        />
        <Text style={styles.country} numberOfLines={1}>{deal.country}</Text>

        {/* Date range */}
        {deal.departureDate && deal.returnDate && (
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={10} color={colors.green} />
            <Text style={styles.dateText}>
              {formatShortDate(deal.departureDate)} – {formatShortDate(deal.returnDate)}
            </Text>
          </View>
        )}

        {/* Flight meta */}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{deal.airline}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{deal.flightDuration}</Text>
          {deal.totalStops != null && deal.totalStops > 0 && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta}>{deal.totalStops} stop{deal.totalStops > 1 ? 's' : ''}</Text>
            </>
          )}
        </View>

        {/* Book button — full width */}
        {onBook && (
          <Pressable
            onPress={onBook}
            style={({ pressed }) => [styles.bookBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={`Book flights to ${deal.destination}`}
          >
            <Ionicons name="airplane" size={12} color={colors.bg} />
            <Text style={styles.bookBtnText}>Book</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.bg} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  // Top row
  topRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  topBadges: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tierText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  nonstopBadge: {
    backgroundColor: colors.dealAmazing + '20',
    borderWidth: 1,
    borderColor: colors.dealAmazing + '40',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nonstopText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    color: colors.dealAmazing,
    letterSpacing: 0.5,
  },

  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10,8,6,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Countdown
  countdownBadge: {
    position: 'absolute',
    top: 40,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(10,8,6,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  countdownUrgent: {
    backgroundColor: 'rgba(232,93,74,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232,93,74,0.3)',
  },
  countdownText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 0.3,
  },

  // Price badge
  priceBadge: {
    backgroundColor: 'rgba(10,8,6,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },

  // Bottom content
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
  },
  country: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dateText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.faint,
  },
  metaDot: {
    fontSize: 10,
    color: colors.faint,
  },

  // Book button
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.yellow,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  bookBtnText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.bg,
    letterSpacing: 0.5,
  },
});

export default memo(SavedCard);
