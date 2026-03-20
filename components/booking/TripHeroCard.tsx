import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../theme/tokens';
import { getAirlineName } from '../../utils/airlines';

interface TripHeroCardProps {
  price: number;
  departureDate: string;
  returnDate: string;
  airline: string;
  stops: number;
  origin: string;
  destination: string;
  nights: number;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function stopsLabel(stops: number): string {
  if (stops === 0) return 'Direct';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
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
  const airlineName = getAirlineName(airline);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>✦ BEST PRICE WE FOUND</Text>
        <Text style={styles.headerPrice}>${price}</Text>
      </View>

      {/* Dates row */}
      <View style={styles.datesRow}>
        <View>
          <Text style={styles.dateLabel}>DEPART</Text>
          <Text style={styles.dateValue}>{formatDate(departureDate)}</Text>
        </View>
        <Text style={styles.dateArrow}>→</Text>
        <View>
          <Text style={styles.dateLabel}>RETURN</Text>
          <Text style={styles.dateValue}>{formatDate(returnDate)}</Text>
        </View>
      </View>

      {/* Chips */}
      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{nights} nights</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Round trip</Text>
        </View>
        <View style={[styles.chip, stops === 0 && styles.chipDirect]}>
          <Text style={[styles.chipText, stops === 0 && styles.chipDirectText]}>
            {stopsLabel(stops)}
          </Text>
        </View>
      </View>

      {/* Airline row */}
      <View style={styles.airlineRow}>
        <Text style={styles.airlineName}>{airlineName}</Text>
        <Text style={styles.cabinClass}>Economy</Text>
      </View>

      {/* Route lines */}
      <View style={styles.routeSection}>
        <RouteLine from={origin} to={destination} stops={stops} />
        <RouteLine from={destination} to={origin} stops={stops} />
      </View>
    </View>
  );
}

function RouteLine({ from, to, stops }: { from: string; to: string; stops: number }) {
  return (
    <View style={styles.routeLine}>
      <Text style={styles.routeCode}>{from}</Text>
      <View style={styles.routeLineCenter}>
        <View style={styles.routeBar} />
        <Text style={styles.routeStops}>{stopsLabel(stops)}</Text>
      </View>
      <Text style={styles.routeCode}>{to}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.green + '18',
    marginHorizontal: -spacing.md,
    marginTop: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
  },
  headerLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.green,
    letterSpacing: 1,
  },
  headerPrice: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.green,
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1,
  },
  dateValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.white,
    marginTop: 2,
  },
  dateArrow: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.muted,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  chipDirect: {
    backgroundColor: colors.green + '25',
  },
  chipDirectText: {
    color: colors.green,
  },
  airlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  airlineName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.yellow,
  },
  cabinClass: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
  },
  routeSection: {
    gap: spacing.sm,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeCode: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
    width: 36,
    textAlign: 'center',
  },
  routeLineCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  routeBar: {
    height: 2,
    backgroundColor: colors.green,
    width: '100%',
    borderRadius: 1,
  },
  routeStops: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.muted,
  },
});
