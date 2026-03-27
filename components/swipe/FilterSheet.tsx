// components/swipe/FilterSheet.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { useFilterStore } from '../../stores/filterStore';
import { useSettingsStore } from '../../stores/settingsStore';
import FilterPill from './FilterPill';
import { colors, fonts, spacing } from '../../theme/tokens';

const SCREEN_H = Dimensions.get('window').height;
const SHEET_MAX_H = SCREEN_H * 0.7;
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

// ─── Filter option definitions ──────────────────────────────────────

const PRICE_OPTIONS = [
  { key: 'under300' as const, label: '<$300' },
  { key: '300to500' as const, label: '$300–500' },
  { key: '500to1k' as const, label: '$500–1K' },
  { key: 'over1k' as const, label: '$1K+' },
];

const REGION_OPTIONS = [
  { key: 'domestic', label: 'Domestic' },
  { key: 'caribbean', label: 'Caribbean' },
  { key: 'latam', label: 'Lat. Am.' },
  { key: 'europe', label: 'Europe' },
  { key: 'asia', label: 'Asia' },
  { key: 'africa-me', label: 'Africa/ME' },
  { key: 'oceania', label: 'Oceania' },
];

const VIBE_OPTIONS = [
  { key: 'beach', label: 'Beach' },
  { key: 'city', label: 'City' },
  { key: 'nature', label: 'Nature' },
  { key: 'culture', label: 'Culture' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'romantic', label: 'Romantic' },
  { key: 'foodie', label: 'Foodie' },
  { key: 'luxury', label: 'Luxury' },
  { key: 'historic', label: 'Historic' },
];

const DURATION_OPTIONS = [
  { key: 'weekend' as const, label: 'Weekend' },
  { key: 'week' as const, label: 'Week' },
  { key: 'extended' as const, label: 'Extended' },
];

export default function FilterSheet() {
  const isOpen = useFilterStore((s) => s.isOpen);
  const close = useFilterStore((s) => s.close);
  const priceRange = useFilterStore((s) => s.priceRange);
  const regions = useFilterStore((s) => s.regions);
  const vibes = useFilterStore((s) => s.vibes);
  const duration = useFilterStore((s) => s.duration);
  const activeCountFn = useFilterStore((s) => s.activeCount);
  const activeCount = activeCountFn();
  const setPriceRange = useFilterStore((s) => s.setPriceRange);
  const toggleRegion = useFilterStore((s) => s.toggleRegion);
  const toggleVibe = useFilterStore((s) => s.toggleVibe);
  const setDuration = useFilterStore((s) => s.setDuration);
  const search = useFilterStore((s) => s.search);
  const setSearch = useFilterStore((s) => s.setSearch);
  const clearAll = useFilterStore((s) => s.clearAll);
  const toQueryParams = useFilterStore((s) => s.toQueryParams);
  const departureCode = useSettingsStore((s) => s.departureCode);

  const [count, setCount] = useState<number | null>(null);
  const slideAnim = useRef(new Animated.Value(SHEET_MAX_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate sheet in/out
  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 4,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      fetchCount();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_MAX_H,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  // Debounced count fetch when filters change
  const fetchCount = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          origin: departureCode,
          countOnly: 'true',
          ...toQueryParams(),
        });
        const res = await fetch(`${API_BASE}/api/feed?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCount(data.count);
        }
      } catch {
        // Non-fatal — leave count as last known
      }
    }, 300);
  }, [departureCode, toQueryParams]);

  // Refetch count when any filter changes
  useEffect(() => {
    if (isOpen) fetchCount();
  }, [priceRange, regions, vibes, duration, isOpen]);

  const handleApply = () => {
    close();
  };

  // Web: escape key
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const sheetContent = (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Search bar */}
          <TextInput
            style={searchStyles.input}
            placeholder="Search city, country, or vibe..."
            placeholderTextColor={colors.muted + '80'}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search destinations"
          />

          {/* Header row: first section label + clear all */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>PRICE</Text>
            {activeCount > 0 && (
              <Pressable onPress={clearAll}>
                <Text style={styles.clearAll}>Clear all</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.pillRow}>
            {PRICE_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.key}
                label={opt.label}
                isActive={priceRange === opt.key}
                onPress={() => setPriceRange(opt.key)}
                accessibilityLabel={`${opt.label} price filter`}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>REGION</Text>
          <View style={styles.pillRow}>
            {REGION_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.key}
                label={opt.label}
                isActive={regions.includes(opt.key)}
                onPress={() => toggleRegion(opt.key)}
                accessibilityLabel={`${opt.label} region filter`}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>VIBE</Text>
          <View style={styles.pillRow}>
            {VIBE_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.key}
                label={opt.label}
                isActive={vibes.includes(opt.key)}
                onPress={() => toggleVibe(opt.key)}
                accessibilityLabel={`${opt.label} vibe filter`}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>DURATION</Text>
          <View style={styles.pillRow}>
            {DURATION_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.key}
                label={opt.label}
                isActive={duration === opt.key}
                onPress={() => setDuration(opt.key)}
                accessibilityLabel={`${opt.label} duration filter`}
              />
            ))}
          </View>
        </ScrollView>

        {/* Apply button */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleApply}
            style={[styles.applyButton, count === 0 && styles.applyButtonDisabled]}
            disabled={count === 0}
            accessibilityRole="button"
            accessibilityLabel={
              count != null ? `Show ${count} destinations` : 'Show destinations'
            }
          >
            <Text style={[styles.applyText, count === 0 && styles.applyTextDisabled]}>
              {count != null ? `Show ${count} destinations` : 'Show destinations'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );

  // On web, render inline (position fixed via styles). On native, use Modal.
  if (Platform.OS === 'web') {
    return <View style={styles.overlay}>{sheetContent}</View>;
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={close}
    >
      {sheetContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...Platform.select({
      web: {
        position: 'fixed' as unknown as 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
      },
      default: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
      },
    }),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SHEET_MAX_H,
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sheetHandle,
  },
  scroll: {
    maxHeight: SHEET_MAX_H - 120,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.yellow,
    letterSpacing: 2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  clearAll: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  applyButton: {
    backgroundColor: colors.orange,
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.4,
  },
  applyText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#FFF8F0',
  },
  applyTextDisabled: {
    color: '#FFF8F080',
  },
});

const searchStyles = StyleSheet.create({
  input: {
    backgroundColor: colors.cell,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.white,
    marginBottom: spacing.sm,
  },
});
