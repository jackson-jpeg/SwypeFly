import { FlatList, Platform } from 'react-native';
import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { SavedCard } from './SavedCard';
import { EmptyState } from '../common/EmptyState';
import { useSavedStore } from '../../stores/savedStore';
import { useSwipeFeed, getDestinationById } from '../../hooks/useSwipeFeed';
import { useUIStore } from '../../stores/uiStore';
import type { Destination } from '../../types/destination';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchDestination(id: string, origin: string): Promise<Destination> {
  const res = await fetch(`/api/destination?id=${id}&origin=${origin}`);
  if (!res.ok) throw new Error(`Destination request failed: ${res.status}`);
  return res.json();
}

export function SavedGrid() {
  const savedIds = useSavedStore((s) => s.savedIds);
  const { data } = useSwipeFeed();
  const pages = data?.pages;
  const departureCode = useUIStore((s) => s.departureCode);

  // Step 1: resolve what we can from feed cache
  const { cached, missingIds } = useMemo(() => {
    const cachedMap = new Map<string, Destination>();
    const missing: string[] = [];
    savedIds.forEach((id) => {
      const found = getDestinationById(id, pages);
      if (found) {
        cachedMap.set(id, found);
      } else if (UUID_RE.test(id)) {
        missing.push(id);
      }
    });
    return { cached: cachedMap, missingIds: missing };
  }, [savedIds, pages]);

  // Step 2: fetch missing destinations from API
  const missingQueries = useQueries({
    queries: missingIds.map((id) => ({
      queryKey: ['destination', id, departureCode],
      queryFn: () => fetchDestination(id, departureCode),
      staleTime: 5 * 60 * 1000,
    })),
  });

  // Step 3: combine cached + fetched, preserving savedIds order
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
    return results;
  }, [savedIds, cached, missingIds, missingQueries]);

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
            gap: 12px;
            padding: 0 16px 16px 16px;
          }
          @media (min-width: 768px) {
            .sg-saved-grid { grid-template-columns: repeat(3, 1fr); }
          }
          @media (min-width: 1200px) {
            .sg-saved-grid { grid-template-columns: repeat(4, 1fr); max-width: 1200px; margin: 0 auto; }
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
      numColumns={2}
      contentContainerStyle={{ padding: 12 }}
      columnWrapperStyle={{ gap: 12 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
