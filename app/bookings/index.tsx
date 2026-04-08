import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import SplitFlapRow from '../../components/board/SplitFlapRow';
import {
  useBookingHistoryStore,
  type BookingEntry,
  type BookingStatus,
} from '../../stores/bookingHistoryStore';
import { colors, fonts, spacing } from '../../theme/tokens';
import { lightHaptic } from '../../utils/haptics';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed', color: colors.green, bg: colors.green + '18' },
  completed: { label: 'Completed', color: colors.muted, bg: colors.muted + '18' },
  cancelled: { label: 'Cancelled', color: '#E85D4A', bg: '#E85D4A18' },
};

// ─── Booking Card ─────────────────────────────────────────────────────

function BookingCard({
  booking,
  index,
  onPress,
}: {
  booking: BookingEntry;
  index: number;
  onPress: () => void;
}) {
  const status = STATUS_CONFIG[booking.status];

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
      <Pressable
        onPress={onPress}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`Booking to ${booking.destinationName}`}
      >
        {/* Thumbnail */}
        <Image
          source={{ uri: booking.destinationImage }}
          style={styles.cardImage}
          contentFit="cover"
          transition={200}
        />

        {/* Details */}
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardDestination} numberOfLines={1}>
              {booking.destinationName}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          <Text style={styles.cardAirline} numberOfLines={1}>
            {booking.airline}
          </Text>

          <View style={styles.cardInfoRow}>
            <Ionicons name="calendar-outline" size={12} color={colors.faint} />
            <Text style={styles.cardInfoText}>
              {formatDate(booking.departureDate)} &rarr; {formatDate(booking.returnDate)}
            </Text>
          </View>

          <View style={styles.cardInfoRow}>
            <Ionicons name="people-outline" size={12} color={colors.faint} />
            <Text style={styles.cardInfoText}>
              {booking.passengers} {booking.passengers === 1 ? 'passenger' : 'passengers'}
            </Text>
          </View>

          <View style={styles.cardBottomRow}>
            <Text style={styles.cardPrice}>
              ${booking.totalPrice.toFixed(0)}{' '}
              <Text style={styles.cardCurrency}>{booking.currency}</Text>
            </Text>
            <Text style={styles.cardRef}>{booking.bookingReference}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────

export default function BookingHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bookings = useBookingHistoryStore((s) => s.bookings);
  const [animate, setAnimate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleCardPress = useCallback(
    (booking: BookingEntry) => {
      lightHaptic();
      // Future: navigate to booking detail
      void booking;
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Future: sync with remote API
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: BookingEntry; index: number }) => (
      <BookingCard booking={item} index={index} onPress={() => handleCardPress(item)} />
    ),
    [handleCardPress],
  );

  const keyExtractor = useCallback((item: BookingEntry) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.yellow} />
        </Pressable>
        <View style={styles.headerTitle}>
          <SplitFlapRow
            text="MY TRIPS"
            maxLength={10}
            size="md"
            color={colors.yellow}
            align="left"
            animate={animate}
          />
        </View>
      </View>

      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{'\u2708'}</Text>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySubtitle}>Book your first adventure!</Text>
          <Pressable
            style={styles.exploreBtn}
            onPress={() => {
              router.dismissAll();
              router.replace('/(tabs)');
            }}
            accessibilityRole="button"
            accessibilityLabel="Go explore deals"
          >
            <Ionicons name="compass-outline" size={18} color={colors.bg} />
            <Text style={styles.exploreBtnText}>Explore Deals</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={bookings}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.yellow}
              colors={[colors.yellow]}
              progressBackgroundColor={colors.surface}
            />
          }
        />
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
    paddingBottom: 12,
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

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardImage: {
    width: 80,
    height: '100%',
    minHeight: 120,
    backgroundColor: colors.cell,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardDestination: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 1,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardAirline: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardInfoText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.faint,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardPrice: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.yellow,
    letterSpacing: 0.5,
  },
  cardCurrency: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
  },
  cardRef: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 1,
  },

  // List
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.3,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.muted,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.faint,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.yellow,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  exploreBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.bg,
    letterSpacing: 0.5,
  },
});
