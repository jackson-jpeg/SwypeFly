# "Your Trip" Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Select Dates + Select Flight screens with a single "Your Trip" screen showing the best deal as a complete trip card, with expandable alternatives.

**Architecture:** New `app/booking/[id]/trip.tsx` screen reads the best deal from `dealStore` and fetches alternatives from the calendar API. Two new components (`TripHeroCard`, `AlternativeTrips`) handle the layout. Navigation updated to go directly to `/booking/{id}/trip` instead of `/booking/{id}/dates`. When user taps "Book this trip", a Duffel search runs and navigates to passengers with the offer ID. If Duffel price is >50% higher, a price update modal appears.

**Tech Stack:** React Native, Expo Router, Zustand, Vercel Serverless Functions

**Spec:** `docs/superpowers/specs/2026-03-20-trip-screen-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/booking/TripHeroCard.tsx` | Create | Hero trip card — best price, dates, airline, stops, chips |
| `components/booking/AlternativeTrips.tsx` | Create | Expandable list of alternative date/price options |
| `app/booking/[id]/trip.tsx` | Create | "Your Trip" screen — orchestrates hero card, alternatives, CTA, Duffel search |
| `components/swipe/SwipeFeed.tsx` | Modify (line 55) | Navigate to `/booking/{id}/trip` instead of `/booking/{id}/dates` |
| `app/destination/[id].tsx` | Modify (line 54) | Navigate to `/booking/{id}/trip` instead of `/booking/{id}/dates` |

---

### Task 1: TripHeroCard Component

**Files:**
- Create: `components/booking/TripHeroCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/booking/TripHeroCard.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../theme/tokens';
import { getAirlineName } from '../../utils/airlines';

interface TripHeroCardProps {
  price: number;
  departureDate: string;  // YYYY-MM-DD
  returnDate: string;     // YYYY-MM-DD
  airline: string;        // IATA code
  stops: number;          // 0 = direct, 1 = 1 stop, etc.
  origin: string;         // IATA code
  destination: string;    // IATA code
  nights: number;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TripHeroCard({
  price,
  departureDate,
  returnDate,
  airline,
  stops,
  origin,
  destination,
  nights,
}: TripHeroCardProps) {
  const airlineName = getAirlineName(airline) || airline;
  const stopsLabel = stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`;

  return (
    <View style={styles.card}>
      {/* Green header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>✦ BEST PRICE WE FOUND</Text>
        <Text style={styles.headerPrice}>${price}</Text>
      </View>

      {/* Trip details */}
      <View style={styles.body}>
        {/* Dates row */}
        <View style={styles.datesRow}>
          <View>
            <Text style={styles.dateLabel}>DEPART</Text>
            <Text style={styles.dateValue}>{formatDate(departureDate)}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.dateLabel}>RETURN</Text>
            <Text style={styles.dateValue}>{formatDate(returnDate)}</Text>
          </View>
        </View>

        {/* Chips */}
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{nights} nights</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Round trip</Text>
          </View>
          <View style={[styles.chip, stops === 0 && styles.chipGreen]}>
            <Text style={[styles.chipText, stops === 0 && styles.chipTextGreen]}>{stopsLabel}</Text>
          </View>
        </View>

        {/* Airline info */}
        <View style={styles.airlineRow}>
          <Text style={styles.airlineName}>{airlineName}</Text>
          <Text style={styles.airlineClass}>Economy</Text>
        </View>

        {/* Route line — outbound */}
        <View style={styles.routeRow}>
          <Text style={styles.routeCode}>{origin}</Text>
          <View style={styles.routeLine}>
            <View style={styles.routeLineBar} />
            <Text style={styles.routeStops}>{stopsLabel}</Text>
          </View>
          <Text style={styles.routeCode}>{destination}</Text>
        </View>

        {/* Route line — return */}
        <View style={[styles.routeRow, { marginTop: 8 }]}>
          <Text style={styles.routeCode}>{destination}</Text>
          <View style={styles.routeLine}>
            <View style={styles.routeLineBar} />
            <Text style={styles.routeStops}>{stopsLabel}</Text>
          </View>
          <Text style={styles.routeCode}>{origin}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: 'rgba(123,175,142,0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123,175,142,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 1.5,
  },
  headerPrice: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.green,
  },
  body: {
    padding: spacing.md,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1,
  },
  dateValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.white,
    marginTop: 2,
  },
  arrow: {
    fontSize: 20,
    color: colors.muted,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipGreen: {
    borderColor: 'rgba(123,175,142,0.3)',
    backgroundColor: 'rgba(123,175,142,0.1)',
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.yellow,
  },
  chipTextGreen: {
    color: colors.green,
  },
  airlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginBottom: 12,
  },
  airlineName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.yellow,
    letterSpacing: 1,
  },
  airlineClass: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeCode: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
    width: 36,
  },
  routeLine: {
    flex: 1,
    alignItems: 'center',
  },
  routeLineBar: {
    height: 1,
    backgroundColor: colors.green,
    width: '100%',
    marginBottom: 4,
  },
  routeStops: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.muted,
  },
});
```

- [ ] **Step 2: Run tests + typecheck**

Run: `npx jest --no-coverage && npx tsc --noEmit`
Expected: All pass (no tests for pure UI component, but no type errors)

- [ ] **Step 3: Commit**

```bash
git add components/booking/TripHeroCard.tsx
git commit -m "feat: add TripHeroCard component — best deal display"
```

---

### Task 2: AlternativeTrips Component

**Files:**
- Create: `components/booking/AlternativeTrips.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/booking/AlternativeTrips.tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '../../theme/tokens';
import { getAirlineName } from '../../utils/airlines';

export interface TripOption {
  departureDate: string;
  returnDate: string;
  price: number;
  airline: string;
  nights: number;
  stops: number;
}

interface AlternativeTripsProps {
  alternatives: TripOption[];
  onSelect: (trip: TripOption) => void;
}

function formatDateRange(dep: string, ret: string): string {
  const d = new Date(dep + 'T00:00:00');
  const r = new Date(ret + 'T00:00:00');
  const depStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const retStr = r.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${depStr} → ${retStr}`;
}

export default function AlternativeTrips({ alternatives, onSelect }: AlternativeTripsProps) {
  const [expanded, setExpanded] = useState(false);

  if (alternatives.length === 0) return null;

  const cheapestAlt = alternatives[0]?.price;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={toggle} style={styles.toggleRow}>
        <Text style={styles.toggleText}>
          Other dates from ${cheapestAlt}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.muted}
        />
      </Pressable>

      {expanded && (
        <View style={styles.list}>
          {alternatives.map((trip, i) => (
            <Pressable
              key={`${trip.departureDate}-${i}`}
              style={styles.row}
              onPress={() => onSelect(trip)}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowDates}>
                  {formatDateRange(trip.departureDate, trip.returnDate)}
                </Text>
                <Text style={styles.rowMeta}>
                  {trip.nights} nights · {getAirlineName(trip.airline) || trip.airline}
                  {trip.stops === 0 ? ' · Direct' : ` · ${trip.stops} stop${trip.stops > 1 ? 's' : ''}`}
                </Text>
              </View>
              <Text style={[styles.rowPrice, trip.price > alternatives[0].price * 1.5 && { color: colors.orange }]}>
                ${trip.price}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: {
    flex: 1,
  },
  rowDates: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  rowMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  rowPrice: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.white,
    marginLeft: spacing.md,
  },
});
```

- [ ] **Step 2: Run tests + typecheck**

Run: `npx jest --no-coverage && npx tsc --noEmit`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add components/booking/AlternativeTrips.tsx
git commit -m "feat: add AlternativeTrips expandable component"
```

---

### Task 3: Trip Screen

**Files:**
- Create: `app/booking/[id]/trip.tsx`

This is the main screen. It:
1. Reads the deal from dealStore (has cheapestDate, price, airline, destination)
2. Fetches alternative dates from the calendar API
3. Shows TripHeroCard + AlternativeTrips + CTA button
4. When user taps "Book this trip", calls Duffel search, then navigates to passengers
5. If no calendar data, falls back to dates screen

- [ ] **Step 1: Create the screen**

```typescript
// app/booking/[id]/trip.tsx
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
import { useDealStore } from '../../../stores/dealStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useBookingFlowStore } from '../../../stores/bookingFlowStore';
import TripHeroCard from '../../../components/booking/TripHeroCard';
import AlternativeTrips from '../../../components/booking/AlternativeTrips';
import type { TripOption } from '../../../components/booking/AlternativeTrips';
import { colors, fonts, spacing } from '../../../theme/tokens';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const deal = useDealStore((s) => s.deals.find((d) => d.id === id));
  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';

  // Selected trip (starts as the deal's cheapest dates)
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

  // Initialize selected trip from deal data
  useEffect(() => {
    if (!deal) return;
    const depDate = deal.cheapestDate || deal.departureDate;
    const retDate = deal.cheapestReturnDate || deal.returnDate || (depDate ? addDays(depDate, 7) : '');

    if (!depDate) {
      // No calendar data — fall back to dates screen
      router.replace(`/booking/${id}/dates`);
      return;
    }

    setSelectedTrip({
      departureDate: depDate,
      returnDate: retDate,
      price: deal.price ?? 0,
      airline: deal.airline || '',
      stops: 0, // Default — TP data doesn't always include stops
      nights: retDate && depDate ? Math.round((new Date(retDate).getTime() - new Date(depDate).getTime()) / 86400000) : 7,
    });
  }, [deal]);

  // Fetch alternatives from calendar API
  useEffect(() => {
    if (!deal?.iataCode) return;

    fetch(`${API_BASE}/api/destination?action=calendar&origin=${departureCode}&destination=${deal.iataCode}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.calendar) return;

        const today = new Date().toISOString().split('T')[0];
        const bestDate = deal.cheapestDate || '';

        // Build alternatives: different dates, at least 3 days apart, sorted by price
        const seen = new Set<string>();
        const alts: TripOption[] = [];

        const sorted = [...data.calendar]
          .filter((e: { date: string; price: number }) => e.date >= today && e.date !== bestDate)
          .sort((a: { price: number }, b: { price: number }) => a.price - b.price);

        for (const entry of sorted) {
          // Deduplicate by week — skip dates within 3 days of an already-added one
          const tooClose = Array.from(seen).some((d) => {
            const diff = Math.abs(new Date(entry.date).getTime() - new Date(d).getTime());
            return diff < 3 * 86400000;
          });
          if (tooClose) continue;

          seen.add(entry.date);
          alts.push({
            departureDate: entry.date,
            returnDate: addDays(entry.date, 7),
            price: entry.price,
            airline: entry.airline || deal.airline || '',
            nights: 7,
            stops: 0,
          });

          if (alts.length >= 4) break;
        }

        setAlternatives(alts);
      })
      .catch(() => {
        // Non-fatal — just no alternatives shown
      });
  }, [deal?.iataCode, departureCode]);

  // Handle "Book this trip" — run Duffel search then navigate to passengers
  const handleBook = useCallback(async () => {
    if (!selectedTrip || !deal) return;
    setBooking(true);
    setBookError(null);

    try {
      const res = await fetch(`${API_BASE}/api/booking?action=search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Search failed (${res.status})`);
      }

      const offers = await res.json();
      if (!offers || offers.length === 0) {
        throw new Error('No flights available for these dates');
      }

      const bestOffer = offers[0];
      const duffelPrice = parseFloat(bestOffer.totalAmount || bestOffer.price || '0');

      // Check for significant price increase
      if (duffelPrice > selectedTrip.price * 1.5 && selectedTrip.price > 0) {
        // Price jumped >50% — warn user
        const msg = `The best available price is now $${Math.round(duffelPrice)} (was $${selectedTrip.price} when we checked). Continue?`;
        if (Platform.OS === 'web') {
          if (!window.confirm(msg)) {
            setBooking(false);
            return;
          }
        } else {
          // On native, use Alert
          return new Promise<void>((resolve) => {
            Alert.alert(
              'Prices Updated',
              msg,
              [
                { text: 'Try different dates', style: 'cancel', onPress: () => { setBooking(false); resolve(); } },
                { text: `Continue at $${Math.round(duffelPrice)}`, onPress: () => {
                  const store = useBookingFlowStore.getState();
                  store.setDates(selectedTrip.departureDate, selectedTrip.returnDate);
                  store.setOfferId(bestOffer.id);
                  router.push(`/booking/${id}/passengers?offerId=${bestOffer.id}`);
                  resolve();
                }},
              ],
            );
          });
        }
      }

      // Price is acceptable — proceed
      const store = useBookingFlowStore.getState();
      store.setDates(selectedTrip.departureDate, selectedTrip.returnDate);
      store.setOfferId(bestOffer.id);
      router.push(`/booking/${id}/passengers?offerId=${bestOffer.id}`);
    } catch (e) {
      setBookError((e as Error).message);
    } finally {
      setBooking(false);
    }
  }, [selectedTrip, deal, departureCode, id, router]);

  // Handle selecting an alternative
  const handleSelectAlternative = (trip: TripOption) => {
    setSelectedTrip({
      ...trip,
    });
  };

  if (!deal) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Destination not found</Text>
      </View>
    );
  }

  if (!selectedTrip) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.yellow} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.yellow} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.destName}>{deal.destinationFull || deal.destination}</Text>
            <Text style={styles.destMeta}>
              {deal.country} · {deal.flightDuration} from {departureCode}
            </Text>
          </View>
        </View>

        {/* Hero trip card */}
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

        {/* Alternatives */}
        <AlternativeTrips
          alternatives={alternatives}
          onSelect={handleSelectAlternative}
        />

        {/* Calendar link */}
        <Pressable
          style={styles.calendarLink}
          onPress={() => router.push(`/booking/${id}/dates`)}
        >
          <Text style={styles.calendarLinkText}>See full price calendar →</Text>
        </Pressable>

        {/* Error */}
        {bookError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.orange} />
            <Text style={styles.errorBannerText}>{bookError}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.ctaButton, booking && styles.ctaButtonDisabled]}
          onPress={handleBook}
          disabled={booking}
        >
          {booking ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <>
              <Text style={styles.ctaText}>Book this trip · ${selectedTrip.price}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.bg} />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  destName: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.yellow,
    letterSpacing: 2,
  },
  destMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  calendarLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  calendarLinkText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(212,115,74,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,115,74,0.3)',
    borderRadius: 8,
    padding: 12,
    marginTop: spacing.sm,
  },
  errorBannerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.orange,
    flex: 1,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    padding: spacing.xl,
  },
  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaButton: {
    backgroundColor: colors.yellow,
    borderRadius: 8,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.bg,
  },
});
```

- [ ] **Step 2: Run tests + typecheck**

Run: `npx jest --no-coverage && npx tsc --noEmit`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add app/booking/[id]/trip.tsx
git commit -m "feat: add Your Trip screen — replaces dates + flight selection"
```

---

### Task 4: Update Navigation

**Files:**
- Modify: `components/swipe/SwipeFeed.tsx` (line 55)
- Modify: `app/destination/[id].tsx` (line 54)

- [ ] **Step 1: Update SwipeFeed navigation**

In `components/swipe/SwipeFeed.tsx`, line 55, change:
```typescript
    router.push(`/booking/${deal.id}/dates`);
```
To:
```typescript
    router.push(`/booking/${deal.id}/trip`);
```

- [ ] **Step 2: Update destination detail navigation**

In `app/destination/[id].tsx`, line 54, change:
```typescript
    router.push(`/booking/${deal.id}/dates`);
```
To:
```typescript
    router.push(`/booking/${deal.id}/trip`);
```

- [ ] **Step 3: Run tests + typecheck + lint**

Run: `npx jest --no-coverage && npx tsc --noEmit && npm run lint`
Expected: All pass, 0 lint errors

- [ ] **Step 4: Commit**

```bash
git add components/swipe/SwipeFeed.tsx app/destination/[id].tsx
git commit -m "feat: navigate to trip screen instead of dates screen"
```

---

### Task 5: Verify End-to-End

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Wait for CI to pass**

```bash
gh run list --limit 1
```
Expected: `completed success`

- [ ] **Step 3: Test on production**

1. Navigate to sogojet.com
2. Tap "Search Flights" on a card
3. Verify "Your Trip" screen appears with hero card showing price, dates, airline
4. Verify "Other dates" expandable shows alternatives
5. Tap "Book this trip" — verify it searches Duffel and navigates to passengers
6. Verify "See full price calendar →" link opens the old calendar screen
