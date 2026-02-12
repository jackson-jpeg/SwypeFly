import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { radii, spacing } from '../../constants/theme';
import { lightHaptic } from '../../utils/haptics';
import type { SortPreset } from '../../stores/feedStore';

interface FeedFilterBarProps {
  activeFilter: string | null;
  onFilterChange: (vibe: string | null) => void;
  activeSortPreset: SortPreset;
  onSortPresetChange: (preset: SortPreset) => void;
}

const VIBES = [
  { key: 'beach', label: 'Beach', emoji: '\u{1F3D6}' },
  { key: 'city', label: 'City', emoji: '\u{1F3D9}' },
  { key: 'adventure', label: 'Adventure', emoji: '\u26F0' },
  { key: 'culture', label: 'Culture', emoji: '\u{1F3DB}' },
  { key: 'nature', label: 'Nature', emoji: '\u{1F333}' },
  { key: 'foodie', label: 'Foodie', emoji: '\u{1F37D}' },
  { key: 'nightlife', label: 'Nightlife', emoji: '\u{1F389}' },
  { key: 'romantic', label: 'Romantic', emoji: '\u2764' },
];

const PRESETS: { key: SortPreset; label: string; emoji: string }[] = [
  { key: 'cheapest', label: 'Under $400', emoji: '\u{1F4B0}' },
  { key: 'trending', label: 'Trending', emoji: '\u{1F525}' },
  { key: 'topRated', label: 'Top Rated', emoji: '\u2B50' },
];

function FilterChip({
  label,
  emoji,
  isActive,
  variant = 'vibe',
  onPress,
}: {
  label: string;
  emoji: string;
  isActive: boolean;
  variant?: 'vibe' | 'preset';
  onPress: () => void;
}) {
  const handlePress = () => {
    lightHaptic();
    onPress();
  };

  const activeColor = variant === 'preset' ? '#F59E0B' : '#38BDF8';
  const activeBg = variant === 'preset' ? 'rgba(245,158,11,0.2)' : 'rgba(56,189,248,0.25)';
  const activeBorder = variant === 'preset' ? 'rgba(245,158,11,0.4)' : 'rgba(56,189,248,0.5)';

  if (Platform.OS === 'web') {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          handlePress();
        }}
        style={{
          padding: '6px 14px',
          borderRadius: radii.full,
          backgroundColor: isActive ? activeBg : 'rgba(255,255,255,0.1)',
          border: `1px solid ${isActive ? activeBorder : 'rgba(255,255,255,0.15)'}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12 }}>{emoji}</span>
        <span style={{
          fontSize: 12,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? activeColor : 'rgba(255,255,255,0.8)',
          letterSpacing: 0.3,
        }}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: radii.full,
        backgroundColor: isActive ? activeBg : 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: isActive ? activeBorder : 'rgba(255,255,255,0.15)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <Text style={{ fontSize: 12 }}>{emoji}</Text>
      <Text style={{
        fontSize: 12,
        fontWeight: isActive ? '700' : '500',
        color: isActive ? activeColor : 'rgba(255,255,255,0.8)',
        letterSpacing: 0.3,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function FeedFilterBar({ activeFilter, onFilterChange, activeSortPreset, onSortPresetChange }: FeedFilterBarProps) {
  const handleChipPress = (key: string) => {
    onFilterChange(activeFilter === key ? null : key);
  };

  const handlePresetPress = (key: SortPreset) => {
    onSortPresetChange(key);
  };

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 52,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          gap: 8,
          padding: '0 16px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          .sg-filter-bar::-webkit-scrollbar { display: none; }
        `}</style>
        {/* Sort presets first */}
        {PRESETS.map((p) => (
          <FilterChip
            key={p.key}
            label={p.label}
            emoji={p.emoji}
            isActive={activeSortPreset === p.key}
            variant="preset"
            onPress={() => handlePresetPress(p.key)}
          />
        ))}
        {/* Divider */}
        <div style={{
          width: 1,
          height: 20,
          backgroundColor: 'rgba(255,255,255,0.15)',
          alignSelf: 'center',
          flexShrink: 0,
        }} />
        {/* Vibe filters */}
        {VIBES.map((v) => (
          <FilterChip
            key={v.key}
            label={v.label}
            emoji={v.emoji}
            isActive={activeFilter === v.key}
            variant="vibe"
            onPress={() => handleChipPress(v.key)}
          />
        ))}
      </div>
    );
  }

  return (
    <View style={{ position: 'absolute', top: 52, left: 0, right: 0, zIndex: 50 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing['4'],
          gap: spacing['2'],
          alignItems: 'center',
        }}
      >
        {PRESETS.map((p) => (
          <FilterChip
            key={p.key}
            label={p.label}
            emoji={p.emoji}
            isActive={activeSortPreset === p.key}
            variant="preset"
            onPress={() => handlePresetPress(p.key)}
          />
        ))}
        <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        {VIBES.map((v) => (
          <FilterChip
            key={v.key}
            label={v.label}
            emoji={v.emoji}
            isActive={activeFilter === v.key}
            variant="vibe"
            onPress={() => handleChipPress(v.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
