import { FlatList, Platform } from 'react-native';
import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { SavedCard } from './SavedCard';
import { EmptyState } from '../common/EmptyState';
import { useSavedStore } from '../../stores/savedStore';
import { useSwipeFeed, getDestinationById } from '../../hooks/useSwipeFeed';
import { useUIStore } from '../../stores/uiStore';
import { spacing, layout } from '../../constants/theme';
import type { Destination } from '../../types/destination';

const VALID_ID_RE = /^[0-9a-f-]+$/i;

async function fetchDestination(id: string, origin: string): Promise<Destination> {
  const res = await fetch(`/api/destination?id=${id}&origin=${origin}`);
  if (!res.ok) throw new Error(`Destination request failed: ${res.status}`);
  return res.json();
}

interface SavedGridProps {
  sortBy?: 'recent' | 'price' | 'rating';
}

export function SavedGrid({ sortBy = 'recent' }: SavedGridProps) {
  const savedIds = useSavedStore((s) => s.savedIds);
  const { data } = useSwipeFeed();
  const pages = data?.pages;
  const departureCode = useUIStore((s) => s.departureCode);

  const { cached, missingIds } = useMemo(() => {
    const cachedMap = new Map<string, Destination>();
    const missing: string[] = [];
    savedIds.forEach((id) => {
      const found = getDestinationById(id, pages);
      if (found) {
        cachedMap.set(id, found);
      } else if (VALID_ID_RE.test(id)) {
        missing.push(id);
      }
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

    // Apply sort
    if (sortBy === 'price') {
      results.sort((a, b) => {
        const pa = a.livePrice ?? a.flightPrice;
        const pb = b.livePrice ?? b.flightPrice;
        return pa - pb;
      });
    } else if (sortBy === 'rating') {
      results.sort((a, b) => b.rating - a.rating);
    }
    // 'recent' keeps the natural insertion order from savedIds (most recent last in Set → reversed)

    return results;
  }, [savedIds, cached, missingIds, missingQueries, sortBy]);

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

  if (Platform.OS === 'web') {
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
            <SavedCard key={d.id} destination={d} />
          ))}
        </div>
      </>
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: Destination }) => <SavedCard destination={item} />,
    [],
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
