import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '../../theme/tokens';

const { width: SCREEN_W } = Dimensions.get('window');
const CELL_SIZE = Math.floor((SCREEN_W - spacing.md * 2) / 7);
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

// ─── Types ────────────────────────────────────────────────────────────

interface CalendarEntry {
  date: string; // YYYY-MM-DD
  price: number | null;
}

interface DatePickerSheetProps {
  origin: string;
  destination: string;
  initialDepartureDate?: string | null;
  initialReturnDate?: string | null;
  onConfirm: (departureDate: string, returnDate: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getMonthStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86400000);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Price color coding ───────────────────────────────────────────────

function getPriceColor(
  price: number | null,
  cheapThreshold: number,
  expensiveThreshold: number,
): string {
  if (price == null) return 'transparent';
  if (price <= cheapThreshold) return colors.green;
  if (price >= expensiveThreshold) return colors.orange;
  return colors.muted + '40';
}

function computeThresholds(entries: CalendarEntry[]): {
  cheap: number;
  expensive: number;
} {
  const prices = entries.map((e) => e.price).filter((p): p is number => p != null);
  if (prices.length === 0) return { cheap: 0, expensive: Infinity };
  const sorted = [...prices].sort((a, b) => a - b);
  const p20 = Math.floor(sorted.length * 0.2);
  const p80 = Math.floor(sorted.length * 0.8);
  return {
    cheap: sorted[Math.max(0, p20)],
    expensive: sorted[Math.min(sorted.length - 1, p80)],
  };
}

// ─── Component ────────────────────────────────────────────────────────

export default function DatePickerSheet({
  origin,
  destination,
  initialDepartureDate,
  initialReturnDate,
  onConfirm,
}: DatePickerSheetProps) {
  const today = useMemo(() => {
    const d = new Date();
    return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const [viewMonth, setViewMonth] = useState(() => {
    if (initialDepartureDate) {
      const d = new Date(initialDepartureDate + 'T00:00:00');
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  const [departureDate, setDepartureDate] = useState<string | null>(
    initialDepartureDate || null,
  );
  const [returnDate, setReturnDate] = useState<string | null>(
    initialReturnDate || null,
  );

  // Calendar price data
  const [calendarData, setCalendarData] = useState<CalendarEntry[]>([]);
  const [cheapestDate, setCheapestDate] = useState<string | null>(null);
  const [cheapestPrice, setCheapestPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Fetch calendar prices ──────────────────────────────────────

  useEffect(() => {
    if (!origin || !destination) return;

    let cancelled = false;
    setLoading(true);

    const monthStr = getMonthStr(viewMonth);
    fetch(
      `${API_BASE}/api/destination?action=calendar&origin=${origin}&destination=${destination}&month=${monthStr}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCalendarData(data.calendar || []);
        setCheapestDate(data.cheapestDate || null);
        setCheapestPrice(data.cheapestPrice || null);
      })
      .catch(() => {
        if (!cancelled) setCalendarData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [origin, destination, viewMonth]);

  // ─── Price thresholds ───────────────────────────────────────────

  const { cheap, expensive } = useMemo(
    () => computeThresholds(calendarData),
    [calendarData],
  );

  // Build a lookup from date string → price
  const priceMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const entry of calendarData) {
      map.set(entry.date, entry.price);
    }
    return map;
  }, [calendarData]);

  // ─── Day press handler ──────────────────────────────────────────

  const handleDayPress = useCallback(
    (dateStr: string) => {
      if (dateStr < today) return; // past date

      if (!departureDate || (departureDate && returnDate)) {
        // First tap or restart: set departure
        setDepartureDate(dateStr);
        setReturnDate(null);
      } else {
        // Second tap: set return
        if (dateStr <= departureDate) {
          // Tapped same or earlier — restart with this as departure
          setDepartureDate(dateStr);
          setReturnDate(null);
        } else {
          setReturnDate(dateStr);
        }
      }
    },
    [departureDate, returnDate, today],
  );

  // Auto-set return date = departure + 5 when departure is picked
  useEffect(() => {
    if (departureDate && !returnDate) {
      const autoReturn = addDays(departureDate, 5);
      setReturnDate(autoReturn);
    }
  }, [departureDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Month navigation ──────────────────────────────────────────

  const canGoPrev = useMemo(() => {
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return viewMonth > thisMonth;
  }, [viewMonth]);

  const canGoNext = useMemo(() => {
    const maxMonth = addMonths(new Date(), 5);
    return viewMonth < new Date(maxMonth.getFullYear(), maxMonth.getMonth(), 1);
  }, [viewMonth]);

  // ─── Render grid ───────────────────────────────────────────────

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const isInRange = (dateStr: string) => {
    if (!departureDate || !returnDate) return false;
    return dateStr > departureDate && dateStr < returnDate;
  };

  const nights =
    departureDate && returnDate ? daysBetween(departureDate, returnDate) : 0;

  const canConfirm = departureDate != null && returnDate != null;

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.monthNav}>
        <Pressable
          onPress={() => setViewMonth((m) => addMonths(m, -1))}
          disabled={!canGoPrev}
          hitSlop={12}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={canGoPrev ? colors.white : colors.faint}
          />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(viewMonth)}</Text>
        <Pressable
          onPress={() => setViewMonth((m) => addMonths(m, 1))}
          disabled={!canGoNext}
          hitSlop={12}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={canGoNext ? colors.white : colors.faint}
          />
        </Pressable>
      </View>

      {/* Day of week headers */}
      <View style={styles.weekRow}>
        {DAYS_OF_WEEK.map((d) => (
          <View key={d} style={styles.weekCell}>
            <Text style={styles.weekText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.yellow} />
        </View>
      ) : (
        <View style={styles.grid}>
          {/* Empty cells for offset */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.dayCell} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = toDateStr(year, month, day);
            const isPast = dateStr < today;
            const price = priceMap.get(dateStr) ?? null;
            const isDep = dateStr === departureDate;
            const isRet = dateStr === returnDate;
            const inRange = isInRange(dateStr);
            const isCheapest = dateStr === cheapestDate;
            const priceColor = getPriceColor(price, cheap, expensive);

            return (
              <Pressable
                key={dateStr}
                onPress={() => handleDayPress(dateStr)}
                disabled={isPast}
                style={[
                  styles.dayCell,
                  inRange && styles.dayCellInRange,
                  (isDep || isRet) && styles.dayCellSelected,
                  isCheapest && !isDep && !isRet && styles.dayCellCheapest,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isPast && styles.dayTextPast,
                    (isDep || isRet) && styles.dayTextSelected,
                  ]}
                >
                  {day}
                </Text>
                {price != null && !isPast && (
                  <View
                    style={[styles.priceDot, { backgroundColor: priceColor }]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Cheapest hint */}
      {cheapestDate && cheapestPrice != null && (
        <Text style={styles.cheapestHint}>
          Cheapest: {formatShortDate(cheapestDate)} at ${cheapestPrice}
        </Text>
      )}

      {/* Selected range summary + confirm */}
      <View style={styles.footer}>
        {departureDate && returnDate ? (
          <Text style={styles.rangeSummary}>
            {formatShortDate(departureDate)} – {formatShortDate(returnDate)}{' '}
            · {nights} night{nights !== 1 ? 's' : ''}
          </Text>
        ) : departureDate ? (
          <Text style={styles.rangeSummary}>
            {formatShortDate(departureDate)} – tap return date
          </Text>
        ) : (
          <Text style={styles.rangeSummary}>Select departure date</Text>
        )}

        <Pressable
          style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
          disabled={!canConfirm}
          onPress={() => {
            if (departureDate && returnDate) {
              onConfirm(departureDate, returnDate);
            }
          }}
        >
          <Text
            style={[
              styles.confirmText,
              !canConfirm && styles.confirmTextDisabled,
            ]}
          >
            {canConfirm
              ? `Search flights · ${formatShortDate(departureDate!)} – ${formatShortDate(returnDate!)}`
              : 'Select dates'}
          </Text>
          {canConfirm && (
            <Ionicons name="arrow-forward" size={18} color={colors.bg} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  monthLabel: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.white,
    letterSpacing: 1,
  },

  // Week headers
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  weekText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: colors.yellow,
  },
  dayCellInRange: {
    backgroundColor: colors.yellow + '15',
  },
  dayCellCheapest: {
    borderWidth: 1.5,
    borderColor: colors.green,
  },
  dayText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.white,
  },
  dayTextPast: {
    color: colors.faint,
  },
  dayTextSelected: {
    color: colors.bg,
    fontFamily: fonts.bodyBold,
  },
  priceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },

  // Loading
  loadingWrap: {
    height: CELL_SIZE * 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Cheapest hint
  cheapestHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.green,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Footer
  footer: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  rangeSummary: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  confirmBtn: {
    backgroundColor: colors.yellow,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  confirmText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.bg,
  },
  confirmTextDisabled: {
    color: colors.faint,
  },
});
