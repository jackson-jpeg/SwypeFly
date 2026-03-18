import { View, Text, StyleSheet, Dimensions, Platform, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '../../theme/tokens';
import type { BoardDeal } from '../../types/deal';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const STATUS_COLORS: Record<BoardDeal['status'], string> = {
  DEAL: colors.green,
  HOT: '#E85D4A',
  NEW: colors.yellow,
};

interface SwipeCardProps {
  deal: BoardDeal;
  isSaved: boolean;
  isFirst?: boolean;
  onSave: () => void;
  onBook: () => void;
  onTap?: () => void;
}

export default function SwipeCard({ deal, isSaved, isFirst, onSave, onBook, onTap }: SwipeCardProps) {
  return (
    <Pressable style={styles.card} onPress={onTap}>
      {/* Background image */}
      <Image
        source={{ uri: deal.imageUrl }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        placeholder={deal.blurHash ? { blurhash: deal.blurHash } : undefined}
        transition={400}
      />

      {/* Gradient overlay */}
      <LinearGradient
        colors={[...colors.cardGradient]}
        locations={[...colors.cardGradientLocations]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[deal.status] }]}>
        <Text style={styles.statusText}>{deal.status}</Text>
      </View>

      {/* Price tag — top right */}
      <View style={styles.priceTag}>
        <Text style={styles.priceLabel}>from</Text>
        <Text style={styles.priceValue}>{deal.priceFormatted}</Text>
        <Text style={styles.priceLabel}>round trip</Text>
      </View>

      {/* Bottom content */}
      <View style={styles.bottomContent}>
        {/* Destination */}
        <Text style={styles.destination}>{deal.destination}</Text>
        <Text style={styles.country}>{deal.country}</Text>

        {/* Tagline */}
        <Text style={styles.tagline} numberOfLines={2}>{deal.tagline}</Text>

        {/* Flight info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoChip}>
            <Ionicons name="airplane" size={12} color={colors.yellow} />
            <Text style={styles.infoText}>{deal.airline}</Text>
          </View>
          <View style={styles.infoChip}>
            <Ionicons name="time-outline" size={12} color={colors.yellow} />
            <Text style={styles.infoText}>{deal.flightDuration}</Text>
          </View>
          <View style={styles.infoChip}>
            <Ionicons name="calendar-outline" size={12} color={colors.yellow} />
            <Text style={styles.infoText}>{deal.tripDays}d trip</Text>
          </View>
        </View>

        {/* Vibe tags */}
        {deal.vibeTags.length > 0 && (
          <View style={styles.vibeRow}>
            {deal.vibeTags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.vibeChip}>
                <Text style={styles.vibeText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={onSave}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={22}
              color={isSaved ? '#E85D4A' : colors.white}
            />
            <Text style={[styles.actionLabel, isSaved && { color: '#E85D4A' }]}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onBook}
            style={({ pressed }) => [styles.bookBtn, pressed && styles.bookPressed]}
          >
            <Text style={styles.bookLabel}>Book {deal.priceFormatted}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.bg} />
          </Pressable>
        </View>
      </View>

      {/* Scroll hint on first card */}
      {isFirst && (
        <View style={styles.scrollHint}>
          <Ionicons name="chevron-up" size={20} color={colors.faint} />
          <Text style={styles.scrollHintText}>Swipe up for more</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: colors.surface,
  },

  // Status badge — top left
  statusBadge: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 70 : 60,
    left: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.bg,
    letterSpacing: 1,
  },

  // Price tag — top right
  priceTag: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 70 : 60,
    right: spacing.md,
    alignItems: 'center',
    backgroundColor: 'rgba(10,8,6,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.yellow + '40',
  },
  priceLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.yellow,
    lineHeight: 36,
  },

  // Bottom content
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'web' ? 100 : 120,
  },

  destination: {
    fontFamily: fonts.display,
    fontSize: 48,
    color: colors.white,
    letterSpacing: 2,
    lineHeight: 50,
  },
  country: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tagline: {
    fontFamily: fonts.accent,
    fontSize: 16,
    color: colors.whiteDim,
    marginTop: spacing.sm,
    lineHeight: 22,
  },

  // Info chips
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,8,6,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  infoText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.whiteDim,
  },

  // Vibe tags
  vibeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
  },
  vibeChip: {
    backgroundColor: colors.yellow + '20',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  vibeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.yellow,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(10,8,6,0.6)',
  },
  actionPressed: { opacity: 0.7 },
  actionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.yellow,
  },
  bookPressed: { opacity: 0.85 },
  bookLabel: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.bg,
    letterSpacing: 0.5,
  },

  // Scroll hint
  scrollHint: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 70 : 90,
    alignSelf: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  scrollHintText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.faint,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
