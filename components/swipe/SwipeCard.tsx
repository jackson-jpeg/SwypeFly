import { useRef, useCallback, useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '../../theme/tokens';
import { successHaptic } from '../../utils/haptics';
import SplitFlapRow from '../board/SplitFlapRow';
import { shareDestination } from '../../utils/share';
import { showToast } from '../../stores/toastStore';
import { useFilterStore } from '../../stores/filterStore';
import PriceSparkline from './PriceSparkline';
import type { BoardDeal } from '../../types/deal';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Upgrade Unsplash URL to requested width + high quality. Handles both parameterized and raw URLs. */
function upgradeUnsplashUrl(url: string, width: number): string {
  if (!url.includes('unsplash.com')) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('w', String(width));
    u.searchParams.set('q', '85');
    u.searchParams.set('auto', 'format');
    u.searchParams.set('fit', 'crop');
    return u.toString();
  } catch {
    return url;
  }
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_COLORS: Record<BoardDeal['status'], string> = {
  DEAL: colors.green,
  HOT: '#E85D4A',
  NEW: colors.yellow,
};

const DEAL_TIER_COLORS: Record<string, string> = {
  amazing: colors.dealAmazing,
  great: colors.dealGreat,
  good: colors.dealGood,
  fair: colors.muted,
};

function getDealBadgeText(deal: BoardDeal): string | null {
  // Flash deal — highest priority badge
  if (deal.flashDeal) return '⚡ FLASH DEAL';
  if (!deal.dealTier || deal.dealTier === 'fair') return null;
  if (deal.savingsPercent && deal.savingsPercent >= 30) {
    return `${deal.savingsPercent}% BELOW AVG`;
  }
  if (deal.dealTier === 'amazing') return 'INCREDIBLE DEAL';
  if (deal.dealTier === 'great') return 'GREAT DEAL';
  if (deal.dealTier === 'good') return 'GOOD PRICE';
  return null;
}

/** Generate a "why this deal" context string for discovery */
function getDealContext(deal: BoardDeal): string | null {
  const parts: string[] = [];

  // Flash deal takes priority
  if (deal.flashDeal) {
    parts.push('price just dropped');
  }

  // Weekend getaway detection (client-side)
  if (deal.price && deal.price < 250 && deal.tripDays >= 2 && deal.tripDays <= 4) {
    parts.push('weekend getaway');
  }

  // Savings context
  if (deal.savingsPercent && deal.savingsPercent >= 20) {
    parts.push(`${deal.savingsPercent}% cheaper than usual`);
  } else if (deal.savingsPercent && deal.savingsPercent >= 10) {
    parts.push(`${deal.savingsPercent}% off`);
  } else if (deal.usualPrice && deal.price && deal.price < deal.usualPrice) {
    // Even small savings — compute client-side if server didn't
    const pct = Math.round(((deal.usualPrice - deal.price) / deal.usualPrice) * 100);
    if (pct >= 5) parts.push(`${pct}% below avg`);
  }

  if (deal.isNonstop) {
    parts.push('nonstop');
  }

  // Deal tier context when no savings available
  if (parts.length === 0) {
    if (deal.dealTier === 'amazing') parts.push('top deal');
    else if (deal.dealTier === 'great') parts.push('great value');
  }

  if (deal.price && deal.price < 150) {
    parts.push('steal');
  } else if (deal.price && deal.price < 250) {
    parts.push('under $250');
  } else if (deal.price && deal.price < 400) {
    parts.push('budget-friendly');
  }

  // Value density context
  if (deal.price && deal.tripDays > 0) {
    const ppd = Math.round(deal.price / deal.tripDays);
    if (ppd <= 40) parts.push(`$${ppd}/day`);
  }

  if (parts.length === 0) return null;
  return parts.slice(0, 3).join(' · '); // Max 3 context items
}

interface SwipeCardProps {
  deal: BoardDeal;
  isSaved: boolean;
  isFirst?: boolean;
  animate: boolean;
  onSave: () => void;
  onBook: () => void;
  onTap?: () => void;
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80';

function SwipeCard({ deal, isSaved, isFirst, animate, onSave, onBook, onTap }: SwipeCardProps) {
  const imageUri = deal.imageUrl || FALLBACK_IMAGE;
  const saveScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const hintBounce = useRef(new Animated.Value(0)).current;
  const [showActions, setShowActions] = useState(false);
  const toggleVibe = useFilterStore((s) => s.toggleVibe);

  // Fade-in entrance animation when card becomes visible
  useEffect(() => {
    if (animate) {
      cardOpacity.setValue(0);
      Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [animate]);

  // Bounce scroll hint on first card
  useEffect(() => {
    if (!isFirst) return;
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(hintBounce, { toValue: -8, duration: 600, useNativeDriver: true }),
        Animated.timing(hintBounce, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    const timer = setTimeout(() => bounce.start(), 1500);
    return () => { clearTimeout(timer); bounce.stop(); };
  }, [isFirst]);

  const handleLongPress = useCallback(() => {
    setShowActions(true);
    successHaptic();
  }, []);

  const handleShare = useCallback(async () => {
    const shared = await shareDestination(deal.destination, deal.country, deal.tagline, deal.id, deal.price ?? undefined);
    if (shared) showToast('Link copied!');
  }, [deal]);

  const handleSave = useCallback(() => {
    onSave();
    if (!isSaved) {
      successHaptic();
      showToast(`${deal.destination} saved`);
      // Pulse animation on save
      Animated.sequence([
        Animated.timing(saveScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
        Animated.timing(saveScale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [onSave, isSaved, saveScale]);

  return (
    <Pressable
      style={styles.card}
      onPress={showActions ? () => setShowActions(false) : onTap}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${deal.destination}, ${deal.country}. ${deal.priceFormatted || 'Price varies'}. ${deal.airline}, ${deal.flightDuration}`}
      accessibilityHint="Tap to view details, long press for actions"
    >
      {/* Background image */}
      {Platform.OS === 'web' ? (
        // expo-image and RNImage both fail to render on web — use raw <img>
        <img
          src={upgradeUnsplashUrl(imageUri, 1600)}
          srcSet={`${upgradeUnsplashUrl(imageUri, 1080)} 1080w, ${upgradeUnsplashUrl(imageUri, 1600)} 1600w, ${upgradeUnsplashUrl(imageUri, 2400)} 2400w`}
          sizes="100vw"
          alt={`${deal.destination}, ${deal.country}`}
          loading={isFirst ? 'eager' : 'lazy'}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          placeholder={deal.blurHash ? { blurhash: deal.blurHash } : undefined}
          transition={400}
        />
      )}

      {/* Gradient overlay */}
      <LinearGradient
        colors={[...colors.cardGradient]}
        locations={[...colors.cardGradientLocations]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Deal of the Day — first card with amazing tier */}
      {isFirst && deal.dealTier === 'amazing' && (
        <View style={styles.dotdBadge}>
          <Text style={styles.dotdIcon}>★</Text>
          <Text style={styles.dotdText}>DEAL OF THE DAY</Text>
        </View>
      )}

      {/* Deal tier badge or legacy status badge */}
      {(() => {
        const badgeText = getDealBadgeText(deal);
        if (badgeText && deal.dealTier) {
          const tierColor = DEAL_TIER_COLORS[deal.dealTier] || colors.muted;
          return (
            <View style={[styles.dealBadge, { backgroundColor: tierColor + '20', borderColor: tierColor + '60' }]}>
              <Text style={[styles.dealBadgeText, { color: tierColor }]}>{badgeText}</Text>
            </View>
          );
        }
        return (
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[deal.status] + '20', borderColor: STATUS_COLORS[deal.status] + '60' }]}>
            <SplitFlapRow
              text={deal.status}
              maxLength={4}
              size="sm"
              color={STATUS_COLORS[deal.status]}
              align="left"
              startDelay={320}
              animate={animate}
            />
          </View>
        );
      })()}

      {/* Price tag — top right, split-flap digits + savings context */}
      {deal.price != null && deal.priceSource !== 'estimate' && (
        <View style={styles.priceTag}>
          <Text style={styles.priceLabel}>from</Text>
          <SplitFlapRow
            text={deal.priceFormatted}
            maxLength={6}
            size="md"
            color={colors.yellow}
            align="right"
            startDelay={240}
            animate={animate}
          />
          <Text style={styles.priceLabel}>round trip</Text>
          {/* Price anchoring — usual price + savings */}
          {deal.usualPrice != null && deal.savingsAmount != null && deal.savingsAmount > 0 && (
            <View style={styles.savingsRow}>
              <Text style={styles.usualPrice}>${deal.usualPrice}</Text>
              <Text style={styles.savingsText}>Save ${deal.savingsAmount}</Text>
            </View>
          )}
          {/* Price trend sparkline */}
          {deal.priceHistory && deal.priceHistory.length >= 3 && deal.price != null && (
            <View style={styles.sparklineRow}>
              <PriceSparkline prices={deal.priceHistory} currentPrice={deal.price} />
            </View>
          )}
        </View>
      )}
      {(deal.price == null || deal.priceSource === 'estimate') && (
        <View style={styles.priceTag}>
          <Ionicons name="search-outline" size={18} color={colors.yellow} />
          <Text style={[styles.priceLabel, { color: colors.yellow, fontSize: 12 }]}>Tap to{'\n'}check prices</Text>
        </View>
      )}

      {/* Bottom content — fades in with card */}
      <Animated.View style={[styles.bottomContent, { opacity: cardOpacity }]}>
        {/* Destination — split-flap city name */}
        <View style={styles.destinationRow}>
          <SplitFlapRow
            text={deal.destination}
            maxLength={12}
            size="lg"
            color={colors.white}
            align="left"
            startDelay={0}
            staggerMs={35}
            animate={animate}
          />
        </View>
        <Text style={styles.country}>
          {deal.country}
          {deal.nearbyOriginLabel ? `  ·  ${deal.nearbyOriginLabel}` : ''}
        </Text>

        {/* Trip window badge */}
        {deal.departureDate && deal.tripDays > 0 && (
          <View style={styles.tripWindowRow}>
            <Ionicons name="calendar-outline" size={11} color={colors.green} />
            <Text style={styles.tripWindowText}>
              {formatShortDate(deal.departureDate)} · {deal.tripDays} days
            </Text>
          </View>
        )}

        {/* Tagline */}
        <Text style={styles.tagline} numberOfLines={2}>{deal.tagline}</Text>

        {/* Deal context — why this deal is special */}
        {getDealContext(deal) && (
          <View style={styles.dealContextRow}>
            <Ionicons name="sparkles" size={12} color={colors.dealAmazing} />
            <Text style={styles.dealContextText}>{getDealContext(deal)}</Text>
          </View>
        )}

        {/* Flight info row — flight code in split-flap */}
        <View style={styles.infoRow}>
          <View style={styles.infoChip}>
            <Ionicons name="airplane" size={12} color={colors.yellow} />
            <Text style={styles.infoText}>{deal.airline}</Text>
          </View>
          <View style={styles.flightCodeChip}>
            <SplitFlapRow
              text={deal.flightCode}
              maxLength={6}
              size="sm"
              color={colors.whiteDim}
              align="left"
              startDelay={160}
              animate={animate}
            />
          </View>
          <View style={styles.infoChip}>
            <Ionicons name="time-outline" size={12} color={colors.yellow} />
            <Text style={styles.infoText}>{deal.flightDuration}</Text>
          </View>
          {deal.isNonstop === true && (
            <View style={[styles.infoChip, { backgroundColor: colors.dealAmazing + '15' }]}>
              <Text style={[styles.infoText, { color: colors.dealAmazing }]}>Nonstop</Text>
            </View>
          )}
          {deal.totalStops != null && deal.totalStops > 0 && (
            <View style={styles.infoChip}>
              <Text style={styles.infoText}>{deal.totalStops} stop{deal.totalStops > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        {/* Vibe tags — tappable to filter */}
        {deal.vibeTags.length > 0 && (
          <View style={styles.vibeRow}>
            {deal.vibeTags.slice(0, 3).map((tag) => (
              <Pressable
                key={tag}
                style={({ pressed }) => [styles.vibeChip, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
                onPress={() => { toggleVibe(tag); successHaptic(); showToast(`Filtering by ${tag}`); }}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${tag}`}
              >
                <Text style={styles.vibeText}>{tag}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? `Unsave ${deal.destination}` : `Save ${deal.destination}`}
          >
            <Animated.View style={{ transform: [{ scale: saveScale }] }}>
              <Ionicons
                name={isSaved ? 'heart' : 'heart-outline'}
                size={22}
                color={isSaved ? '#E85D4A' : colors.white}
              />
            </Animated.View>
            <Text style={[styles.actionLabel, isSaved && { color: '#E85D4A' }]}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Share ${deal.destination} deal`}
          >
            <Ionicons name="share-outline" size={20} color={colors.white} />
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>

          <Pressable
            onPress={onBook}
            style={({ pressed }) => [styles.bookBtn, pressed && styles.bookPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Search flights to ${deal.destination}`}
          >
            <Text style={styles.bookLabel}>Search Flights</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.bg} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Quick actions overlay (long-press) */}
      {showActions && (
        <Pressable style={styles.actionsOverlay} onPress={() => setShowActions(false)}>
          <View style={styles.actionsMenu}>
            <Pressable
              style={styles.actionsItem}
              onPress={() => { handleShare(); setShowActions(false); }}
            >
              <Ionicons name="share-outline" size={18} color={colors.white} />
              <Text style={styles.actionsItemText}>Share this deal</Text>
            </Pressable>
            <Pressable
              style={styles.actionsItem}
              onPress={() => { handleSave(); setShowActions(false); }}
            >
              <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={18} color={isSaved ? '#E85D4A' : colors.white} />
              <Text style={styles.actionsItemText}>{isSaved ? 'Unsave' : 'Save for later'}</Text>
            </Pressable>
            <Pressable
              style={styles.actionsItem}
              onPress={() => { onBook(); setShowActions(false); }}
            >
              <Ionicons name="airplane-outline" size={18} color={colors.yellow} />
              <Text style={[styles.actionsItemText, { color: colors.yellow }]}>Search flights</Text>
            </Pressable>
            {deal.affiliateUrl ? (
              <Pressable
                style={[styles.actionsItem, { borderBottomWidth: 0 }]}
                onPress={() => setShowActions(false)}
              >
                <Ionicons name="open-outline" size={18} color={colors.green} />
                <Text style={[styles.actionsItemText, { color: colors.green }]}>View on Aviasales</Text>
              </Pressable>
            ) : Platform.OS === 'web' ? (
              <Pressable
                style={[styles.actionsItem, { borderBottomWidth: 0 }]}
                onPress={() => {
                  const url = `${process.env.EXPO_PUBLIC_API_BASE || ''}/api/share-card?id=${deal.id}&format=twitter`;
                  if (typeof window !== 'undefined') window.open(url, '_blank');
                  setShowActions(false);
                }}
              >
                <Ionicons name="image-outline" size={18} color={colors.orange} />
                <Text style={[styles.actionsItemText, { color: colors.orange }]}>Share card image</Text>
              </Pressable>
            ) : (
              <View style={[styles.actionsItem, { borderBottomWidth: 0, opacity: 0.4 }]}>
                <Ionicons name="notifications-outline" size={18} color={colors.muted} />
                <Text style={styles.actionsItemText}>Set price alert</Text>
              </View>
            )}
          </View>
        </Pressable>
      )}

      {/* Scroll hint on first card — bouncing chevron */}
      {isFirst && (
        <Animated.View style={[styles.scrollHint, { transform: [{ translateY: hintBounce }] }]}>
          <Ionicons name="chevron-up" size={20} color={colors.faint} />
          <Text style={styles.scrollHintText}>
            {Platform.OS === 'web' ? 'Scroll or press ↓ for more' : 'Swipe up for more'}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: colors.surface,
  },

  // Deal of the Day badge — top center
  dotdBadge: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 70 : 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 5,
  },
  dotdIcon: {
    fontSize: 14,
    color: colors.dealGreat,
  },
  dotdText: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.dealGreat,
    letterSpacing: 1.5,
  },

  // Status badge — top left, split-flap
  statusBadge: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 70 : 60,
    left: spacing.md,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },

  // Deal tier badge — top left
  dealBadge: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 70 : 60,
    left: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
  },
  dealBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
  },

  // Price tag — top right
  priceTag: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 70 : 60,
    right: spacing.md,
    alignItems: 'center',
    backgroundColor: 'rgba(10,8,6,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.yellow + '40',
  },
  priceLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savingsRow: {
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  usualPrice: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.faint,
    textDecorationLine: 'line-through',
  },
  savingsText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.dealAmazing,
  },
  sparklineRow: {
    marginTop: 6,
    alignItems: 'center',
  },
  tripWindowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  tripWindowText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.green,
    letterSpacing: 0.3,
  },

  // Bottom content
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'web' ? 100 : 120,
  },

  destinationRow: {
    flexDirection: 'row',
  },
  country: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tagline: {
    fontFamily: fonts.accent,
    fontSize: 16,
    color: colors.whiteDim,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  dealContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  dealContextText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.dealAmazing,
    letterSpacing: 0.3,
  },

  // Info chips
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,8,6,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  flightCodeChip: {
    backgroundColor: 'rgba(10,8,6,0.5)',
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 4,
  },
  infoText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.whiteDim,
  },

  // Vibe tags
  vibeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
  },
  vibeChip: {
    backgroundColor: colors.yellow + '20',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  vibeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.yellow,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(10,8,6,0.6)',
  },
  actionPressed: { opacity: 0.7 },
  actionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.yellow,
  },
  bookPressed: { opacity: 0.85 },
  bookLabel: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.bg,
    letterSpacing: 0.5,
  },

  // Quick actions overlay
  actionsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,8,6,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  actionsMenu: {
    width: 260,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  actionsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionsItemText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.white,
  },

  // Scroll hint
  scrollHint: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 70 : 90,
    alignSelf: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  scrollHintText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.faint,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default memo(SwipeCard);
