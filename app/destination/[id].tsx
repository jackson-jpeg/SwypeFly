import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
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

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = 360;

export default function DestinationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const deal = useDealStore((s) => s.deals.find((d) => d.id === id));
  const savedIds = useSavedStore((s) => s.savedIds);
  const toggle = useSavedStore((s) => s.toggle);
  const isSaved = deal ? savedIds.includes(deal.id) : false;

  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';
  const [livePrice, setLivePrice] = useState<{
    price: number;
    airline: string;
    flightDuration: string;
    departureDate: string;
    returnDate: string;
    cached: boolean;
    searchedAt: string;
  } | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [priceError, setPriceError] = useState(false);
  const [animate, setAnimate] = useState(false);

  const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!deal?.iataCode) return;

    let cancelled = false;
    setPriceLoading(true);
    setPriceError(false);

    fetch(`${API_BASE}/api/search?origin=${departureCode}&destination=${deal.iataCode}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setLivePrice(data);
        // Update the deal in the store so going back shows fresh price
        if (data.price && deal.id) {
          useDealStore.getState().updateDealPrice(deal.id, data.price);
        }
      })
      .catch(() => {
        if (!cancelled) setPriceError(true);
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deal?.iataCode, departureCode, deal?.id, API_BASE]);

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
    router.push(`/booking/${deal.id}/dates`);
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

        {/* Price card */}
        <View style={styles.priceCard}>
          {priceLoading ? (
            <View style={styles.priceLeft}>
              <Text style={styles.priceFrom}>Searching flights...</Text>
              <ActivityIndicator size="small" color={colors.yellow} style={{ marginTop: 8 }} />
            </View>
          ) : livePrice ? (
            <>
              <View style={styles.priceLeft}>
                <Text style={styles.priceFrom}>Round trip from</Text>
                <SplitFlapRow
                  text={`$${livePrice.price}`}
                  maxLength={6}
                  size="md"
                  color={colors.yellow}
                  align="right"
                  startDelay={100}
                  animate={animate}
                />
              </View>
              <View style={styles.priceRight}>
                <Text style={styles.priceDetail}>{livePrice.airline}</Text>
                <Text style={styles.priceDetail}>{livePrice.flightDuration}</Text>
                {livePrice.cached && (
                  <Text style={[styles.priceDetail, { color: colors.faint }]}>cached</Text>
                )}
              </View>
            </>
          ) : priceError ? (
            <View style={styles.priceLeft}>
              <Text style={styles.priceFrom}>No flights available</Text>
              <Text style={[styles.priceDetail, { marginTop: 4 }]}>Try different dates</Text>
            </View>
          ) : (
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
              </View>
              <View style={styles.priceRight}>
                <Text style={styles.priceDetail}>{deal.airline}</Text>
                <Text style={styles.priceDetail}>{deal.flightDuration}</Text>
              </View>
            </>
          )}
        </View>

        {/* Price context — only when showing cached/estimated price */}
        {!priceLoading && !priceError && deal.price != null && (
          <Text style={styles.priceContext}>
            Prices start from {deal.priceFormatted} and may vary by date
          </Text>
        )}

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
        <Pressable
          style={[styles.bookBtn, priceError && styles.bookBtnAlt]}
          onPress={handleBook}
        >
          <Text style={[styles.bookLabel, priceError && styles.bookLabelAlt]}>
            {priceError
              ? 'Try Different Dates'
              : livePrice
                ? `Book for $${livePrice.price}`
                : priceLoading
                  ? 'Searching...'
                  : deal.price != null
                    ? `Book for ${deal.priceFormatted}`
                    : 'View Deal'}
          </Text>
          <Ionicons
            name={priceError ? 'calendar-outline' : 'arrow-forward'}
            size={18}
            color={priceError ? colors.yellow : colors.bg}
          />
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
  bookBtnAlt: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  bookLabelAlt: {
    color: colors.yellow,
  },
});
