import { FlatList, Platform } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { SavedCard } from './SavedCard';
import { EmptyState } from '../common/EmptyState';
import { useSavedStore } from '../../stores/savedStore';
import { useSwipeFeed, getDestinationById } from '../../hooks/useSwipeFeed';
import { useUIStore } from '../../stores/uiStore';
import { getContinent } from './SavedStatsBar';
import { colors, spacing, fontSize, fontWeight, radii, layout } from '../../constants/theme';
import type { Destination } from '../../types/destination';

const VALID_ID_RE = /^[0-9a-f-]+$/i;

async function fetchDestination(id: string, origin: string): Promise<Destination> {
  const res = await fetch(`/api/destination?id=${id}&origin=${origin}`);
  if (!res.ok) throw new Error(`Destination request failed: ${res.status}`);
  return res.json();
}

const REGION_ORDER = ['Americas', 'Europe', 'Asia', 'Africa', 'Oceania', 'Other'];
const REGION_EMOJI: Record<string, string> = {
  Americas: '🌎', Europe: '🇪🇺', Asia: '🌏', Africa: '🌍', Oceania: '🏝️', Other: '🗺️',
};

interface SavedGridProps {
  sortBy?: 'recent' | 'price' | 'rating';
  groupByRegion?: boolean;
}

export function SavedGrid({ sortBy = 'recent', groupByRegion = true }: SavedGridProps) {
  const savedIds = useSavedStore((s) => s.savedIds);
  const savedAt = useSavedStore((s) => s.savedAt);
  const { data } = useSwipeFeed();
  const pages = data?.pages;
  const departureCode = useUIStore((s) => s.departureCode);
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set());

  const { cached, missingIds } = useMemo(() => {
    const cachedMap = new Map<string, Destination>();
    const missing: string[] = [];
    savedIds.forEach((id) => {
      const found = getDestinationById(id, pages);
      if (found) cachedMap.set(id, found);
      else if (VALID_ID_RE.test(id)) missing.push(id);
    });
    return { cached: cachedMap, missingIds: missing };
  }, [savedIds, pages]);

  const missingQueries = useQueries({
    queries: missingIds.map((id) => ({
      queryKey: ['destination', id, departureCode],
      queryFn: () => fetchDestination(id, departureCode),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoadingMissing = missingQueries.some((q) => q.isLoading);

  const savedDestinations = useMemo(() => {
    const fetchedMap = new Map<string, Destination>();
    missingIds.forEach((id, i) => {
      const result = missingQueries[i];
      if (result.data) fetchedMap.set(id, result.data);
    });
    const results: Destination[] = [];
    savedIds.forEach((id) => {
      const dest = cached.get(id) ?? fetchedMap.get(id);
      if (dest) results.push(dest);
    });
    if (sortBy === 'price') results.sort((a, b) => (a.livePrice ?? a.flightPrice) - (b.livePrice ?? b.flightPrice));
    else if (sortBy === 'rating') results.sort((a, b) => b.rating - a.rating);
    return results;
  }, [savedIds, cached, missingIds, missingQueries, sortBy]);

  const regionGroups = useMemo(() => {
    const groups = new Map<string, Destination[]>();
    savedDestinations.forEach((d) => {
      const region = getContinent(d.country);
      if (!groups.has(region)) groups.set(region, []);
      groups.get(region)!.push(d);
    });
    return REGION_ORDER
      .filter((r) => groups.has(r))
      .map((r) => ({ region: r, destinations: groups.get(r)! }));
  }, [savedDestinations]);

  if (savedIds.size === 0) {
    return (
      <EmptyState
        icon="❤️"
        title="No saved destinations yet"
        description="Swipe through the feed and tap the heart to save destinations you love."
        ctaLabel="Start Exploring"
        onCta={() => router.replace('/')}
      />
    );
  }

  const toggleRegion = (region: string) => {
    setCollapsedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  };

  if (Platform.OS === 'web') {
    const skeletonCount = missingIds.length - savedDestinations.length + cached.size;
    const skeletons = isLoadingMissing && skeletonCount > 0 ? (
      <>
        {Array.from({ length: Math.min(skeletonCount, 4) }, (_, i) => (
          <div key={`skeleton-${i}`} style={{
            borderRadius: 20, aspectRatio: '3/4', backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`, overflow: 'hidden',
            animation: 'sg-pulse 1.5s ease-in-out infinite',
          }}>
            <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${colors.surface}, ${colors.surfaceElevated}, ${colors.surface})` }} />
          </div>
        ))}
      </>
    ) : null;

    if (groupByRegion && regionGroups.length > 1) {
      return (
        <>
          <style>{`
            .sg-region-header {
              display: flex; align-items: center; gap: 10px;
              padding: 12px ${spacing['5']}px 8px;
              cursor: pointer; user-select: none;
              transition: opacity 0.2s;
            }
            .sg-region-header:hover { opacity: 0.8; }
            .sg-saved-grid-region {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: ${layout.savedGridGap}px;
              padding: 0 ${spacing['4']}px ${spacing['4']}px ${spacing['4']}px;
            }
            @media (min-width: 768px) {
              .sg-saved-grid-region { grid-template-columns: repeat(3, 1fr); }
            }
            @media (min-width: 1200px) {
              .sg-saved-grid-region { grid-template-columns: repeat(4, 1fr); max-width: ${layout.maxGridWidth}px; margin: 0 auto; }
            }
          `}</style>
          {regionGroups.map(({ region, destinations }) => {
            const isCollapsed = collapsedRegions.has(region);
            return (
              <div key={region}>
                <button
                  className="sg-region-header"
                  onClick={() => toggleRegion(region)}
                  aria-expanded={!isCollapsed}
                  aria-label={`${region} — ${destinations.length} destinations`}
                  style={{ background: 'none', border: 'none', width: '100%', fontFamily: 'inherit', textAlign: 'left' }}
                >
                  <span style={{ fontSize: 20 }}>{REGION_EMOJI[region] || '🗺️'}</span>
                  <span style={{
                    fontSize: fontSize.lg, fontWeight: fontWeight.bold,
                    color: colors.text.primary, flex: 1,
                  }}>
                    {region}
                    <span style={{ color: colors.text.muted, fontWeight: fontWeight.medium, marginLeft: 8, fontSize: fontSize.sm }}>
                      {destinations.length}
                    </span>
                  </span>
                  <span style={{
                    fontSize: 14, color: colors.text.muted,
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}>▼</span>
                </button>
                {!isCollapsed && (
                  <div className="sg-saved-grid-region">
                    {destinations.map((d) => (
                      <SavedCard key={d.id} destination={d} savedAt={savedAt[d.id]} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      );
    }

    // Flat grid fallback
    return (
      <>
        <style>{`
          .sg-saved-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: ${layout.savedGridGap}px;
            padding: 0 ${spacing['4']}px ${spacing['4']}px ${spacing['4']}px;
          }
          @media (min-width: 768px) {
            .sg-saved-grid { grid-template-columns: repeat(3, 1fr); }
          }
          @media (min-width: 1200px) {
            .sg-saved-grid { grid-template-columns: repeat(4, 1fr); max-width: ${layout.maxGridWidth}px; margin: 0 auto; }
          }
        `}</style>
        <div className="sg-saved-grid">
          {savedDestinations.map((d) => (
            <SavedCard key={d.id} destination={d} savedAt={savedAt[d.id]} />
          ))}
          {skeletons}
        </div>
      </>
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: Destination }) => <SavedCard destination={item} savedAt={savedAt[item.id]} />,
    [savedAt],
  );

  return (
    <FlatList
      data={savedDestinations}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      numColumns={layout.savedGridColumns}
      contentContainerStyle={{ padding: spacing['3'] }}
      columnWrapperStyle={{ gap: layout.savedGridGap }}
      showsVerticalScrollIndicator={false}
    />
  );
}
