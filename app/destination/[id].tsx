import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useDealStore } from '../../stores/dealStore';
import { useSavedStore } from '../../stores/savedStore';
import { colors, fonts, spacing } from '../../theme/tokens';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = 360;

export default function DestinationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const deal = useDealStore((s) => s.deals.find((d) => d.id === id));
  const savedIds = useSavedStore((s) => s.savedIds);
  const toggle = useSavedStore((s) => s.toggle);
  const isSaved = deal ? savedIds.includes(deal.id) : false;

  const handleBook = useCallback(() => {
    if (!deal?.affiliateUrl) return;
    if (Platform.OS === 'web') {
      window.open(deal.affiliateUrl, '_blank', 'noopener');
    } else {
      Linking.openURL(deal.affiliateUrl);
    }
  }, [deal]);

  if (!deal) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </Pressable>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Deal not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <View style={styles.hero}>
          <Image
            source={{ uri: deal.imageUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={400}
          />
          <LinearGradient
            colors={['rgba(10,8,6,0.4)', 'transparent', 'rgba(10,8,6,0.95)']}
            locations={[0, 0.3, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Nav */}
          <Pressable
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </Pressable>

          {/* Hero bottom content */}
          <View style={styles.heroBottom}>
            <Text style={styles.heroCity}>{deal.destination}</Text>
            <Text style={styles.heroCountry}>{deal.country}</Text>
            <Text style={styles.heroTagline}>{deal.tagline}</Text>
          </View>
        </View>

        {/* Price card */}
        <View style={styles.priceCard}>
          <View style={styles.priceLeft}>
            <Text style={styles.priceFrom}>Round trip from</Text>
            <Text style={styles.priceAmount}>{deal.priceFormatted}</Text>
          </View>
          <View style={styles.priceRight}>
            <Text style={styles.priceDetail}>{deal.airline}</Text>
            <Text style={styles.priceDetail}>{deal.flightDuration}</Text>
            <Text style={styles.priceDetail}>{deal.flightCode}</Text>
          </View>
        </View>

        {/* Trip details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TRIP DETAILS</Text>
          <View style={styles.detailGrid}>
            <DetailItem icon="calendar-outline" label="Depart" value={formatDate(deal.departureDate)} />
            <DetailItem icon="calendar" label="Return" value={formatDate(deal.returnDate)} />
            <DetailItem icon="time-outline" label="Duration" value={`${deal.tripDays} days`} />
            <DetailItem icon="airplane-outline" label="Flight" value={deal.flightDuration} />
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <Text style={styles.description}>{deal.description}</Text>
        </View>

        {/* Vibe tags */}
        {deal.vibeTags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VIBES</Text>
            <View style={styles.vibeRow}>
              {deal.vibeTags.map((tag) => (
                <View key={tag} style={styles.vibeChip}>
                  <Text style={styles.vibeText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Itinerary */}
        {deal.itinerary && deal.itinerary.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SAMPLE ITINERARY</Text>
            {deal.itinerary.map((day) => (
              <View key={day.day} style={styles.itineraryDay}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>Day {day.day}</Text>
                </View>
                <View style={styles.dayActivities}>
                  {day.activities.map((activity, i) => (
                    <Text key={i} style={styles.activityText}>
                      • {activity}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Restaurants */}
        {deal.restaurants && deal.restaurants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WHERE TO EAT</Text>
            {deal.restaurants.map((r, i) => (
              <View key={i} style={styles.restaurantRow}>
                <View>
                  <Text style={styles.restaurantName}>{r.name}</Text>
                  <Text style={styles.restaurantType}>{r.type}</Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color={colors.yellow} />
                  <Text style={styles.ratingText}>{r.rating}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Spacer for bottom bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.saveBtn}
          onPress={() => toggle(deal)}
        >
          <Ionicons
            name={isSaved ? 'heart' : 'heart-outline'}
            size={24}
            color={isSaved ? '#E85D4A' : colors.white}
          />
        </Pressable>
        <Pressable style={styles.bookBtn} onPress={handleBook}>
          <Text style={styles.bookLabel}>Book for {deal.priceFormatted}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bg} />
        </Pressable>
      </View>
    </View>
  );
}

function DetailItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon as any} size={16} color={colors.green} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Hero
  hero: { width: SCREEN_W, height: HERO_H },
  heroBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  heroCity: {
    fontFamily: fonts.display,
    fontSize: 42,
    color: colors.white,
    letterSpacing: 2,
  },
  heroCountry: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  heroTagline: {
    fontFamily: fonts.accent,
    fontSize: 16,
    color: colors.whiteDim,
    marginTop: spacing.xs,
  },

  // Nav
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,8,6,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // Price card
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.yellow + '30',
  },
  priceLeft: {},
  priceFrom: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceAmount: {
    fontFamily: fonts.display,
    fontSize: 38,
    color: colors.yellow,
    lineHeight: 42,
  },
  priceRight: { alignItems: 'flex-end', gap: 2 },
  priceDetail: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.whiteDim,
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
  },

  // Detail grid
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailItem: {
    width: (SCREEN_W - spacing.md * 2 - 8) / 2,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  detailLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },

  // Description
  description: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.whiteDim,
    lineHeight: 22,
  },

  // Vibes
  vibeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibeChip: {
    backgroundColor: colors.yellow + '20',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  vibeText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.yellow,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Itinerary
  itineraryDay: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  dayBadge: {
    backgroundColor: colors.green + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  dayBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.green,
  },
  dayActivities: { flex: 1, gap: 2 },
  activityText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.whiteDim,
    lineHeight: 20,
  },

  // Restaurants
  restaurantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
  },
  restaurantName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  restaurantType: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.faint,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.yellow + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.yellow,
  },

  // Not found
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFoundText: { fontFamily: fonts.display, fontSize: 20, color: colors.muted },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.yellow,
  },
  bookLabel: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.bg,
    letterSpacing: 0.5,
  },
});
