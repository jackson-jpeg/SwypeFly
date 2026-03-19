import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBookingFlowStore } from '../../stores/bookingFlowStore';
import { colors, fonts, spacing } from '../../theme/tokens';

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function nightsBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86400000);
}

export default function TripBanner() {
  const origin = useBookingFlowStore((s) => s.origin);
  const destination = useBookingFlowStore((s) => s.destination);
  const departureDate = useBookingFlowStore((s) => s.departureDate);
  const returnDate = useBookingFlowStore((s) => s.returnDate);

  if (!origin || !destination) return null;

  const nights = nightsBetween(departureDate, returnDate);

  return (
    <View style={styles.banner}>
      <Ionicons name="airplane" size={14} color={colors.green} />
      <Text style={styles.text}>
        {origin} → {destination}
      </Text>
      {departureDate && returnDate && (
        <>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.text}>
            {formatShortDate(departureDate)} – {formatShortDate(returnDate)}
          </Text>
          {nights > 0 && (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.nights}>
                {nights} night{nights !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.green,
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.white,
    letterSpacing: 0.3,
  },
  dot: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.faint,
  },
  nights: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.green,
  },
});
