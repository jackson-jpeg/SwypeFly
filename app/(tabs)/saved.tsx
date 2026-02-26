import { View, Text, Platform, Pressable, ScrollView } from 'react-native';
import { useState, useMemo, useCallback } from 'react';
import { useQueries } from '@tanstack/react-query';
import { SavedGrid } from '../../components/saved/SavedGrid';
import { WorldMapHeader } from '../../components/saved/WorldMapHeader';
import { SavedStatsBar } from '../../components/saved/SavedStatsBar';
import { Footer } from '../../components/common/Footer';
import { useSavedStore } from '../../stores/savedStore';
import { useSwipeFeed, getDestinationById } from '../../hooks/useSwipeFeed';
import { useUIStore } from '../../stores/uiStore';
import { colors, spacing, fontSize, fontWeight, radii, shadows } from '../../constants/theme';
import type { Destination } from '../../types/destination';

type SortOption = 'recent' | 'price' | 'rating';

const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: 'recent', label: 'Recent', icon: '🕐' },
  { key: 'price', label: 'Price', icon: '💰' },
  { key: 'rating', label: 'Rating', icon: '⭐' },
];

const VALID_ID_RE = /^[0-9a-f-]+$/i;

async function fetchDestination(id: string, origin: string): Promise<Destination> {
  const res = await fetch(`/api/destination?id=${id}&origin=${origin}`);
  if (!res.ok) throw new Error(`Destination request failed: ${res.status}`);
  return res.json();
}

function SortChip({ label, icon, isActive, onPress }: { label: string; icon: string; isActive: boolean; onPress: () => void }) {
  if (Platform.OS === 'web') {
    return (
      <button
        onClick={onPress}
        aria-pressed={isActive}
        style={{
          padding: '7px 16px',
          borderRadius: radii.full,
          backgroundColor: isActive ? colors.primary : colors.surface,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          border: `1px solid ${isActive ? colors.primary : colors.border}`,
          whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: isActive ? shadows.web.primary : 'none',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span style={{
          fontSize: fontSize.md,
          fontWeight: isActive ? fontWeight.bold : fontWeight.medium,
          color: isActive ? '#fff' : colors.text.secondary,
        }}>
          {label}
        </span>
      </button>
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
        flexDirection: 'row', alignItems: 'center', gap: 4,
      }}
    >
      <Text style={{ fontSize: 12 }}>{icon}</Text>
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

function useResolvedDestinations() {
  const savedIds = useSavedStore((s) => s.savedIds);
  const { data } = useSwipeFeed();
  const pages = data?.pages;
  const departureCode = useUIStore((s) => s.departureCode);

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

  return useMemo(() => {
    const fetchedMap = new Map<string, Destination>();
    missingIds.forEach((id, i) => {
      if (missingQueries[i].data) fetchedMap.set(id, missingQueries[i].data!);
    });
    const results: Destination[] = [];
    savedIds.forEach((id) => {
      const dest = cached.get(id) ?? fetchedMap.get(id);
      if (dest) results.push(dest);
    });
    return results;
  }, [savedIds, cached, missingIds, missingQueries]);
}

function ShareWishlistButton({ count }: { count: number }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    const text = `✈️ Check out my travel wishlist on SoGoJet! ${count} dream destination${count !== 1 ? 's' : ''} saved.\n\nhttps://sogojet.com`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [count]);

  return (
    <button
      onClick={handleShare}
      aria-label="Share wishlist"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '10px 20px', borderRadius: radii.full,
        background: copied
          ? 'linear-gradient(135deg, #22C55E, #16A34A)'
          : 'linear-gradient(135deg, #38BDF8, #0284C7)',
        cursor: 'pointer', transition: 'all 0.3s ease',
        boxShadow: shadows.web.primary,
        border: 'none', fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <span style={{ fontSize: 14 }}>{copied ? '✅' : '🔗'}</span>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
        {copied ? 'Copied!' : 'Share Wishlist'}
      </span>
    </button>
  );
}

export default function SavedTab() {
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const savedIds = useSavedStore((s) => s.savedIds);
  const resolved = useResolvedDestinations();

  const sortBar = (
    <>
      {Platform.OS === 'web' ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          paddingLeft: spacing['5'], paddingRight: spacing['5'],
          paddingBottom: spacing['3'],
          flexWrap: 'wrap',
        }}>
          {SORT_OPTIONS.map((opt) => (
            <SortChip
              key={opt.key}
              label={opt.label}
              icon={opt.icon}
              isActive={sortBy === opt.key}
              onPress={() => setSortBy(opt.key)}
            />
          ))}
          {savedIds.size > 0 && (
            <div style={{ marginLeft: 'auto' }}>
              <ShareWishlistButton count={savedIds.size} />
            </div>
          )}
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
              icon={opt.icon}
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
        paddingBottom: 80, overflowY: 'auto', overflowX: 'hidden',
      }}>
        <style>{`
          .sg-saved-page::-webkit-scrollbar { display: none; }
        `}</style>
        <div style={{ padding: `${spacing['14']}px ${spacing['5']}px ${spacing['2']}px ${spacing['5']}px` }}>
          <h1 style={{
            margin: 0, color: colors.text.primary,
            fontSize: 32, fontWeight: 800, letterSpacing: -0.5,
          }}>
            ❤️ Saved
          </h1>
          <p style={{
            margin: `${spacing['1']}px 0 ${spacing['3']}px 0`,
            color: colors.text.muted, fontSize: fontSize.lg,
          }}>
            Your travel wishlist
          </p>
        </div>
        {/* World map header */}
        {resolved.length > 0 && (
          <div style={{ padding: `0 ${spacing['5']}px` }}>
            <WorldMapHeader destinations={resolved} />
          </div>
        )}
        {/* Stats bar */}
        <SavedStatsBar destinations={resolved} />
        {/* Sort + share */}
        {sortBar}
        {/* Grid with region groups */}
        <SavedGrid sortBy={sortBy} groupByRegion={true} />
        {/* Footer */}
        <Footer />
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
