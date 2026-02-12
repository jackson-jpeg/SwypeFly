import { View, Text, Platform, Pressable, ScrollView } from 'react-native';
import { useState } from 'react';
import { SavedGrid } from '../../components/saved/SavedGrid';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';

type SortOption = 'recent' | 'price' | 'rating';

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'price', label: 'Price' },
  { key: 'rating', label: 'Rating' },
];

function SortChip({ label, isActive, onPress }: { label: string; isActive: boolean; onPress: () => void }) {
  if (Platform.OS === 'web') {
    return (
      <div
        onClick={onPress}
        style={{
          padding: `${spacing['2']}px ${spacing['4']}px`,
          borderRadius: radii.full,
          backgroundColor: isActive ? colors.primary : colors.surfaceElevated,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          border: `1px solid ${isActive ? colors.primary : colors.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{
          fontSize: fontSize.md,
          fontWeight: isActive ? fontWeight.bold : fontWeight.medium,
          color: isActive ? '#fff' : colors.text.secondary,
        }}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing['2'],
        paddingHorizontal: spacing['4'],
        borderRadius: radii.full,
        backgroundColor: isActive ? colors.primary : colors.surfaceElevated,
        borderWidth: 1,
        borderColor: isActive ? colors.primary : colors.border,
      }}
    >
      <Text style={{
        fontSize: fontSize.md,
        fontWeight: isActive ? fontWeight.bold : fontWeight.medium,
        color: isActive ? '#fff' : colors.text.secondary,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SavedTab() {
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const sortBar = (
    <>
      {Platform.OS === 'web' ? (
        <div style={{
          display: 'flex',
          gap: spacing['2'],
          paddingLeft: spacing['5'],
          paddingRight: spacing['5'],
          paddingBottom: spacing['3'],
        }}>
          {SORT_OPTIONS.map((opt) => (
            <SortChip
              key={opt.key}
              label={opt.label}
              isActive={sortBy === opt.key}
              onPress={() => setSortBy(opt.key)}
            />
          ))}
        </div>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing['5'],
            paddingBottom: spacing['3'],
            gap: spacing['2'],
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <SortChip
              key={opt.key}
              label={opt.label}
              isActive={sortBy === opt.key}
              onPress={() => setSortBy(opt.key)}
            />
          ))}
        </ScrollView>
      )}
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <div style={{
        flex: 1, backgroundColor: colors.background, minHeight: '100vh',
        paddingBottom: 80,
      }}>
        <div style={{ padding: `${spacing['14']}px ${spacing['5']}px ${spacing['3']}px ${spacing['5']}px` }}>
          <h1 style={{ margin: 0, color: colors.text.primary, fontSize: fontSize['6xl'], fontWeight: fontWeight.extrabold, letterSpacing: -0.5 }}>
            Saved
          </h1>
          <p style={{ margin: `${spacing['1']}px 0 0 0`, color: colors.text.muted, fontSize: fontSize.lg }}>
            Your travel wishlist
          </p>
        </div>
        {sortBar}
        <SavedGrid sortBy={sortBy} />
      </div>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing['5'], paddingTop: spacing['14'], paddingBottom: spacing['3'] }}>
        <Text style={{ color: colors.text.primary, fontSize: fontSize['6xl'], fontWeight: fontWeight.extrabold, letterSpacing: -0.5 }}>Saved</Text>
        <Text style={{ color: colors.text.muted, fontSize: fontSize.lg, marginTop: spacing['1'] }}>Your travel wishlist</Text>
      </View>
      {sortBar}
      <SavedGrid sortBy={sortBy} />
    </View>
  );
}
