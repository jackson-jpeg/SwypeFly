import { FlatList, Platform } from 'react-native';
import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { SavedCard } from './SavedCard';
import { EmptyState } from '../common/EmptyState';
import { useSavedStore } from '../../stores/savedStore';
import { mockDestinations } from '../../data/destinations';
import { getDestinationById } from '../../hooks/useSwipeFeed';
import type { Destination } from '../../types/destination';

export function SavedGrid() {
  const savedIds = useSavedStore((s) => s.savedIds);

  const savedDestinations = useMemo(
    () => {
      const results: Destination[] = [];
      savedIds.forEach((id) => {
        // Prefer live-price-merged data from feed cache
        const merged = getDestinationById(id);
        if (merged) {
          results.push(merged);
        } else {
          const mock = mockDestinations.find((d) => d.id === id);
          if (mock) results.push(mock);
        }
      });
      return results;
    },
    [savedIds],
  );

  if (savedDestinations.length === 0) {
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
          .sf-saved-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            padding: 0 16px 16px 16px;
          }
          @media (min-width: 768px) {
            .sf-saved-grid { grid-template-columns: repeat(3, 1fr); }
          }
          @media (min-width: 1200px) {
            .sf-saved-grid { grid-template-columns: repeat(4, 1fr); max-width: 1200px; margin: 0 auto; }
          }
        `}</style>
        <div className="sf-saved-grid">
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
