import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Head from 'expo-router/head';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import SplitFlapRow from '../../components/board/SplitFlapRow';
import { SkeletonDestinationDetail } from '../../components/common/Skeleton';
import { useDealStore } from '../../stores/dealStore';
import { useSavedStore } from '../../stores/savedStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBookingFlowStore } from '../../stores/bookingFlowStore';
import { colors, fonts, spacing } from '../../theme/tokens';
import { shareDestination } from '../../utils/share';
import { showToast } from '../../stores/toastStore';
import { lightHaptic, mediumHaptic, successHaptic } from '../../utils/haptics';
import type { BoardDeal } from '../../types/deal';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = 360;

const DEAL_TIER_COLORS: Record<string, string> = {
  amazing: colors.dealAmazing,
  great: colors.dealGreat,
  good: colors.dealGood,
  fair: colors.muted,
};

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

function upgradeUnsplashUrl(url: string, width: number): string {
  if (!url || !url.includes('unsplash.com')) return url;
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

function PriceAlertCTA({ deal }: { deal: BoardDeal }) {
  const [email, setEmail] = useState('');
  const defaultTarget = deal.price ? Math.round(deal.price * 0.9) : null;
  const [thresholdText, setThresholdText] = useState(defaultTarget ? String(defaultTarget) : '');
  const [status, setStatus] = useState<'idle' | 'input' | 'sending' | 'done' | 'error'>('idle');

  const targetPrice = parseInt(thresholdText, 10) || defaultTarget;

  const handleCreate = async () => {
    if (!email.trim() || !email.includes('@')) return;
    if (!targetPrice || targetPrice <= 0) return;
    setStatus('sending');
    try {
      const res = await fetch(`${API_BASE}/api/price-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_id: deal.id,
          target_price: targetPrice,
          email: email.trim(),
        }),
      });
      if (res.ok) {
        setStatus('done');
        successHaptic();
        showToast(`Price alert set for ${deal.destination}!`);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <View style={[alertStyles.cta, { borderColor: colors.dealAmazing + '40' }]}>
        <Ionicons name="checkmark-circle" size={24} color={colors.dealAmazing} />
        <View style={{ flex: 1 }}>
          <Text style={[alertStyles.title, { color: colors.dealAmazing }]}>Tracking this price</Text>
          <Text style={alertStyles.desc}>We'll email you when {deal.destination} drops below ${targetPrice}</Text>
        </View>
      </View>
    );
  }

  if (status === 'input' || status === 'sending' || status === 'error') {
    return (
      <View style={alertStyles.cta}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={alertStyles.title}>Set your target price</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.yellow }}>$</Text>
            <TextInput
              style={[alertStyles.emailInput, { maxWidth: 100 }]}
              placeholder={defaultTarget ? String(defaultTarget) : '0'}
              placeholderTextColor={colors.muted + '60'}
              value={thresholdText}
              onChangeText={(t) => setThresholdText(t.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={alertStyles.emailInput}
              placeholder="your@email.com"
              placeholderTextColor={colors.muted + '60'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={({ pressed }) => [alertStyles.btn, pressed && { opacity: 0.85 }, status === 'sending' && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={status === 'sending'}
            >
              <Ionicons name="notifications" size={16} color={colors.bg} />
              <Text style={alertStyles.btnText}>{status === 'sending' ? '...' : 'Set Alert'}</Text>
            </Pressable>
          </View>
          {status === 'error' && (
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: '#E85D4A' }}>Something went wrong. Try again.</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={alertStyles.cta}>
      <View style={{ flex: 1 }}>
        <Text style={alertStyles.title}>Track this price</Text>
        <Text style={alertStyles.desc}>Get notified when {deal.destination} drops below ${defaultTarget}</Text>
      </View>
      <Pressable style={({ pressed }) => [alertStyles.btn, pressed && { opacity: 0.85 }]} onPress={() => setStatus('input')}>
        <Ionicons name="notifications-outline" size={18} color={colors.bg} />
        <Text style={alertStyles.btnText}>Alert</Text>
      </Pressable>
    </View>
  );
}

const alertStyles = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.cell,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.yellow,
  },
  desc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  emailInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.white,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.yellow,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.bg,
  },
});

export default function DestinationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const allDeals = useDealStore((s) => s.deals);
  const localDeal = allDeals.find((d) => d.id === id);
  const savedIds = useSavedStore((s) => s.savedIds);
  const toggle = useSavedStore((s) => s.toggle);

  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';
  const [animate, setAnimate] = useState(false);
  const [serverDeal, setServerDeal] = useState<BoardDeal | null>(null);
  const [loadingServer, setLoadingServer] = useState(false);

  // Escape key goes back on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [router]);

  // If deal not in local store (e.g. deep link), fetch from server
  useEffect(() => {
    if (!localDeal && id && !serverDeal && !loadingServer) {
      setLoadingServer(true);
      fetch(`/api/destination?id=${encodeURIComponent(id)}&origin=${encodeURIComponent(departureCode)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && data.city) {
            setServerDeal(data as BoardDeal);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingServer(false));
    }
  }, [id, localDeal, departureCode]);

  const deal = localDeal || serverDeal;
  const isSaved = deal ? savedIds.includes(deal.id) : false;

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

  const handleShare = useCallback(async () => {
    if (!deal) return;
    lightHaptic();
    const shared = await shareDestination(deal.destination, deal.country, deal.tagline, deal.id, deal.price ?? undefined);
    if (shared) showToast('Link copied!');
  }, [deal]);

  const handleBook = useCallback(() => {
    if (!deal) return;
    mediumHaptic();
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
        {loadingServer ? (
          <SkeletonDestinationDetail />
        ) : (
          <View style={styles.notFound}>
            <Text style={styles.notFoundText}>Deal not found</Text>
          </View>
        )}
      </View>
    );
  }

  // Parallax scroll tracking for web
  const scrollY = useRef(new Animated.Value(0)).current;
  const parallaxTransform = Platform.OS === 'web' ? {
    transform: [{ translateY: Animated.multiply(scrollY, -0.35) }],
  } : {};

  const pageTitle = `${deal.destination}, ${deal.country} — ${deal.priceFormatted || 'Flights'} | SoGoJet`;
  const pageDesc = deal.tagline || `Find cheap flights to ${deal.destination} from ${departureCode}`;

  return (
    <View style={styles.container}>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:image" content={`${API_BASE}/api/og?id=${deal.id}`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${API_BASE}/api/og?id=${deal.id}`} />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
      </Head>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <Animated.ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
      >
        {/* Hero image with parallax */}
        <View style={styles.hero}>
          {Platform.OS === 'web' ? (
            <Animated.View style={[StyleSheet.absoluteFillObject, parallaxTransform, { overflow: 'hidden' }]}>
              <img
                src={upgradeUnsplashUrl(deal.imageUrl, 1600)}
                srcSet={`${upgradeUnsplashUrl(deal.imageUrl, 1080)} 1080w, ${upgradeUnsplashUrl(deal.imageUrl, 1600)} 1600w, ${upgradeUnsplashUrl(deal.imageUrl, 2400)} 2400w`}
                sizes="100vw"
                alt=""
                style={{ width: '100%', height: '130%', objectFit: 'cover', objectPosition: 'center' }}
              />
            </Animated.View>
          ) : (
            <Image
              source={{ uri: deal.imageUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={400}
            />
          )}
          <LinearGradient
            colors={['rgba(10,8,6,0.4)', 'transparent', 'rgba(10,8,6,0.95)']}
            locations={[0, 0.3, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Nav */}
          <Pressable
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
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

        {/* Flight route visual */}
        <View style={styles.routeCard}>
          <View style={styles.routeEndpoint}>
            <Text style={styles.routeCode}>{departureCode}</Text>
            <Text style={styles.routeLabel}>Origin</Text>
          </View>
          <View style={styles.routeLine}>
            <View style={styles.routeDot} />
            <View style={styles.routeDash} />
            <Ionicons name="airplane" size={16} color={colors.yellow} />
            <View style={styles.routeDash} />
            <View style={styles.routeDot} />
          </View>
          <View style={styles.routeEndpoint}>
            <Text style={styles.routeCode}>{deal.iataCode || '???'}</Text>
            <Text style={styles.routeLabel}>{deal.destination}</Text>
          </View>
          <View style={styles.routeMeta}>
            <Text style={styles.routeMetaText}>{deal.airline} · {deal.flightDuration}</Text>
            {deal.isNonstop && <Text style={[styles.routeMetaText, { color: colors.dealAmazing }]}>Nonstop</Text>}
          </View>
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

        {/* Weather & Best Time */}
        {(deal.averageTemp || (deal.bestMonths && deal.bestMonths.length > 0)) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WEATHER & BEST TIME</Text>
            <View style={styles.detailGrid}>
              {deal.averageTemp && (
                <DetailItem icon="thermometer-outline" label="Avg Temp" value={`${deal.averageTemp}°F`} />
              )}
              {deal.bestMonths && deal.bestMonths.length > 0 && (
                <DetailItem icon="sunny-outline" label="Best Months" value={deal.bestMonths.slice(0, 3).join(', ')} />
              )}
            </View>
          </View>
        )}

        {/* Budget Estimate */}
        {(deal.price || deal.hotelPricePerNight) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BUDGET ESTIMATE</Text>
            <View style={styles.budgetRows}>
              {deal.price && (
                <View style={styles.budgetRow}>
                  <Text style={styles.budgetLabel}>Flights (round trip)</Text>
                  <Text style={styles.budgetValue}>${deal.price}</Text>
                </View>
              )}
              {deal.hotelPricePerNight && (
                <View style={styles.budgetRow}>
                  <Text style={styles.budgetLabel}>Hotel (per night)</Text>
                  <Text style={styles.budgetValue}>${deal.hotelPricePerNight}</Text>
                </View>
              )}
              {deal.price && deal.hotelPricePerNight && deal.tripDays && (
                <View style={[styles.budgetRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[styles.budgetLabel, { fontFamily: fonts.bodyBold }]}>Est. Total ({deal.tripDays} nights)</Text>
                  <Text style={[styles.budgetValue, { color: colors.yellow }]}>
                    ${Math.round(deal.price + deal.hotelPricePerNight * (deal.tripDays - 1))}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Vibe tags */}
        {deal.vibeTags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VIBES</Text>
            <View style={styles.vibeRow}>
              {deal.vibeTags.map((tag: string) => (
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
            {deal.itinerary.map((day: { day: number; activities: string[] }) => (
              <View key={day.day} style={styles.itineraryDay}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>Day {day.day}</Text>
                </View>
                <View style={styles.dayActivities}>
                  {day.activities.map((activity: string, i: number) => (
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
            {deal.restaurants.map((r: { name: string; type: string; rating: number }, i: number) => (
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
          <PriceAlertCTA deal={deal} />
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
                  accessibilityRole="button"
                  accessibilityLabel={`${sd.destination}, ${sd.country}${sd.price != null ? `, ${sd.priceFormatted}` : ''}`}
                  accessibilityHint="View destination details"
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

        {/* Get the App CTA */}
        {Platform.OS === 'web' && (
          <View style={styles.appCta}>
            <Text style={styles.appCtaTitle}>GET THE FULL EXPERIENCE</Text>
            <Text style={styles.appCtaText}>
              Book flights, get price drop alerts, compare deals side-by-side, and more — all in the SoGoJet iOS app.
            </Text>
            <Pressable
              style={styles.appCtaButton}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.open('https://apps.apple.com/app/sogojet/id6746076960', '_blank');
                }
              }}
            >
              <Ionicons name="logo-apple" size={18} color="#0A0806" />
              <Text style={styles.appCtaButtonText}>Download on the App Store</Text>
            </Pressable>
          </View>
        )}

        {/* Spacer for bottom bar */}
        <View style={{ height: 120 }} />
      </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.saveBtn}
          onPress={() => { lightHaptic(); toggle(deal); if (!isSaved) showToast(`${deal.destination} saved`); }}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? `Unsave ${deal.destination}` : `Save ${deal.destination}`}
          accessibilityState={{ selected: isSaved }}
        >
          <Ionicons
            name={isSaved ? 'heart' : 'heart-outline'}
            size={24}
            color={isSaved ? '#E85D4A' : colors.white}
          />
        </Pressable>
        <Pressable
          style={styles.saveBtn}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel={`Share ${deal.destination} deal`}
        >
          <Ionicons name="share-outline" size={22} color={colors.white} />
        </Pressable>
        <Pressable
          style={styles.bookBtn}
          onPress={handleBook}
          accessibilityRole="button"
          accessibilityLabel={`Search flights to ${deal.destination}`}
        >
          <Text style={styles.bookLabel}>
            Search Flights
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bg} />
        </Pressable>
      </View>
    </View>
  );
}

function DetailItem({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={16} color={colors.green} />
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

  // Budget
  budgetRows: {
    gap: 6,
  },
  budgetRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  budgetLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },
  budgetValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
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

  // Route card
  routeCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.cell,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8,
  },
  routeEndpoint: {
    alignItems: 'center',
  },
  routeCode: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.white,
    letterSpacing: 2,
  },
  routeLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.yellow + '60',
  },
  routeDash: {
    width: 40,
    height: 1,
    backgroundColor: colors.border,
  },
  routeMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  routeMetaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
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

  // App download CTA
  appCta: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.cell,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center' as const,
    gap: 12,
  },
  appCtaTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.yellow,
    letterSpacing: 2,
    textAlign: 'center' as const,
  },
  appCtaText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  appCtaButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: colors.yellow,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  appCtaButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#0A0806',
  },

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
