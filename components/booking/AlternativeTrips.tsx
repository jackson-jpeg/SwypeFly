import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
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
  const fmt = (dt: Date) =>
    dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(d)} – ${fmt(r)}`;
}

function stopsLabel(stops: number): string {
  if (stops === 0) return 'Direct';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
}

export default function AlternativeTrips({ alternatives, onSelect }: AlternativeTripsProps) {
  const [expanded, setExpanded] = useState(false);

  if (alternatives.length === 0) return null;

  const cheapest = Math.min(...alternatives.map((t) => t.price));
  const expensiveThreshold = cheapest * 1.5;

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleToggle} style={styles.toggleRow} activeOpacity={0.7}>
        <Text style={styles.toggleText}>
          Other dates from ${cheapest}
        </Text>
        <Text style={styles.chevron}>{expanded ? '▾' : '›'}</Text>
      </TouchableOpacity>

      {expanded &&
        alternatives.map((trip, i) => {
          const isExpensive = trip.price > expensiveThreshold;
          return (
            <TouchableOpacity
              key={`${trip.departureDate}-${trip.returnDate}`}
              style={[styles.row, i === alternatives.length - 1 && styles.rowLast]}
              onPress={() => onSelect(trip)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowDates}>{formatDateRange(trip.departureDate, trip.returnDate)}</Text>
                <Text style={styles.rowMeta}>
                  {trip.nights} nights · {getAirlineName(trip.airline)} · {stopsLabel(trip.stops)}
                </Text>
              </View>
              <Text style={[styles.rowPrice, isExpensive && styles.rowPriceExpensive]}>
                ${trip.price}
              </Text>
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  toggleText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  chevron: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLast: {
    paddingBottom: spacing.md,
  },
  rowLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  rowDates: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  rowMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  rowPrice: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.white,
  },
  rowPriceExpensive: {
    color: colors.orange,
  },
});
