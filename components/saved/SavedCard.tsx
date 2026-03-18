import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '../../theme/tokens';
import type { BoardDeal } from '../../types/deal';

const CARD_GAP = 12;
const CARD_W = (Dimensions.get('window').width - spacing.md * 2 - CARD_GAP) / 2;
const CARD_H = CARD_W * 1.35;

interface SavedCardProps {
  deal: BoardDeal;
  onPress: () => void;
  onRemove: () => void;
}

export default function SavedCard({ deal, onPress, onRemove }: SavedCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Image
        source={{ uri: deal.imageUrl }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        placeholder={deal.blurHash ? { blurhash: deal.blurHash } : undefined}
        transition={300}
      />
      <LinearGradient
        colors={['transparent', 'rgba(10,8,6,0.85)']}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Remove button */}
      <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
        <Ionicons name="heart" size={16} color="#E85D4A" />
      </Pressable>

      {/* Price */}
      <View style={styles.priceBadge}>
        <Text style={styles.priceText}>{deal.priceFormatted}</Text>
      </View>

      {/* Bottom info */}
      <View style={styles.bottom}>
        <Text style={styles.city} numberOfLines={1}>{deal.destination}</Text>
        <Text style={styles.country} numberOfLines={1}>{deal.country}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{deal.airline}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{deal.tripDays}d</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10,8,6,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  priceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(10,8,6,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  priceText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.yellow,
  },

  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
  },
  city: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.white,
    letterSpacing: 1,
  },
  country: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.faint,
  },
  metaDot: {
    fontSize: 10,
    color: colors.faint,
  },
});
