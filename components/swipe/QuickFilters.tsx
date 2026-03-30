import { memo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFilterStore } from '../../stores/filterStore';
import { colors, fonts, spacing } from '../../theme/tokens';
import { lightHaptic } from '../../utils/haptics';

// Google Flights-style quick filter chips — always visible, horizontally scrollable.
// Tapping a chip toggles the filter instantly (no sheet needed).
// The "More" chip opens the full filter sheet for detailed control.

const QUICK_CHIPS = [
  { id: 'cheapest', label: 'Cheapest', icon: 'cash-outline' as const, type: 'sort' as const },
  { id: 'under300', label: 'Under $300', icon: 'pricetag-outline' as const, type: 'price' as const },
  { id: 'weekend', label: 'Weekend', icon: 'calendar-outline' as const, type: 'duration' as const },
  { id: 'week', label: '1 Week', icon: 'calendar-outline' as const, type: 'duration' as const },
  { id: 'nonstop', label: 'Nonstop', icon: 'airplane-outline' as const, type: 'vibe' as const },
  { id: 'beach', label: 'Beach', icon: 'sunny-outline' as const, type: 'vibe' as const },
  { id: 'city', label: 'City', icon: 'business-outline' as const, type: 'vibe' as const },
  { id: 'europe', label: 'Europe', icon: 'globe-outline' as const, type: 'region' as const },
  { id: 'asia', label: 'Asia', icon: 'globe-outline' as const, type: 'region' as const },
  { id: 'caribbean', label: 'Caribbean', icon: 'globe-outline' as const, type: 'region' as const },
] as const;

function QuickFilters() {
  const priceRange = useFilterStore((s) => s.priceRange);
  const duration = useFilterStore((s) => s.duration);
  const vibes = useFilterStore((s) => s.vibes);
  const regions = useFilterStore((s) => s.regions);
  const sortPreset = useFilterStore((s) => s.sortPreset);
  const setPriceRange = useFilterStore((s) => s.setPriceRange);
  const setDuration = useFilterStore((s) => s.setDuration);
  const toggleVibe = useFilterStore((s) => s.toggleVibe);
  const toggleRegion = useFilterStore((s) => s.toggleRegion);
  const setSortPreset = useFilterStore((s) => s.setSortPreset);
  const openSheet = useFilterStore((s) => s.open);
  const activeCount = useFilterStore((s) => s.activeCount)();

  const isActive = useCallback(
    (chip: (typeof QUICK_CHIPS)[number]): boolean => {
      switch (chip.type) {
        case 'sort':
          return sortPreset === chip.id;
        case 'price':
          return priceRange === chip.id;
        case 'duration':
          return duration === chip.id;
        case 'vibe':
          return vibes.includes(chip.id);
        case 'region':
          return regions.includes(chip.id);
        default:
          return false;
      }
    },
    [sortPreset, priceRange, duration, vibes, regions],
  );

  const handlePress = useCallback(
    (chip: (typeof QUICK_CHIPS)[number]) => {
      lightHaptic();
      switch (chip.type) {
        case 'sort':
          setSortPreset(sortPreset === chip.id ? 'default' : (chip.id as 'cheapest'));
          break;
        case 'price':
          setPriceRange(chip.id as 'under300');
          break;
        case 'duration':
          setDuration(chip.id as 'weekend' | 'week');
          break;
        case 'vibe':
          toggleVibe(chip.id);
          break;
        case 'region':
          toggleRegion(chip.id);
          break;
      }
    },
    [sortPreset, setPriceRange, setDuration, toggleVibe, toggleRegion, setSortPreset],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
    >
      {QUICK_CHIPS.map((chip) => {
        const active = isActive(chip);
        return (
          <Pressable
            key={chip.id}
            onPress={() => handlePress(chip)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityLabel={`${chip.label} filter`}
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={chip.icon}
              size={12}
              color={active ? colors.bg : colors.muted}
            />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
      {/* "More filters" chip at the end */}
      <Pressable
        onPress={() => { lightHaptic(); openSheet(); }}
        style={[styles.chip, styles.moreChip, activeCount > 0 && styles.chipActive]}
        accessibilityRole="button"
        accessibilityLabel="More filters"
      >
        <Ionicons
          name="options-outline"
          size={12}
          color={activeCount > 0 ? colors.bg : colors.muted}
        />
        <Text style={[styles.chipText, activeCount > 0 && styles.chipTextActive]}>
          {activeCount > 0 ? `Filters (${activeCount})` : 'More'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

export default memo(QuickFilters);

const styles = StyleSheet.create({
  container: {
    maxHeight: 36,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: colors.yellow,
    borderColor: colors.yellow,
  },
  moreChip: {
    borderStyle: 'dashed' as const,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.whiteDim,
  },
  chipTextActive: {
    color: colors.bg,
    fontFamily: fonts.bodyBold,
  },
});
