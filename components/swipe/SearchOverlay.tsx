import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Platform, View, Text, TextInput, Pressable, FlatList, Modal, KeyboardAvoidingView } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { destinations } from '../../data/destinations';
import { useUIStore } from '../../stores/uiStore';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';

interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
}

// Trending destinations — hand-picked popular ones
const TRENDING_CITIES = ['Paris', 'Tokyo', 'Bali', 'Barcelona', 'Dubai', 'Lisbon'];

export function SearchOverlay({ visible, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState(2000);
  const [animating, setAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const departureCode = useUIStore(s => s.departureCode);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback((val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 150);
  }, []);

  useEffect(() => {
    if (visible) {
      setAnimating(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!visible) { setQuery(''); setDebouncedQuery(''); setAnimating(false); }
  }, [visible]);

  // Close on Escape
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    return destinations
      .filter(d => {
        const price = d.livePrice ?? d.flightPrice;
        return price <= maxPrice && (
          d.city.toLowerCase().includes(q) ||
          d.country.toLowerCase().includes(q) ||
          d.vibeTags.some(t => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (a.livePrice ?? a.flightPrice) - (b.livePrice ?? b.flightPrice))
      .slice(0, 10);
  }, [debouncedQuery, maxPrice]);

  const trendingDests = useMemo(() =>
    TRENDING_CITIES.map(city => destinations.find(d => d.city === city)).filter(Boolean),
    [],
  );

  if (!visible) return null;

  // ─── Native Search ──────────────────────────────────────────────────
  if (Platform.OS !== 'web') {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.95)' }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingTop: 60, paddingHorizontal: spacing['4'], paddingBottom: spacing['3'],
              borderBottomWidth: 1, borderBottomColor: colors.dark.border,
            }}>
              <TextInput
                autoFocus
                placeholder="Search cities, countries, vibes..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={query}
                onChangeText={handleQueryChange}
                style={{
                  flex: 1, padding: spacing['3'],
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: fontSize.lg, fontWeight: fontWeight.medium,
                }}
              />
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={{ color: colors.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>Done</Text>
              </Pressable>
            </View>

            {/* Vibe chips */}
            {!debouncedQuery.trim() && (
              <View style={{ paddingHorizontal: spacing['4'], paddingTop: spacing['3'] }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                  Explore by vibe
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { emoji: '🏖️', label: 'Beach' }, { emoji: '🏔️', label: 'Mountain' },
                    { emoji: '🌃', label: 'City' }, { emoji: '💕', label: 'Romantic' },
                    { emoji: '🍜', label: 'Foodie' }, { emoji: '🎉', label: 'Nightlife' },
                    { emoji: '🏛️', label: 'Historic' }, { emoji: '🌴', label: 'Tropical' },
                  ].map(({ emoji, label }) => (
                    <Pressable
                      key={label}
                      onPress={() => handleQueryChange(label.toLowerCase())}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' }}>
                        {emoji} {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Results */}
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: spacing['4'], paddingTop: spacing['3'] }}
              renderItem={({ item: dest }) => (
                <Pressable
                  onPress={() => { onClose(); router.push(`/destination/${dest.id}`); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <Image
                    source={{ uri: dest.imageUrl }}
                    style={{ width: 48, height: 48, borderRadius: 10 }}
                    contentFit="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{dest.city}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                      {dest.country} · {dest.vibeTags.slice(0, 2).join(', ')}
                    </Text>
                  </View>
                  <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700' }}>
                    ${dest.livePrice ?? dest.flightPrice}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                debouncedQuery.trim() ? (
                  <View style={{ alignItems: 'center', paddingTop: 40 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
                      No destinations found
                    </Text>
                  </View>
                ) : null
              }
            />

            {/* Surprise Me button */}
            {!debouncedQuery.trim() && (
              <View style={{ padding: spacing['4'] }}>
                <Pressable
                  onPress={() => {
                    const rand = destinations[Math.floor(Math.random() * destinations.length)];
                    onClose();
                    router.push(`/destination/${rand.id}`);
                  }}
                  style={{
                    padding: spacing['4'], borderRadius: radii.lg,
                    backgroundColor: 'rgba(56,189,248,0.12)',
                    borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>🎲 Surprise Me</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  // ─── Web Search ─────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', paddingTop: 80,
        animation: animating ? 'sg-search-open 0.3s ease-out' : undefined,
        overflowY: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes sg-search-open {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sg-trending-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Search input */}
      <div style={{ width: '90%', maxWidth: 500 }}>
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search cities, countries, vibes..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            style={{
              width: '100%', padding: '16px 20px 16px 48px',
              fontSize: 18, fontWeight: 500,
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 16, color: '#fff',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <span style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            fontSize: 20, opacity: 0.5,
          }}>🔍</span>
        </div>

        {/* Budget slider */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>💰 Max</span>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={maxPrice}
            onChange={e => setMaxPrice(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#38BDF8' }}
          />
          <span style={{
            color: maxPrice < 2000 ? '#38BDF8' : 'rgba(255,255,255,0.4)',
            fontSize: 14, fontWeight: 700, minWidth: 50, textAlign: 'right',
          }}>
            {maxPrice < 2000 ? `$${maxPrice}` : 'Any'}
          </span>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {results.map((dest) => (
              <div
                key={dest.id}
                onClick={() => {
                  onClose();
                  router.push(`/destination/${dest.id}`);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', cursor: 'pointer',
                  borderRadius: 12, marginBottom: 4,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <img
                  src={dest.imageUrl}
                  alt={dest.city}
                  style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover' }}
                />
                <div>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
                    {dest.city}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500 }}>
                    {dest.country} · {dest.vibeTags.slice(0, 2).join(', ')}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', color: '#38BDF8', fontSize: 15, fontWeight: 700 }}>
                  ${dest.livePrice ?? dest.flightPrice}
                </div>
              </div>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginTop: 40, fontSize: 16 }}>
            No destinations found for "{query}"
          </div>
        )}

        {!query.trim() && (
          <>
            {/* Trending Now */}
            <div style={{ marginTop: 28 }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 12 }}>
                🔥 Trending Now
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {trendingDests.map((dest, i) => dest && (
                  <div
                    key={dest.id}
                    onClick={() => { onClose(); router.push(`/destination/${dest.id}`); }}
                    style={{
                      position: 'relative', borderRadius: 14, overflow: 'hidden',
                      aspectRatio: '1', cursor: 'pointer',
                      animation: `sg-trending-in 0.4s ${i * 0.06}s ease-out both`,
                    }}
                  >
                    <img src={dest.imageUrl} alt={dest.city} style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      transition: 'transform 0.3s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
                    }} />
                    <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8 }}>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{dest.city}</div>
                      <div style={{ color: '#38BDF8', fontSize: 11, fontWeight: 600 }}>${dest.livePrice ?? dest.flightPrice}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24, marginBottom: 24 }}>
              <button
                onClick={() => {
                  const rand = destinations[Math.floor(Math.random() * destinations.length)];
                  onClose();
                  router.push(`/destination/${rand.id}`);
                }}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(168,85,247,0.15) 100%)',
                  border: '1px solid rgba(56,189,248,0.2)',
                  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >🎲 Surprise Me</button>
              <button
                onClick={() => { onClose(); router.push('/quiz'); }}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 14,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >🎯 Quiz</button>
              <button
                onClick={() => { onClose(); router.push('/budget'); }}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 14,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >💰 Budget</button>
            </div>

            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 12 }}>
              Explore by vibe
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { emoji: '🏖️', label: 'Beach' },
                { emoji: '🏔️', label: 'Mountain' },
                { emoji: '🌃', label: 'City' },
                { emoji: '💕', label: 'Romantic' },
                { emoji: '🍜', label: 'Foodie' },
                { emoji: '🎉', label: 'Nightlife' },
                { emoji: '🏛️', label: 'Historic' },
                { emoji: '🌴', label: 'Tropical' },
                { emoji: '🎿', label: 'Winter' },
                { emoji: '💰', label: 'Budget' },
                { emoji: '⛰️', label: 'Nature' },
                { emoji: '🧗', label: 'Adventure' },
              ].map(({ emoji, label }) => (
                <div
                  key={label}
                  onClick={() => handleQueryChange(label.toLowerCase())}
                  style={{
                    padding: '8px 16px', borderRadius: 20,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(56,189,248,0.15)';
                    e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                >
                  {emoji} {label}
                </div>
              ))}
            </div>

            {/* Top deals */}
            <div style={{ marginTop: 24, paddingBottom: 40 }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 12 }}>
                Top deals from {departureCode}
              </div>
              {destinations
                .filter(d => {
                  const p = d.livePrice ?? d.flightPrice;
                  return p > 0 && p <= maxPrice;
                })
                .sort((a, b) => (a.livePrice ?? a.flightPrice) - (b.livePrice ?? b.flightPrice))
                .slice(0, 5)
                .map(dest => (
                  <div
                    key={dest.id}
                    onClick={() => { onClose(); router.push(`/destination/${dest.id}`); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '10px 16px', cursor: 'pointer', borderRadius: 12, marginBottom: 2,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <img src={dest.imageUrl} alt={dest.city} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{dest.city}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginLeft: 8 }}>{dest.country}</span>
                    </div>
                    <span style={{ color: '#4ADE80', fontSize: 15, fontWeight: 700 }}>${dest.livePrice ?? dest.flightPrice}</span>
                  </div>
                ))
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}
