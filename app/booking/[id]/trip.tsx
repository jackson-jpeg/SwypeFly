import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useDealStore } from '../../../stores/dealStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useBookingFlowStore } from '../../../stores/bookingFlowStore';
import TripHeroCard from '../../../components/booking/TripHeroCard';
import AlternativeTrips from '../../../components/booking/AlternativeTrips';
import type { TripOption } from '../../../components/booking/AlternativeTrips';
import { colors, fonts, spacing } from '../../../theme/tokens';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

// ─── Helpers ──────────────────────────────────────────────────────────

function upgradeImageUrl(url: string, width: number): string {
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

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T00:00:00').getTime();
  const msB = new Date(b + 'T00:00:00').getTime();
  return Math.round((msB - msA) / 86400000);
}

// ─── Component ────────────────────────────────────────────────────────

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const deal = useDealStore((s) => s.deals.find((d) => d.id === id));
  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';

  const [selectedTrip, setSelectedTrip] = useState<{
    departureDate: string;
    returnDate: string;
    price: number;
    airline: string;
    stops: number;
    nights: number;
  } | null>(null);
  const [alternatives, setAlternatives] = useState<TripOption[]>([]);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [dealExpired, setDealExpired] = useState(false);

  // ─── Redirect if no cheapestDate ────────────────────────────────

  useEffect(() => {
    if (!deal) return;
    if (!deal.iataCode) {
      router.replace(`/booking/${id}/dates` as never);
      return;
    }
    if (!deal.cheapestDate) {
      router.replace(`/booking/${id}/dates` as never);
    }
  }, [deal, id, router]);

  // ─── Build initial selected trip from deal ──────────────────────

  useEffect(() => {
    if (!deal || !deal.cheapestDate) return;

    const depDate = deal.cheapestDate;
    const retDate = deal.cheapestReturnDate || addDays(depDate, deal.tripDays || 5);
    const nights = daysBetween(depDate, retDate);

    setSelectedTrip({
      departureDate: depDate,
      returnDate: retDate,
      price: deal.price ?? 0,
      airline: deal.airline || 'Multiple Airlines',
      stops: 0,
      nights,
    });
  }, [deal]);

  // ─── Fetch calendar alternatives ────────────────────────────────

  useEffect(() => {
    if (!deal || !deal.iataCode) return;

    const fetchCalendar = async () => {
      try {
        const params = new URLSearchParams({
          action: 'calendar',
          origin: departureCode,
          destination: deal.iataCode,
        });
        const res = await fetch(`${API_BASE}/api/destination?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        const calendar: { date: string; price: number; airline: string; transferCount: number }[] =
          data.calendar || [];

        if (calendar.length === 0) return;

        // Build alternatives: skip dates within 3 days of already-added ones
        const tripNights = deal.tripDays || 5;
        const seen = new Set<string>();

        // Skip the current selected cheapest date
        if (deal.cheapestDate) {
          seen.add(deal.cheapestDate);
        }

        const alts: TripOption[] = [];
        // Sort by price ascending
        const sorted = [...calendar].sort((a, b) => a.price - b.price);

        for (const entry of sorted) {
          if (alts.length >= 4) break;

          const tooClose = Array.from(seen).some((d) => {
            const diff = Math.abs(new Date(entry.date).getTime() - new Date(d).getTime());
            return diff < 3 * 86400000;
          });
          if (tooClose) continue;

          seen.add(entry.date);
          alts.push({
            departureDate: entry.date,
            returnDate: addDays(entry.date, tripNights),
            price: entry.price,
            airline: entry.airline || deal.airline || '',
            nights: tripNights,
            stops: entry.transferCount ?? 0,
          });
        }

        setAlternatives(alts);
      } catch {
        // Non-fatal — no alternatives shown
      }
    };

    fetchCalendar();
  }, [deal, departureCode]);

  // ─── Handle alternative selection ───────────────────────────────

  const handleSelectAlternative = useCallback((trip: TripOption) => {
    setSelectedTrip({
      departureDate: trip.departureDate,
      returnDate: trip.returnDate,
      price: trip.price,
      airline: trip.airline,
      stops: trip.stops,
      nights: trip.nights,
    });
    setBookError(null);
  }, []);

  // ─── Book this trip ─────────────────────────────────────────────

  const handleBook = useCallback(async () => {
    if (!deal || !selectedTrip) return;

    setBooking(true);
    setBookError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${API_BASE}/api/booking?action=search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          origin: departureCode,
          destination: deal.iataCode,
          departureDate: selectedTrip.departureDate,
          returnDate: selectedTrip.returnDate,
          passengers: [{ type: 'adult' }],
          cabinClass: 'economy',
          priceHint: selectedTrip.price,
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Search failed (${res.status})`);
      }

      const data = await res.json();
      // Handle both { offers, priceDiscrepancy } and legacy flat array
      const offers = Array.isArray(data) ? data : (data.offers || []);
      const priceDiscrepancy = Array.isArray(data) ? undefined : data.priceDiscrepancy;

      if (!offers || offers.length === 0) {
        throw new Error('No flights available for these dates');
      }

      const bestOffer = offers[0];
      const duffelPrice = parseFloat(bestOffer.totalAmount || bestOffer.price || '0');

      // Price discrepancy handling with tiered messaging
      if (priceDiscrepancy) {
        if (priceDiscrepancy.tier === 'deal_expired') {
          // Deal is gone — show dedicated expired screen
          setDealExpired(true);
          setBooking(false);
          return;
        }

        if (priceDiscrepancy.tier === 'moderate_increase' || priceDiscrepancy.tier === 'significant_increase') {
          const proceed = await new Promise<boolean>((resolve) => {
            const msg = priceDiscrepancy.message;
            if (Platform.OS === 'web') {
              resolve(window.confirm(msg));
            } else {
              Alert.alert('Price changed', msg, [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Continue', onPress: () => resolve(true) },
              ]);
            }
          });
          if (!proceed) {
            setBooking(false);
            return;
          }
        }
        // 'cheaper' and 'similar' tiers proceed without interruption
      } else if (duffelPrice > selectedTrip.price * 1.5) {
        // Fallback for API without priceDiscrepancy (backwards compat)
        const proceed = await new Promise<boolean>((resolve) => {
          const msg = `Live price is $${Math.round(duffelPrice)} (calendar showed $${selectedTrip.price}). Continue?`;
          if (Platform.OS === 'web') {
            resolve(window.confirm(msg));
          } else {
            Alert.alert('Price changed', msg, [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Continue', onPress: () => resolve(true) },
            ]);
          }
        });
        if (!proceed) {
          setBooking(false);
          return;
        }
      }

      // Store dates + offerId and navigate
      const store = useBookingFlowStore.getState();
      store.setDates(selectedTrip.departureDate, selectedTrip.returnDate);
      store.setOfferId(bestOffer.id);
      router.push(`/booking/${id}/passengers?offerId=${bestOffer.id}` as never);
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setBookError('Search timed out — please try again or try different dates');
      } else {
        setBookError((e as Error).message);
      }
    } finally {
      setBooking(false);
    }
  }, [deal, selectedTrip, departureCode, id, router]);

  // ─── Guards ─────────────────────────────────────────────────────

  if (!deal) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>Destination not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtnInline}>
            <Text style={styles.backBtnInlineText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Deal expired screen ─────────────────────────────────────
  if (dealExpired) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Ionicons name="timer-outline" size={64} color="#E85D4A" />
          <Text style={styles.expiredTitle}>Deal Expired</Text>
          <Text style={styles.expiredDesc}>
            The price for {deal.destination} has increased significantly since we found this deal.
            Flight prices change constantly — set an alert to catch the next drop.
          </Text>
          <Pressable
            style={styles.expiredAlertBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="notifications-outline" size={18} color={colors.bg} />
            <Text style={styles.expiredAlertText}>Set Price Alert</Text>
          </Pressable>
          <Pressable
            style={styles.expiredBackBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.expiredBackText}>Back to deals</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!deal.cheapestDate) {
    // Redirect handled in useEffect; show loader while navigating
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.yellow} size="large" />
        </View>
      </View>
    );
  }

  if (!selectedTrip) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.yellow} size="large" />
        </View>
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.yellow} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {deal.destinationFull || deal.destination}
          </Text>
          <Text style={styles.headerMeta}>
            {deal.country} · {deal.flightDuration}
          </Text>
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Destination photo */}
        {deal.imageUrl ? (
          <View style={styles.heroImage}>
            {Platform.OS === 'web' ? (
              <img
                src={upgradeImageUrl(deal.imageUrl, 1200)}
                srcSet={`${upgradeImageUrl(deal.imageUrl, 800)} 800w, ${upgradeImageUrl(deal.imageUrl, 1200)} 1200w`}
                sizes="100vw"
                alt={deal.destinationFull || deal.destination}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }}
              />
            ) : (
              <Image
                source={{ uri: deal.imageUrl }}
                style={{ width: '100%', height: '100%', borderRadius: 12 }}
                contentFit="cover"
              />
            )}
          </View>
        ) : null}

        {/* Tagline + vibes */}
        {deal.tagline ? (
          <Text style={styles.tagline}>{deal.tagline}</Text>
        ) : null}
        {deal.vibeTags?.length > 0 && (
          <View style={styles.vibeRow}>
            {deal.vibeTags.slice(0, 4).map((tag) => (
              <View key={tag} style={styles.vibeChip}>
                <Text style={styles.vibeText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Hero card */}
        <TripHeroCard
          price={selectedTrip.price}
          departureDate={selectedTrip.departureDate}
          returnDate={selectedTrip.returnDate}
          airline={selectedTrip.airline}
          stops={selectedTrip.stops}
          origin={departureCode}
          destination={deal.iataCode}
          nights={selectedTrip.nights}
        />

        {/* Alternative trips */}
        <AlternativeTrips
          alternatives={alternatives}
          onSelect={handleSelectAlternative}
        />

        {/* Calendar link */}
        <Pressable
          onPress={() => router.push(`/booking/${id}/dates` as never)}
          hitSlop={8}
          style={styles.calendarLink}
        >
          <Text style={styles.calendarLinkText}>See full price calendar →</Text>
        </Pressable>

        {/* Error banner */}
        {bookError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={18} color={colors.orange} />
            <Text style={styles.errorBannerText}>{bookError}</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          onPress={handleBook}
          disabled={booking}
          style={[styles.ctaBtn, booking && styles.ctaBtnDisabled]}
        >
          {booking ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <Text style={styles.ctaBtnText}>
              Book this trip · ${selectedTrip.price}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.yellow,
    letterSpacing: 2,
  },
  headerMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },

  // Tagline + vibes
  tagline: {
    fontFamily: fonts.accent,
    fontSize: 16,
    color: colors.whiteDim,
    lineHeight: 22,
    marginTop: -4,
  },
  vibeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: -4,
  },
  vibeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vibeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Hero image
  heroImage: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },

  // Calendar link
  calendarLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  calendarLinkText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'underline',
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.orange + '15',
    borderWidth: 1,
    borderColor: colors.orange + '40',
    borderRadius: 10,
  },
  errorBannerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.orange,
    flex: 1,
  },

  // Bottom CTA
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.green + '30',
  },
  ctaBtn: {
    backgroundColor: colors.yellow,
    borderRadius: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaBtnDisabled: {
    opacity: 0.7,
  },
  ctaBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.bg,
  },

  // Empty / loading states
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  backBtnInline: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  backBtnInlineText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.yellow,
  },

  // Deal expired screen
  expiredTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.white,
    marginTop: spacing.lg,
    letterSpacing: 1,
  },
  expiredDesc: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  expiredAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.green,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: spacing.xl,
  },
  expiredAlertText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.bg,
  },
  expiredBackBtn: {
    marginTop: spacing.md,
    paddingVertical: 10,
  },
  expiredBackText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
});
