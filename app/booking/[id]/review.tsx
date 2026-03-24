import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import SplitFlapRow from '../../../components/board/SplitFlapRow';
import TripBanner from '../../../components/booking/TripBanner';
import { useBookingFlowStore } from '../../../stores/bookingFlowStore';
import { useDealStore } from '../../../stores/dealStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { colors, fonts, spacing } from '../../../theme/tokens';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

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
}

interface OfferData {
  id: string;
  totalAmount: number;
  totalCurrency: string;
  baseAmount: number;
  taxAmount: number;
  slices: OfferSlice[];
  passengers: { id: string; type: string }[];
  expiresAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    // Append T00:00:00 to force local timezone interpretation for date-only strings
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

// ─── Component ────────────────────────────────────────────────────────

export default function ReviewPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const offerId = useBookingFlowStore((s) => s.selectedOfferId);
  const passengers = useBookingFlowStore((s) => s.passengers);
  const selectedSeats = useBookingFlowStore((s) => s.selectedSeats);
  const resetBooking = useBookingFlowStore((s) => s.reset);

  const deal = useDealStore((s) => s.deals.find((d) => d.id === id));
  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';

  const [offer, setOffer] = useState<OfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animate, setAnimate] = useState(false);

  // Payment state
  const [paying, setPaying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [bookingRef, setBookingRef] = useState<string | null>(null);

  // Price change modal
  const [priceChangeModal, setPriceChangeModal] = useState<{
    visible: boolean;
    newPrice: number;
    newOfferId: string;
  }>({ visible: false, newPrice: 0, newOfferId: '' });

  // ─── Fetch offer details ───────────────────────────────────────

  const fetchOffer = useCallback(async (oid: string) => {
    const res = await fetch(`${API_BASE}/api/booking?action=offer&offerId=${oid}`);
    if (!res.ok) throw new Error(`Failed to load offer (${res.status})`);
    const data = await res.json();
    return (data.offer || data) as OfferData;
  }, []);

  useEffect(() => {
    if (!offerId) {
      setError('No offer selected');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchOffer(offerId)
      .then((offerData) => {
        if (cancelled) return;
        // Check if offer has already expired
        if (offerData.expiresAt && new Date(offerData.expiresAt) < new Date()) {
          setRefreshing(true);
          // Re-search for a fresh offer
          return fetch(`${API_BASE}/api/booking?action=search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: departureCode,
              destination: deal?.iataCode || '',
              departureDate: deal?.departureDate || '',
            }),
          })
            .then((r) => r.json())
            .then((searchData) => {
              if (cancelled) return;
              const newOffer = searchData.offers?.[0];
              if (newOffer) {
                useBookingFlowStore.getState().setOfferId(newOffer.id);
                // Will re-trigger this effect with new offerId
              } else {
                setError('No flights available. Please go back and search again.');
              }
            })
            .finally(() => { if (!cancelled) setRefreshing(false); });
        }
        setOffer(offerData);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [offerId, fetchOffer, departureCode, deal]);

  // Trigger animation
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  // ─── Price calculation ─────────────────────────────────────────

  const seatCost = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const totalAmount = (offer?.totalAmount || 0) + seatCost;
  const totalInCents = Math.round(totalAmount * 100);

  // ─── Payment flow ──────────────────────────────────────────────

  const handleConfirmBooking = useCallback(async () => {
    if (!offer || !offerId) return;

    setPaying(true);

    try {
      // Step 1: Create payment intent
      const piRes = await fetch(`${API_BASE}/api/booking?action=payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId,
          amount: totalInCents,
          currency: 'USD',
        }),
      });

      if (piRes.status === 409) {
        // Price changed
        const piData = await piRes.json();
        setPriceChangeModal({
          visible: true,
          newPrice: piData.newPrice || totalAmount,
          newOfferId: piData.newOfferId || offerId,
        });
        setPaying(false);
        return;
      }

      if (!piRes.ok) {
        throw new Error(`Payment failed (${piRes.status})`);
      }

      const piData = await piRes.json();
      const paymentIntentId = piData.paymentIntentId || piData.id;

      // Step 2: Create order
      const passenger = passengers[0];
      const orderRes = await fetch(`${API_BASE}/api/booking?action=create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId,
          passengers: [
            {
              id: offer.passengers?.[0]?.id || 'pas_0',
              given_name: passenger?.givenName || 'Guest',
              family_name: passenger?.familyName || 'Traveler',
              born_on: passenger?.bornOn || '1990-01-01',
              gender: passenger?.gender || 'm',
              title: passenger?.title || 'mr',
              email: passenger?.email || '',
              phone_number: (passenger?.phoneNumber || '').replace(/[\s\-()]/g, ''),
            },
          ],
          selectedServices: selectedSeats
            .filter((s) => s.serviceId)
            .map((s) => ({ id: s.serviceId })),
          paymentIntentId,
          amount: totalInCents,
          currency: 'USD',
          destinationCity: deal?.destinationFull || '',
          originIata: departureCode,
          destinationIata: deal?.iataCode || '',
          departureDate: deal?.departureDate || '',
          returnDate: deal?.returnDate || '',
        }),
      });

      if (orderRes.status === 409) {
        const orderData = await orderRes.json();
        setPriceChangeModal({
          visible: true,
          newPrice: orderData.newPrice || totalAmount,
          newOfferId: orderData.newOfferId || offerId,
        });
        setPaying(false);
        return;
      }

      if (!orderRes.ok) {
        throw new Error(`Booking failed (${orderRes.status})`);
      }

      const orderData = await orderRes.json();
      setBookingRef(orderData.bookingReference || orderData.id || 'CONFIRMED');
      setConfirmed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPaying(false);
    }
  }, [offer, offerId, passengers, selectedSeats, deal, departureCode, totalInCents, totalAmount]);

  function handleDone() {
    resetBooking();
    router.dismissAll();
    router.replace('/(tabs)');
  }

  function formatBpDate(dateStr: string): string {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  }

  function handlePriceChangeAccept() {
    useBookingFlowStore.getState().setOfferId(priceChangeModal.newOfferId);
    setPriceChangeModal({ visible: false, newPrice: 0, newOfferId: '' });
  }

  // ─── Confirmed view ───────────────────────────────────────────

  if (confirmed) {
    const passengerName = passengers[0]
      ? `${passengers[0].givenName} ${passengers[0].familyName}`.toUpperCase()
      : 'TRAVELER';
    const destCity = deal?.destinationFull || deal?.destination || '';
    const depDate = deal?.departureDate || '';
    const retDate = deal?.returnDate || '';

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.confirmedScroll} showsVerticalScrollIndicator={false}>
          {/* Success header */}
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <Ionicons name="checkmark-circle" size={56} color={colors.green} />
            <View style={{ marginTop: spacing.sm }}>
              <SplitFlapRow
                text="CONFIRMED"
                maxLength={12}
                size="lg"
                color={colors.green}
                align="left"
                animate={true}
              />
            </View>
          </View>

          {/* Boarding pass card */}
          <View style={styles.boardingPass}>
            {/* Header strip */}
            <View style={styles.bpHeader}>
              <Text style={styles.bpBrand}>SOGOJET</Text>
              <Text style={styles.bpBoardingPass}>BOARDING PASS</Text>
            </View>

            {/* Route section */}
            <View style={styles.bpRoute}>
              <View style={styles.bpRouteEnd}>
                <Text style={styles.bpIata}>{departureCode}</Text>
                <Text style={styles.bpCityLabel}>From</Text>
              </View>
              <View style={styles.bpRouteLine}>
                <View style={styles.bpDot} />
                <View style={styles.bpDash} />
                <Ionicons name="airplane" size={18} color={colors.yellow} />
                <View style={styles.bpDash} />
                <View style={styles.bpDot} />
              </View>
              <View style={[styles.bpRouteEnd, { alignItems: 'flex-end' }]}>
                <Text style={styles.bpIata}>{deal?.iataCode || '???'}</Text>
                <Text style={styles.bpCityLabel}>{destCity}</Text>
              </View>
            </View>

            {/* Perforated divider */}
            <View style={styles.bpPerforation}>
              <View style={styles.bpNotchLeft} />
              <View style={styles.bpDottedLine} />
              <View style={styles.bpNotchRight} />
            </View>

            {/* Details grid */}
            <View style={styles.bpDetails}>
              <View style={styles.bpDetailRow}>
                <View style={styles.bpDetailItem}>
                  <Text style={styles.bpDetailLabel}>PASSENGER</Text>
                  <Text style={styles.bpDetailValue}>{passengerName}</Text>
                </View>
                <View style={styles.bpDetailItem}>
                  <Text style={styles.bpDetailLabel}>AIRLINE</Text>
                  <Text style={styles.bpDetailValue}>{deal?.airline || 'N/A'}</Text>
                </View>
              </View>
              <View style={styles.bpDetailRow}>
                <View style={styles.bpDetailItem}>
                  <Text style={styles.bpDetailLabel}>DEPART</Text>
                  <Text style={styles.bpDetailValue}>{formatBpDate(depDate)}</Text>
                </View>
                <View style={styles.bpDetailItem}>
                  <Text style={styles.bpDetailLabel}>RETURN</Text>
                  <Text style={styles.bpDetailValue}>{formatBpDate(retDate)}</Text>
                </View>
              </View>
              {bookingRef && (
                <View style={styles.bpRefRow}>
                  <Text style={styles.bpDetailLabel}>CONFIRMATION</Text>
                  <Text style={styles.bpRefCode}>{bookingRef}</Text>
                </View>
              )}
            </View>

            {/* Barcode placeholder */}
            <View style={styles.bpBarcode}>
              <View style={styles.bpBarcodeLines}>
                {Array.from({ length: 32 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.bpBarcodeLine,
                      { width: i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1, opacity: 0.4 + Math.random() * 0.4 },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.confirmedHint}>
            You&apos;ll receive a confirmation email shortly.
          </Text>

          {/* Share + Done buttons */}
          <View style={styles.confirmedActions}>
            <Pressable
              onPress={() => {
                const text = `Just booked ${destCity}! ✈️${bookingRef ? ` Ref: ${bookingRef}` : ''}`;
                if (typeof navigator !== 'undefined' && navigator.share) {
                  navigator.share({ title: 'My SoGoJet Trip', text }).catch(() => {});
                } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(text);
                }
              }}
              style={styles.shareConfirmBtn}
            >
              <Ionicons name="share-outline" size={18} color={colors.green} />
              <Text style={styles.shareConfirmText}>Share Trip</Text>
            </Pressable>
            <Pressable onPress={handleDone} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Back to Deals</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Main render ──────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.yellow} />
        </Pressable>
        <View style={styles.headerTitle}>
          <SplitFlapRow
            text="REVIEW"
            maxLength={8}
            size="md"
            color={colors.yellow}
            align="left"
            animate={animate}
          />
        </View>
      </View>

      <TripBanner />
      <View style={styles.divider} />

      {loading || refreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator color={colors.yellow} size="large" />
          <Text style={styles.loadingHint}>
            {refreshing ? 'Price may have changed — refreshing...' : 'Loading booking details...'}
          </Text>
        </View>
      ) : error && !offer ? (
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.orange} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => router.back()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Go Back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Flight summary */}
            {offer && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>FLIGHT</Text>
                {offer.slices.map((slice, i) => (
                  <View key={i} style={styles.flightCard}>
                    <View style={styles.flightRoute}>
                      <Text style={styles.flightIata}>{slice.origin}</Text>
                      <View style={styles.flightArrow}>
                        <View style={styles.flightLine} />
                        <Ionicons name="airplane" size={14} color={colors.green} />
                      </View>
                      <Text style={styles.flightIata}>{slice.destination}</Text>
                    </View>
                    <View style={styles.flightDetails}>
                      <Text style={styles.flightDetailText}>{slice.airline}</Text>
                      <Text style={styles.flightDetailText}>{slice.flightNumber}</Text>
                      <Text style={styles.flightDetailText}>{formatDateTime(slice.departureTime)}</Text>
                      <Text style={styles.flightDetailMuted}>
                        {slice.duration} {'\u00B7'} {slice.stops === 0 ? 'Direct' : `${slice.stops} stop${slice.stops > 1 ? 's' : ''}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Passengers */}
            {passengers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PASSENGERS</Text>
                {passengers.map((p, i) => (
                  <View key={i} style={styles.infoCard}>
                    <Ionicons name="person-outline" size={18} color={colors.green} />
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={styles.infoCardTitle}>
                        {p.givenName} {p.familyName}
                      </Text>
                      <Text style={styles.infoCardSub}>Born {formatDate(p.bornOn)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Seat */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SEAT</Text>
              {selectedSeats.length > 0 ? (
                selectedSeats.map((s, i) => (
                  <View key={i} style={styles.infoCard}>
                    <Ionicons name="grid-outline" size={18} color={colors.green} />
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={styles.infoCardTitle}>Seat {s.designator}</Text>
                      {s.price > 0 && (
                        <Text style={styles.infoCardSub}>
                          +${s.price} {s.currency}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.infoCard}>
                  <Ionicons name="remove-circle-outline" size={18} color={colors.faint} />
                  <Text style={[styles.infoCardTitle, { marginLeft: spacing.sm, color: colors.faint }]}>
                    No seat selected
                  </Text>
                </View>
              )}
            </View>

            {/* Price breakdown */}
            {offer && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PRICE BREAKDOWN</Text>
                <View style={styles.priceCard}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Base fare</Text>
                    <Text style={styles.priceValue}>${offer.baseAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Taxes & fees</Text>
                    <Text style={styles.priceValue}>${offer.taxAmount.toFixed(2)}</Text>
                  </View>
                  {seatCost > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Seat selection</Text>
                      <Text style={styles.priceValue}>${seatCost.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={styles.priceDivider} />
                  <View style={styles.priceRow}>
                    <Text style={styles.priceTotalLabel}>Total</Text>
                    <SplitFlapRow
                      text={`$${totalAmount.toFixed(0)}`}
                      maxLength={8}
                      size="md"
                      color={colors.yellow}
                      align="right"
                      animate={animate}
                      startDelay={300}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Error from payment */}
            {error && (
              <View style={styles.section}>
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={18} color={colors.orange} />
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Pay button */}
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Pressable
              onPress={handleConfirmBooking}
              disabled={paying || !offer}
              style={[styles.payBtn, paying && styles.payBtnDisabled]}
            >
              {paying ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <>
                  <Text style={styles.payBtnText}>
                    Confirm Booking {'\u00B7'} ${totalAmount.toFixed(0)}
                  </Text>
                  <Ionicons name="lock-closed" size={16} color={colors.bg} />
                </>
              )}
            </Pressable>
          </View>
        </>
      )}

      {/* Price change modal */}
      <Modal
        visible={priceChangeModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPriceChangeModal({ visible: false, newPrice: 0, newOfferId: '' })
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="alert-circle" size={40} color={colors.orange} />
            <Text style={styles.modalTitle}>Price Changed</Text>
            <Text style={styles.modalBody}>
              The price has changed to ${priceChangeModal.newPrice.toFixed(0)}. Would you like to
              continue with the new price?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() =>
                  setPriceChangeModal({ visible: false, newPrice: 0, newOfferId: '' })
                }
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handlePriceChangeAccept} style={styles.modalAcceptBtn}>
                <Text style={styles.modalAcceptText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.green + '30',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },

  // Center content
  centerContent: {
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

  // Flight card
  flightCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  flightRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  flightIata: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.white,
    letterSpacing: 2,
  },
  flightArrow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flightLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.green + '40',
  },
  flightDetails: {
    marginTop: spacing.sm,
    gap: 2,
  },
  flightDetailText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.whiteDim,
  },
  flightDetailMuted: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.faint,
  },

  // Info card (passenger, seat)
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: spacing.xs,
  },
  infoCardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  infoCardSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.faint,
    marginTop: 2,
  },

  // Price breakdown
  priceCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  priceLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.whiteDim,
  },
  priceValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  priceDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.green + '30',
    marginVertical: spacing.sm,
  },
  priceTotalLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.orange + '15',
    borderRadius: 10,
    padding: 14,
  },
  errorBannerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.orange,
    flex: 1,
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
  payBtn: {
    backgroundColor: colors.yellow,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.bg,
  },

  // Confirmed — boarding pass
  confirmedScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  boardingPass: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.yellow + '30',
    overflow: 'hidden',
  },
  bpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.yellow + '10',
    borderBottomWidth: 1,
    borderBottomColor: colors.yellow + '20',
  },
  bpBrand: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.yellow,
    letterSpacing: 2,
  },
  bpBoardingPass: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1.5,
  },
  bpRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  bpRouteEnd: {},
  bpIata: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.white,
    letterSpacing: 2,
  },
  bpCityLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  bpRouteLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  bpDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.muted,
  },
  bpDash: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  bpPerforation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 0,
  },
  bpNotchLeft: {
    width: 16,
    height: 32,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: colors.bg,
    marginLeft: -1,
  },
  bpDottedLine: {
    flex: 1,
    height: 1,
    borderWidth: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  bpNotchRight: {
    width: 16,
    height: 32,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    backgroundColor: colors.bg,
    marginRight: -1,
  },
  bpDetails: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  bpDetailRow: {
    flexDirection: 'row',
    gap: 16,
  },
  bpDetailItem: {
    flex: 1,
  },
  bpDetailLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  bpDetailValue: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.5,
  },
  bpRefRow: {
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bpRefCode: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.yellow,
    letterSpacing: 4,
  },
  bpBarcode: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  bpBarcodeLines: {
    flexDirection: 'row',
    height: 40,
    gap: 2,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  bpBarcodeLine: {
    backgroundColor: colors.muted,
    borderRadius: 1,
  },
  confirmedHint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  confirmedActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.lg,
    width: '100%',
  },
  shareConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.green + '60',
    backgroundColor: colors.green + '10',
  },
  shareConfirmText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.green,
  },
  doneBtn: {
    backgroundColor: colors.yellow,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  doneBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.bg,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.sheetBg,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.white,
    marginTop: spacing.md,
  },
  modalBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.whiteDim,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  modalAcceptBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    alignItems: 'center',
  },
  modalAcceptText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.bg,
  },
});
