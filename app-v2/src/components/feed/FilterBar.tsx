import { useRef } from 'react';
import { colors, fonts } from '@/tokens';
import { useFeedStore } from '@/stores/feedStore';
import type { DurationFilter } from '@/stores/feedStore';

const PRICE_RANGES = [
  { label: 'Under $300', min: null, max: 300 },
  { label: '$300\u2013500', min: 300, max: 500 },
  { label: '$500\u20131K', min: 500, max: 1000 },
  { label: '$1K+', min: 1000, max: null },
] as const;

const VIBES = ['beach', 'city', 'nature', 'culture', 'adventure', 'romantic', 'foodie', 'luxury', 'budget'] as const;

const REGIONS = ['Americas', 'Europe', 'Asia', 'Africa', 'Middle East', 'Oceania'] as const;

const DURATIONS: { label: string; value: DurationFilter }[] = [
  { label: 'Weekend', value: 'weekend' },
  { label: 'Week', value: 'week' },
  { label: 'Extended', value: 'extended' },
];

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  paddingInline: 14,
  borderRadius: 9999,
  fontSize: 12,
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontWeight: 600,
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  border: '1px solid #FFFFFF1F',
  transition: 'background-color 0.15s, border-color 0.15s',
  flexShrink: 0,
};

const inactiveChip: React.CSSProperties = {
  ...chipBase,
  backgroundColor: '#FFFFFF0D',
  color: '#FFFFFFB3',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

const activeChip: React.CSSProperties = {
  ...chipBase,
  backgroundColor: `${colors.sunriseButter}CC`,
  color: '#1A1A1A',
  border: `1px solid ${colors.sunriseButter}`,
};

export default function FilterBar() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { filters, setFilters, setDurationFilter, clearFilters, hasActiveFilters } = useFeedStore();
  const active = hasActiveFilters();

  const isPriceActive = (range: (typeof PRICE_RANGES)[number]) =>
    filters.minPrice === range.min && filters.maxPrice === range.max;

  const togglePrice = (range: (typeof PRICE_RANGES)[number]) => {
    if (isPriceActive(range)) {
      setFilters({ minPrice: null, maxPrice: null });
    } else {
      setFilters({ minPrice: range.min, maxPrice: range.max });
    }
  };

  const toggleVibe = (vibe: string) => {
    const next = filters.vibes.includes(vibe)
      ? filters.vibes.filter((v) => v !== vibe)
      : [...filters.vibes, vibe];
    setFilters({ vibes: next });
  };

  const toggleRegion = (region: string) => {
    const next = filters.region.includes(region)
      ? filters.region.filter((r) => r !== region)
      : [...filters.region, region];
    setFilters({ region: next });
  };

  const divider: React.CSSProperties = {
    width: 1,
    height: 20,
    backgroundColor: '#FFFFFF20',
    flexShrink: 0,
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#0A0F1ECC',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #FFFFFF0A',
      }}
    >
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflowX: 'auto',
          paddingLeft: 12,
          paddingRight: 120,
          width: '100%',
          scrollbarWidth: 'none',
        }}
      >
        {/* Clear all chip */}
        {active && (
          <button
            onClick={() => clearFilters()}
            style={{
              ...chipBase,
              backgroundColor: '#FFFFFF1A',
              color: '#FFFFFFCC',
              border: '1px solid #FFFFFF30',
              gap: 4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear
          </button>
        )}

        {/* Price chips */}
        {PRICE_RANGES.map((range) => (
          <button
            key={range.label}
            onClick={() => togglePrice(range)}
            style={isPriceActive(range) ? activeChip : inactiveChip}
          >
            {range.label}
            {isPriceActive(range) && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </button>
        ))}

        <div style={divider} />

        {/* Vibe chips */}
        {VIBES.map((vibe) => {
          const isActive = filters.vibes.includes(vibe);
          return (
            <button
              key={vibe}
              onClick={() => toggleVibe(vibe)}
              style={isActive ? activeChip : inactiveChip}
            >
              {vibe}
              {isActive && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </button>
          );
        })}

        <div style={divider} />

        {/* Region chips */}
        {REGIONS.map((region) => {
          const isActive = filters.region.includes(region);
          return (
            <button
              key={region}
              onClick={() => toggleRegion(region)}
              style={isActive ? activeChip : inactiveChip}
            >
              {region}
              {isActive && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </button>
          );
        })}

        <div style={divider} />

        {/* Duration chips */}
        {DURATIONS.map(({ label, value }) => {
          const isActive = filters.durationFilter === value;
          return (
            <button
              key={value}
              onClick={() => setDurationFilter(isActive ? 'any' : value)}
              style={isActive ? activeChip : inactiveChip}
            >
              {label}
              {isActive && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
