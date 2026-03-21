import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import SplitFlapRow from '../../../components/board/SplitFlapRow';
import TripBanner from '../../../components/booking/TripBanner';
import { useDealStore } from '../../../stores/dealStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useBookingFlowStore } from '../../../stores/bookingFlowStore';
import { colors, fonts, spacing } from '../../../theme/tokens';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

// Fallback departure date: ~2 weeks out, shifted to next Wednesday
function getDefaultDepartureDate(): string {
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 86400000);
  const dayOfWeek = twoWeeksOut.getDay();
  const daysUntilWed = (3 - dayOfWeek + 7) % 7 || 7;
  const departure = new Date(twoWeeksOut.getTime() + daysUntilWed * 86400000);
  return departure.toISOString().split('T')[0];
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Types ────────────────────────────────────────────────────────────

interface OfferSlice {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  airline: string;
  flightNumber: string;
  aircraft: string;
}

interface Offer {
  id: string;
  totalAmount: number;
  totalCurrency: string;
  baseAmount: number;
  taxAmount: number;
  slices: OfferSlice[];
  cabinClass: string;
  passengers: { id: string; type: string }[];
  expiresAt: string;
  availableServices: {
    id: string;
    type: string;
    name: string;
    amount: number;
    currency: string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return iso;
  }
}

function formatDuration(dur: string): string {
  // Parse ISO 8601 duration: P1DT8H20M or PT2H30M
  const match = dur.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return dur;
  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10) + days * 24;
  const minutes = parseInt(match[3] || '0', 10);
  return `${hours}h ${minutes}m`;
}

function stopsLabel(stops: number): string {
  if (stops === 0) return 'Direct';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
}

// ─── Component ────────────────────────────────────────────────────────

export default function FlightSelectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const deal = useDealStore((s) => s.deals.find((d) => d.id === id));
  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';
  const storeDepartureDate = useBookingFlowStore((s) => s.departureDate);
  const storeReturnDate = useBookingFlowStore((s) => s.returnDate);
  const feedPrice = useBookingFlowStore((s) => s.feedPrice);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [animate, setAnimate] = useState(false);

  // ─── Search flights ─────────────────────────────────────────────

  const searchFlights = useCallback(async () => {
    if (!deal) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/booking?action=search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: departureCode,
          destination: deal.iataCode,
          departureDate: storeDepartureDate || deal.departureDate || getDefaultDepartureDate(),
          returnDate: storeReturnDate || deal.returnDate || undefined,
          passengers: [{ type: 'adult' }],
          cabinClass: 'economy',
          priceHint: deal.price || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Search failed (${res.status})`);
      }

      const raw = await res.json();
      // Handle both { offers } and legacy flat array
      const data: Offer[] = Array.isArray(raw) ? raw : (raw.offers || []);
      setOffers(data.slice(0, 3));
      if (data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [deal, departureCode]);

  useEffect(() => {
    searchFlights();
  }, [searchFlights]);

  // Trigger split-flap animation after mount
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  // ─── No deal guard ──────────────────────────────────────────────

  if (!deal) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.errorText}>Deal not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.yellow} />
        </Pressable>
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
        <View style={styles.headerTitle}>
          <SplitFlapRow
            text="SELECT FLIGHT"
            maxLength={14}
            size="md"
            color={colors.yellow}
            align="left"
            animate={animate}
          />
        </View>
      </View>

      {/* Trip context */}
      <TripBanner />
      <View style={styles.subtitleRow}>
        <Text style={styles.subtitle}>
          {deal.destinationFull || deal.destination} from {departureCode}
          {storeDepartureDate ? ` · ${formatShortDate(storeDepartureDate)}` : ''}
          {storeReturnDate ? ` – ${formatShortDate(storeReturnDate)}` : ''}
        </Text>
        <Pressable onPress={() => router.push(`/booking/${id}/dates`)} hitSlop={8}>
          <Text style={styles.changeDates}>Change dates</Text>
        </Pressable>
      </View>
      <View style={styles.divider} />

      {/* Price divergence info banner */}
      {!loading &&
        feedPrice != null &&
        offers.length > 0 &&
        Math.abs(offers[0].totalAmount - feedPrice) / feedPrice > 0.2 && (
          <View style={styles.priceBanner}>
            <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
            <Text style={styles.priceBannerText}>
              Live prices for your dates — may differ from browse estimates
            </Text>
          </View>
        )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <SplitFlapRow
            text="SEARCHING"
            maxLength={12}
            size="lg"
            color={colors.yellow}
            align="left"
            animate={animate}
          />
          <ActivityIndicator color={colors.yellow} size="large" style={{ marginTop: spacing.lg }} />
          <Text style={styles.loadingHint}>Finding the best flights...</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.orange} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={searchFlights} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : offers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="airplane-outline" size={48} color={colors.muted} />
          <Text style={styles.errorText}>No flights found for these dates</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {offers.map((offer, idx) => {
            const isSelected = offer.id === selectedId;
            const outbound = offer.slices[0];
            const returnSlice = offer.slices.length > 1 ? offer.slices[1] : null;

            return (
              <Pressable
                key={offer.id}
                onPress={() => setSelectedId(offer.id)}
                style={[styles.card, isSelected && styles.cardSelected]}
              >
                {/* Card header: airline + price */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <SplitFlapRow
                      text={outbound?.airline || 'AIRLINE'}
                      maxLength={12}
                      size="sm"
                      color={colors.white}
                      align="left"
                      animate={animate}
                      startDelay={idx * 150}
                    />
                    <Text style={styles.flightNumber}>{outbound?.flightNumber || ''}</Text>
                  </View>
                  <SplitFlapRow
                    text={`$${offer.totalAmount}`}
                    maxLength={8}
                    size="md"
                    color={colors.yellow}
                    align="right"
                    animate={animate}
                    startDelay={idx * 150 + 100}
                  />
                </View>

                <View style={styles.cardDivider} />

                {/* Outbound slice */}
                {outbound && (
                  <View style={styles.sliceRow}>
                    <View style={styles.sliceEndpoint}>
                      <Text style={styles.sliceTime}>{formatTime(outbound.departureTime)}</Text>
                      <Text style={styles.sliceCode}>{outbound.origin}</Text>
                    </View>
                    <View style={styles.sliceCenter}>
                      <Text style={styles.sliceDuration}>{formatDuration(outbound.duration)}</Text>
                      <View style={styles.sliceLine}>
                        <View style={styles.sliceDot} />
                        <View style={styles.sliceTrack} />
                        <Ionicons name="airplane" size={14} color={colors.green} />
                      </View>
                      <Text style={styles.sliceStops}>{stopsLabel(outbound.stops)}</Text>
                    </View>
                    <View style={[styles.sliceEndpoint, { alignItems: 'flex-end' }]}>
                      <Text style={styles.sliceTime}>{formatTime(outbound.arrivalTime)}</Text>
                      <Text style={styles.sliceCode}>{outbound.destination}</Text>
                    </View>
                  </View>
                )}

                {/* Return slice */}
                {returnSlice && (
                  <>
                    <View style={[styles.cardDivider, { marginVertical: spacing.sm }]} />
                    <View style={styles.sliceRow}>
                      <View style={styles.sliceEndpoint}>
                        <Text style={styles.sliceTime}>
                          {formatTime(returnSlice.departureTime)}
                        </Text>
                        <Text style={styles.sliceCode}>{returnSlice.origin}</Text>
                      </View>
                      <View style={styles.sliceCenter}>
                        <Text style={styles.sliceDuration}>
                          {formatDuration(returnSlice.duration)}
                        </Text>
                        <View style={styles.sliceLine}>
                          <View style={styles.sliceDot} />
                          <View style={styles.sliceTrack} />
                          <Ionicons name="airplane" size={14} color={colors.green} />
                        </View>
                        <Text style={styles.sliceStops}>{stopsLabel(returnSlice.stops)}</Text>
                      </View>
                      <View style={[styles.sliceEndpoint, { alignItems: 'flex-end' }]}>
                        <Text style={styles.sliceTime}>
                          {formatTime(returnSlice.arrivalTime)}
                        </Text>
                        <Text style={styles.sliceCode}>{returnSlice.destination}</Text>
                      </View>
                    </View>
                  </>
                )}

                {/* Cabin + selection indicator */}
                <View style={styles.cardFooter}>
                  <Text style={styles.cabinLabel}>
                    {offer.cabinClass?.toUpperCase() || 'ECONOMY'}
                  </Text>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.yellow} />
                      <Text style={styles.selectedText}>SELECTED</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Continue button */}
      {!loading && !error && offers.length > 0 && selectedId && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            onPress={() => {
              useBookingFlowStore.getState().setOfferId(selectedId);
              router.push(`/booking/${id}/passengers?offerId=${selectedId}` as never);
            }}
            style={styles.continueBtn}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.bg} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
  headerTitle: {
    flex: 1,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    flex: 1,
  },
  changeDates: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.yellow,
    marginLeft: spacing.sm,
  },
  priceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
  priceBannerText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    flex: 1,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.green + '30',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingHint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.md,
  },

  // Error
  errorText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.yellow,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },

  // Offer card
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardSelected: {
    borderColor: colors.yellow,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  flightNumber: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.faint,
    marginTop: 2,
  },
  cardDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.green + '30',
    marginVertical: spacing.sm,
  },

  // Slice row
  sliceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  sliceEndpoint: {
    width: 60,
  },
  sliceTime: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
  sliceCode: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  sliceCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  sliceDuration: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginBottom: 4,
  },
  sliceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  sliceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  sliceTrack: {
    flex: 1,
    height: 1,
    backgroundColor: colors.green + '40',
  },
  sliceStops: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.faint,
    marginTop: 4,
  },

  // Card footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cabinLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.faint,
    letterSpacing: 1,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectedText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.yellow,
    letterSpacing: 1,
  },

  // Bottom bar
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
  continueBtn: {
    backgroundColor: colors.yellow,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  continueBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.bg,
  },
});
