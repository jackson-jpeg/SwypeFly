import { useState, useEffect } from 'react';
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
import { useBookingFlowStore } from '../../../stores/bookingFlowStore';
import { colors, fonts, spacing } from '../../../theme/tokens';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

// ─── Types ────────────────────────────────────────────────────────────

interface SeatInfo {
  column: string;
  available: boolean;
  extraLegroom: boolean;
  price: number;
  currency: string;
  designator: string;
  serviceId: string | null;
}

interface SeatRow {
  rowNumber: number;
  seats: SeatInfo[];
}

interface SeatMap {
  columns: string[];
  exitRows: number[];
  aisleAfterColumns: string[];
  rows: SeatRow[];
}

// ─── Component ────────────────────────────────────────────────────────

export default function SeatSelectionScreen() {
  const { id, offerId: paramOfferId } = useLocalSearchParams<{
    id: string;
    offerId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const storeOfferId = useBookingFlowStore((s) => s.selectedOfferId);
  const setSeats = useBookingFlowStore((s) => s.setSeats);
  const offerId = paramOfferId || storeOfferId;

  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<SeatInfo | null>(null);
  const [animate, setAnimate] = useState(false);

  // ─── Fetch seat map ─────────────────────────────────────────────

  useEffect(() => {
    if (!offerId) {
      setError('No offer selected');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/booking?action=offer&offerId=${offerId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load seat map (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.seatMap) {
          setSeatMap(data.seatMap);
        } else {
          // No seat map available — allow skip
          setSeatMap(null);
        }
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
  }, [offerId]);

  // Trigger animation
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────

  function handleSeatPress(seat: SeatInfo) {
    if (!seat.available) return;
    setSelectedSeat((prev) => (prev?.designator === seat.designator ? null : seat));
  }

  function handleContinue() {
    if (selectedSeat) {
      setSeats([
        {
          designator: selectedSeat.designator,
          price: selectedSeat.price,
          currency: selectedSeat.currency,
          serviceId: selectedSeat.serviceId || undefined,
        },
      ]);
    } else {
      setSeats([]);
    }
    router.push(`/booking/${id}/review` as never);
  }

  function handleSkip() {
    setSeats([]);
    router.push(`/booking/${id}/review` as never);
  }

  // ─── Seat button ──────────────────────────────────────────────

  function renderSeat(seat: SeatInfo) {
    const isSelected = selectedSeat?.designator === seat.designator;

    return (
      <Pressable
        key={seat.designator}
        onPress={() => handleSeatPress(seat)}
        disabled={!seat.available}
        style={[
          styles.seat,
          !seat.available && styles.seatOccupied,
          isSelected && styles.seatSelected,
          seat.extraLegroom && seat.available && styles.seatLegroom,
        ]}
      >
        <Text
          style={[
            styles.seatText,
            !seat.available && styles.seatTextOccupied,
            isSelected && styles.seatTextSelected,
          ]}
        >
          {seat.available ? seat.column : '\u2715'}
        </Text>
      </Pressable>
    );
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.yellow} />
        </Pressable>
        <View style={styles.headerTitle}>
          <SplitFlapRow
            text="SELECT SEAT"
            maxLength={12}
            size="md"
            color={colors.yellow}
            align="left"
            animate={animate}
          />
        </View>
      </View>

      <TripBanner />
      <View style={styles.divider} />

      {/* Content */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator color={colors.yellow} size="large" />
          <Text style={styles.loadingHint}>Loading seat map...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.orange} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !seatMap ? (
        <View style={styles.centerContent}>
          <Ionicons name="grid-outline" size={48} color={colors.muted} />
          <Text style={styles.errorText}>Seat map not available for this flight</Text>
        </View>
      ) : (
        <>
          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.surface }]} />
              <Text style={styles.legendLabel}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.yellow }]} />
              <Text style={styles.legendLabel}>Selected</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: colors.surface, borderColor: colors.green + '30', borderWidth: 1.5 },
                ]}
              />
              <Text style={styles.legendLabel}>Extra legroom</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.cell, opacity: 0.5 }]} />
              <Text style={styles.legendLabel}>Occupied</Text>
            </View>
          </View>

          {/* Column headers */}
          <View style={styles.columnHeaderRow}>
            <View style={styles.rowNumberCol} />
            {seatMap.columns.map((col) => (
              <View
                key={col}
                style={[
                  styles.colHeader,
                  seatMap.aisleAfterColumns.includes(col) && styles.colHeaderAisle,
                ]}
              >
                <Text style={styles.colHeaderText}>{col}</Text>
              </View>
            ))}
          </View>

          {/* Seat grid */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
            showsVerticalScrollIndicator={false}
          >
            {seatMap.rows.map((row) => {
              const isExit = seatMap.exitRows.includes(row.rowNumber);
              return (
                <View key={row.rowNumber}>
                  {isExit && (
                    <View style={styles.exitLabel}>
                      <View style={styles.exitLine} />
                      <Text style={styles.exitText}>EXIT</Text>
                      <View style={styles.exitLine} />
                    </View>
                  )}
                  <View style={styles.seatRow}>
                    <View style={styles.rowNumberCol}>
                      <Text style={styles.rowNumber}>{row.rowNumber}</Text>
                    </View>
                    {row.seats.map((seat, seatIdx) => {
                      // Check if we need an aisle gap after this seat
                      const needsAisle = seatMap.aisleAfterColumns.includes(seat.column);
                      return (
                        <View
                          key={seat.designator}
                          style={[styles.seatWrapper, needsAisle && styles.seatWrapperAisle]}
                        >
                          {renderSeat(seat)}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Bottom bar — always shown (except while loading) */}
      {!loading && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          {selectedSeat ? (
            <View style={styles.bottomInfo}>
              <Text style={styles.bottomSeatLabel}>Seat {selectedSeat.designator}</Text>
              {selectedSeat.price > 0 && (
                <Text style={styles.bottomSeatPrice}>
                  +${selectedSeat.price} {selectedSeat.currency}
                </Text>
              )}
              {selectedSeat.price === 0 && (
                <Text style={styles.bottomSeatFree}>Free</Text>
              )}
            </View>
          ) : (
            <View style={styles.bottomInfo} />
          )}
          <Pressable onPress={handleContinue} style={styles.continueBtn}>
            <Text style={styles.continueBtnText}>
              {selectedSeat ? 'Continue' : 'Continue without seat'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={colors.bg} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const SEAT_SIZE = 38;

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

  // Center content (loading/error/no map)
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

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.faint,
  },

  // Column headers
  columnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  rowNumberCol: {
    width: 28,
    alignItems: 'center',
  },
  colHeader: {
    width: SEAT_SIZE,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  colHeaderAisle: {
    marginRight: spacing.md + 2,
  },
  colHeaderText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.muted,
  },

  // Seat grid
  scrollView: {
    flex: 1,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginVertical: 2,
  },
  rowNumber: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.faint,
  },

  // Seat
  seatWrapper: {
    marginHorizontal: 2,
  },
  seatWrapperAisle: {
    marginRight: spacing.md + 2,
  },
  seat: {
    width: SEAT_SIZE,
    height: SEAT_SIZE,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatOccupied: {
    backgroundColor: colors.cell,
    opacity: 0.4,
  },
  seatSelected: {
    backgroundColor: colors.yellow,
    borderColor: colors.yellow,
  },
  seatLegroom: {
    borderColor: colors.green + '30',
    borderWidth: 1.5,
  },
  seatText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.whiteDim,
  },
  seatTextOccupied: {
    color: colors.faint,
  },
  seatTextSelected: {
    color: colors.bg,
  },

  // Exit row
  exitLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
    gap: spacing.sm,
  },
  exitLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: colors.orange + '60',
  },
  exitText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.orange,
    letterSpacing: 1.5,
  },

  // Skip
  skipBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  skipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.yellow,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.green + '30',
  },
  bottomInfo: {
    flex: 1,
  },
  bottomSeatLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
  bottomSeatPrice: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.yellow,
    marginTop: 2,
  },
  bottomSeatFree: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.green,
    marginTop: 2,
  },
  continueBtn: {
    backgroundColor: colors.yellow,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
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
