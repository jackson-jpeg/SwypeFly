import { View, Text, FlatList, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { destinations } from '../../data/destinations';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface SimilarDestinationsProps {
  current: Destination;
}

function getSimilar(current: Destination): Destination[] {
  const currentVibes = new Set(current.vibeTags);
  return destinations
    .filter(d => d.id !== current.id)
    .map(d => {
      const sharedVibes = d.vibeTags.filter(v => currentVibes.has(v)).length;
      const sameCountry = d.country === current.country ? 1 : 0;
      const priceDiff = Math.abs((d.livePrice ?? d.flightPrice) - (current.livePrice ?? current.flightPrice));
      const priceScore = Math.max(0, 1 - priceDiff / 500);
      return { dest: d, score: sharedVibes * 2 + sameCountry + priceScore + Math.random() * 0.3 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(s => s.dest);
}

function NativeSimilarCard({ dest }: { dest: Destination }) {
  const price = dest.livePrice ?? dest.flightPrice;
  return (
    <Pressable
      onPress={() => router.push(`/destination/${dest.id}`)}
      style={{
        width: 180, marginRight: 12, borderRadius: 16, overflow: 'hidden',
        backgroundColor: colors.card.background,
      }}
    >
      <Image
        source={{ uri: dest.imageUrl }}
        style={{ width: 180, height: 120 }}
        contentFit="cover"
      />
      <View style={{ padding: 10 }}>
        <Text style={{ color: colors.card.textPrimary, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
          {dest.city}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <Text style={{ color: colors.card.textSecondary, fontSize: 12 }}>{dest.country}</Text>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>${price}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function SimilarDestinations({ current }: SimilarDestinationsProps) {
  const similar = getSimilar(current);
  if (similar.length === 0) return null;

  if (Platform.OS !== 'web') {
    return (
      <View style={{ marginTop: spacing['2'] }}>
        <Text style={{
          color: colors.text.primary,
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          marginBottom: spacing['4'],
        }}>
          Similar Destinations
        </Text>
        <FlatList
          data={similar}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => <NativeSimilarCard dest={item} />}
        />
      </View>
    );
  }

  return (
    <div style={{ marginTop: spacing['2'] }}>
      <div style={{ color: colors.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing['4'] }}>
        Similar Destinations
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
      }}>
        {similar.map(dest => {
          const price = dest.livePrice ?? dest.flightPrice;
          return (
            <div
              key={dest.id}
              onClick={() => router.push(`/destination/${dest.id}`)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/destination/${dest.id}`); }}
              style={{
                borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                position: 'relative', aspectRatio: '3/2',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <img
                src={dest.imageUrl}
                alt={`${dest.city}, ${dest.country}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                loading="lazy"
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.75) 100%)',
              }} />
              <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{dest.city}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{dest.country}</span>
                  <span style={{ color: '#38BDF8', fontSize: 13, fontWeight: 700 }}>${price}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
