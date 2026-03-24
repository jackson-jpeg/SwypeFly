import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import SplitFlapRow from '../../components/board/SplitFlapRow';
import { useDealStore } from '../../stores/dealStore';
import { useSavedStore } from '../../stores/savedStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBookingFlowStore } from '../../stores/bookingFlowStore';
import { colors, fonts, spacing } from '../../theme/tokens';
import { shareDestination } from '../../utils/share';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = 360;

const DEAL_TIER_COLORS: Record<string, string> = {
  amazing: colors.dealAmazing,
  great: colors.dealGreat,
  good: colors.dealGood,
  fair: colors.muted,
};

export default function DestinationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const allDeals = useDealStore((s) => s.deals);
  const deal = allDeals.find((d) => d.id === id);
  const savedIds = useSavedStore((s) => s.savedIds);
  const toggle = useSavedStore((s) => s.toggle);
  const isSaved = deal ? savedIds.includes(deal.id) : false;

  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Find similar destinations — same vibes, similar price, different city
  const similarDeals = useMemo(() => {
    if (!deal) return [];
    const vibes = new Set(deal.vibeTags);
    return allDeals
      .filter((d) => d.id !== deal.id && d.vibeTags.some((v) => vibes.has(v)))
      .sort((a, b) => {
        // Score by vibe overlap + price proximity
        const aVibes = a.vibeTags.filter((v) => vibes.has(v)).length;
        const bVibes = b.vibeTags.filter((v) => vibes.has(v)).length;
        if (aVibes !== bVibes) return bVibes - aVibes;
        const aDiff = Math.abs((a.price ?? 9999) - (deal.price ?? 0));
        const bDiff = Math.abs((b.price ?? 9999) - (deal.price ?? 0));
        return aDiff - bDiff;
      })
      .slice(0, 4);
  }, [deal, allDeals]);

  const handleShare = useCallback(() => {
    if (!deal) return;
    shareDestination(deal.destination, deal.country, deal.tagline, deal.id, deal.price ?? undefined);
  }, [deal]);

  const handleBook = useCallback(() => {
    if (!deal) return;
    // Store trip context before entering booking flow
    const store = useBookingFlowStore.getState();
    store.reset();
    store.setTripContext(
      departureCode,
      deal.iataCode,
      deal.destinationFull || deal.destination,
      deal.price ?? null,
    );
    router.push(`/booking/${deal.id}/trip`);
  }, [deal, router, departureCode]);

  if (!deal) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </Pressable>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Deal not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <View style={styles.hero}>
          <Image
            source={{ uri: deal.imageUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={400}
          />
          <LinearGradient
            colors={['rgba(10,8,6,0.4)', 'transparent', 'rgba(10,8,6,0.95)']}
            locations={[0, 0.3, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Nav */}
          <Pressable
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </Pressable>

          {/* Hero bottom content */}
          <View style={styles.heroBottom}>
            <View style={{ flexDirection: 'row' }}>
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
            <Text style={styles.heroCountry}>{deal.country}</Text>
            <Text style={styles.heroTagline}>{deal.tagline}</Text>
          </View>
        </View>

        {/* Deal tier badge */}
        {deal.dealTier && deal.dealTier !== 'fair' && (
          <View style={[styles.dealTierRow, { borderColor: (DEAL_TIER_COLORS[deal.dealTier] || colors.muted) + '40' }]}>
            <View style={[styles.dealTierDot, { backgroundColor: DEAL_TIER_COLORS[deal.dealTier] || colors.muted }]} />
            <Text style={[styles.dealTierLabel, { color: DEAL_TIER_COLORS[deal.dealTier] || colors.muted }]}>
              {deal.dealTier === 'amazing' ? 'INCREDIBLE DEAL' : deal.dealTier === 'great' ? 'GREAT DEAL' : 'GOOD PRICE'}
            </Text>
            {deal.savingsPercent != null && deal.savingsPercent > 0 && (
              <Text style={[styles.dealTierSavings, { color: DEAL_TIER_COLORS[deal.dealTier] || colors.muted }]}>
                {deal.savingsPercent}% below avg
              </Text>
            )}
          </View>
        )}

        {/* Price card — show the deal's price from the feed */}
        <View style={styles.priceCard}>
          {deal.price != null ? (
            <>
              <View style={styles.priceLeft}>
                <Text style={styles.priceFrom}>Round trip from</Text>
                <SplitFlapRow
                  text={deal.priceFormatted}
                  maxLength={6}
                  size="md"
                  color={colors.yellow}
                  align="right"
                  startDelay={100}
                  animate={animate}
                />
                {/* Usual price with strikethrough */}
                {deal.usualPrice != null && deal.savingsAmount != null && deal.savingsAmount > 0 && (
                  <View style={styles.priceAnchor}>
                    <Text style={styles.usualPriceText}>Usually ${deal.usualPrice}</Text>
                    <Text style={styles.savingsAmountText}>Save ${deal.savingsAmount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.priceRight}>
                <Text style={styles.priceDetail}>{deal.airline}</Text>
                <Text style={styles.priceDetail}>{deal.flightDuration}</Text>
                {deal.isNonstop === true && (
                  <Text style={[styles.priceDetail, { color: colors.dealAmazing }]}>Nonstop</Text>
                )}
                {deal.totalStops != null && deal.totalStops > 0 && (
                  <Text style={styles.priceDetail}>{deal.totalStops} stop{deal.totalStops > 1 ? 's' : ''}</Text>
                )}
              </View>
            </>
          ) : (
            <View style={styles.priceLeft}>
              <Text style={styles.priceFrom}>Price varies by date</Text>
            </View>
          )}
        </View>

        {/* Price context hint */}
        {deal.price != null && (
          <Text style={styles.priceContext}>
            {deal.usualPrice != null && deal.savingsPercent != null && deal.savingsPercent > 0
              ? `This price is ${deal.savingsPercent}% below the typical ${deal.priceFormatted.replace(/\$\d+/, `$${deal.usualPrice}`)} for this route`
              : `Prices start from ${deal.priceFormatted} and may vary by date`}
          </Text>
        )}

        {/* Quick facts strip */}
        <View style={styles.quickFacts}>
          {deal.isNonstop === true && (
            <View style={[styles.quickFact, { backgroundColor: colors.dealAmazing + '15' }]}>
              <Ionicons name="flash" size={14} color={colors.dealAmazing} />
              <Text style={[styles.quickFactText, { color: colors.dealAmazing }]}>Nonstop</Text>
            </View>
          )}
          {deal.tripDays > 0 && (
            <View style={styles.quickFact}>
              <Ionicons name="moon-outline" size={14} color={colors.whiteDim} />
              <Text style={styles.quickFactText}>{deal.tripDays} nights</Text>
            </View>
          )}
          {deal.flightDuration && (
            <View style={styles.quickFact}>
              <Ionicons name="time-outline" size={14} color={colors.whiteDim} />
              <Text style={styles.quickFactText}>{deal.flightDuration}</Text>
            </View>
          )}
          {deal.totalStops != null && deal.totalStops > 0 && (
            <View style={styles.quickFact}>
              <Ionicons name="git-commit-outline" size={14} color={colors.whiteDim} />
              <Text style={styles.quickFactText}>{deal.totalStops} stop{deal.totalStops > 1 ? 's' : ''}</Text>
            </View>
          )}
          {deal.dealTier && deal.dealTier !== 'fair' && (
            <View style={[styles.quickFact, { backgroundColor: (DEAL_TIER_COLORS[deal.dealTier] || colors.muted) + '15' }]}>
              <Ionicons name="trending-down" size={14} color={DEAL_TIER_COLORS[deal.dealTier] || colors.muted} />
              <Text style={[styles.quickFactText, { color: DEAL_TIER_COLORS[deal.dealTier] || colors.muted }]}>
                {deal.dealTier === 'amazing' ? 'Best price' : deal.dealTier === 'great' ? 'Great price' : 'Good price'}
              </Text>
            </View>
          )}
        </View>

        {/* Trip details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TRIP DETAILS</Text>
          <View style={styles.detailGrid}>
            <DetailItem icon="calendar-outline" label="Depart" value={formatDate(deal.departureDate)} />
            <DetailItem icon="calendar" label="Return" value={formatDate(deal.returnDate)} />
            <DetailItem icon="time-outline" label="Duration" value={`${deal.tripDays} days`} />
            <DetailItem icon="airplane-outline" label="Flight" value={deal.flightDuration} />
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <Text style={styles.description}>{deal.description}</Text>
        </View>

        {/* Vibe tags */}
        {deal.vibeTags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VIBES</Text>
            <View style={styles.vibeRow}>
              {deal.vibeTags.map((tag) => (
                <View key={tag} style={styles.vibeChip}>
                  <Text style={styles.vibeText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Itinerary */}
        {deal.itinerary && deal.itinerary.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SAMPLE ITINERARY</Text>
            {deal.itinerary.map((day) => (
              <View key={day.day} style={styles.itineraryDay}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>Day {day.day}</Text>
                </View>
                <View style={styles.dayActivities}>
                  {day.activities.map((activity, i) => (
                    <Text key={i} style={styles.activityText}>
                      • {activity}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Restaurants */}
        {deal.restaurants && deal.restaurants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WHERE TO EAT</Text>
            {deal.restaurants.map((r, i) => (
              <View key={i} style={styles.restaurantRow}>
                <View>
                  <Text style={styles.restaurantName}>{r.name}</Text>
                  <Text style={styles.restaurantType}>{r.type}</Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color={colors.yellow} />
                  <Text style={styles.ratingText}>{r.rating}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Price alert CTA */}
        {deal.price != null && (
          <View style={styles.alertCta}>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertCtaTitle}>Track this price</Text>
              <Text style={styles.alertCtaDesc}>Get notified when {deal.destination} drops below ${deal.price}</Text>
            </View>
            <Pressable style={styles.alertCtaBtn}>
              <Ionicons name="notifications-outline" size={18} color={colors.bg} />
              <Text style={styles.alertCtaBtnText}>Alert</Text>
            </Pressable>
          </View>
        )}

        {/* Similar destinations */}
        {similarDeals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SIMILAR DESTINATIONS</Text>
            <View style={styles.similarRow}>
              {similarDeals.map((sd) => (
                <Pressable
                  key={sd.id}
                  style={styles.similarCard}
                  onPress={() => router.push(`/destination/${sd.id}`)}
                >
                  {sd.imageUrl ? (
                    <Image
                      source={{ uri: sd.imageUrl }}
                      style={styles.similarImage}
                      contentFit="cover"
                      transition={300}
                    />
                  ) : (
                    <View style={[styles.similarImage, { backgroundColor: colors.surface }]} />
                  )}
                  <View style={styles.similarInfo}>
                    <Text style={styles.similarCity} numberOfLines={1}>{sd.destination}</Text>
                    <Text style={styles.similarCountry} numberOfLines={1}>{sd.country}</Text>
                    {sd.price != null && (
                      <Text style={styles.similarPrice}>{sd.priceFormatted}</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Spacer for bottom bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.saveBtn}
          onPress={() => toggle(deal)}
        >
          <Ionicons
            name={isSaved ? 'heart' : 'heart-outline'}
            size={24}
            color={isSaved ? '#E85D4A' : colors.white}
          />
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color={colors.white} />
        </Pressable>
        <Pressable style={styles.bookBtn} onPress={handleBook}>
          <Text style={styles.bookLabel}>
            Search Flights
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bg} />
        </Pressable>
      </View>
    </View>
  );
}

function DetailItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon as any} size={16} color={colors.green} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatDate(dateStr: string): string {
  // Append T00:00:00 to force local timezone interpretation (YYYY-MM-DD alone is parsed as UTC)
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Hero
  hero: { width: SCREEN_W, height: HERO_H },
  heroBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  heroCity: {
    fontFamily: fonts.display,
    fontSize: 42,
    color: colors.white,
    letterSpacing: 2,
  },
  heroCountry: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  heroTagline: {
    fontFamily: fonts.accent,
    fontSize: 16,
    color: colors.whiteDim,
    marginTop: spacing.xs,
  },

  // Nav
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,8,6,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // Deal tier badge row
  dealTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  dealTierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dealTierLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  dealTierSavings: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginLeft: 'auto',
  },

  // Price card
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.yellow + '30',
  },
  priceLeft: {},
  priceFrom: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceAmount: {
    fontFamily: fonts.display,
    fontSize: 38,
    color: colors.yellow,
    lineHeight: 42,
  },
  priceAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  usualPriceText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.faint,
    textDecorationLine: 'line-through',
  },
  savingsAmountText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.dealAmazing,
  },
  priceContext: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.faint,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginHorizontal: spacing.md,
    fontStyle: 'italic',
  },
  priceRight: { alignItems: 'flex-end', gap: 2 },
  priceDetail: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.whiteDim,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.green + '30',
  },

  // Detail grid
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailItem: {
    width: (SCREEN_W - spacing.md * 2 - 8) / 2,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  detailLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },

  // Description
  description: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.whiteDim,
    lineHeight: 22,
  },

  // Vibes
  vibeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibeChip: {
    backgroundColor: colors.yellow + '20',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  vibeText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.yellow,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Itinerary
  itineraryDay: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  dayBadge: {
    backgroundColor: colors.green + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  dayBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.green,
  },
  dayActivities: { flex: 1, gap: 2 },
  activityText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.whiteDim,
    lineHeight: 20,
  },

  // Restaurants
  restaurantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
  },
  restaurantName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  restaurantType: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.faint,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.yellow + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.yellow,
  },

  // Price alert CTA
  alertCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.green + '30',
  },
  alertCtaTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  alertCtaDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  alertCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.green,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  alertCtaBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.bg,
  },

  // Quick facts strip
  quickFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  quickFact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  quickFactText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.whiteDim,
  },

  // Similar destinations
  similarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  similarCard: {
    width: (SCREEN_W - spacing.md * 2 - 8) / 2,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  similarImage: {
    width: '100%',
    height: 80,
  },
  similarInfo: {
    padding: 8,
  },
  similarCity: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  similarCountry: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  similarPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.yellow,
    marginTop: 4,
  },

  // Not found
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFoundText: { fontFamily: fonts.display, fontSize: 20, color: colors.muted },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.yellow,
  },
  bookLabel: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.bg,
    letterSpacing: 0.5,
  },
});
