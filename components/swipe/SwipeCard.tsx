import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { CardGradient } from './CardGradient';
import { CardActions } from './CardActions';
import { formatFlightPrice } from '../../utils/formatPrice';
import type { Destination } from '../../types/destination';

interface SwipeCardProps {
  destination: Destination;
  isActive: boolean;
  isPreloaded: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
}

function SwipeCardInner({ destination, isActive, isPreloaded, isSaved, onToggleSave }: SwipeCardProps) {
  const shouldLoadImage = isActive || isPreloaded;

  const handleCardTap = () => {
    router.push(`/destination/${destination.id}`);
  };

  if (Platform.OS === 'web') {
    return (
      <div
        onClick={handleCardTap}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          cursor: 'pointer',
          overflow: 'hidden',
          backgroundColor: '#0A0A0A',
        }}
      >
        {/* Background Image */}
        {shouldLoadImage && (
          <img
            src={destination.imageUrl}
            alt={destination.city}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
            }}
            loading={isActive ? 'eager' : 'lazy'}
            draggable={false}
          />
        )}

        {/* Gradient */}
        <CardGradient />

        {/* Save — top right */}
        <div
          style={{ position: 'absolute', top: 56, right: 20, zIndex: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <CardActions isSaved={isSaved} onToggleSave={onToggleSave} />
        </div>

        {/* Content — bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            padding: '0 28px 84px 28px',
          }}
        >
          {/* Tags — tiny, text-only, near-invisible */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            {destination.vibeTags.slice(0, 2).map((tag, i) => (
              <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>·</span>
                )}
                <span
                  style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: 2,
                  }}
                >
                  {tag}
                </span>
              </span>
            ))}
          </div>

          {/* City */}
          <h1
            style={{
              margin: 0,
              color: '#fff',
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: -0.5,
              lineHeight: 1,
              textShadow: '0 1px 20px rgba(0,0,0,0.3)',
            }}
          >
            {destination.city}
          </h1>

          {/* Country · Price */}
          <p style={{ margin: '10px 0 0 0', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>
              {destination.country}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 10px' }}>·</span>
            <span style={{ color: '#FF8F65', fontWeight: 600 }}>
              {formatFlightPrice(destination.flightPrice, destination.currency)}
            </span>
            {destination.livePrice != null && (
              <span style={{
                marginLeft: 8,
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: '#4ADE80',
                display: 'inline-block',
                boxShadow: '0 0 6px rgba(74,222,128,0.5)',
              }} />
            )}
          </p>
        </div>
      </div>
    );
  }

  // ── Native ──
  return (
    <Pressable
      onPress={handleCardTap}
      style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#0A0A0A' }}
    >
      {shouldLoadImage && (
        <Image
          source={{ uri: destination.imageUrl }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
          contentFit="cover"
          transition={isActive ? 300 : 0}
          priority={isActive ? 'high' : 'low'}
        />
      )}

      <CardGradient />

      <View style={{ position: 'absolute', top: 56, right: 20, zIndex: 10 }}>
        <CardActions isSaved={isSaved} onToggleSave={onToggleSave} />
      </View>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 28, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          {destination.vibeTags.slice(0, 2).map((tag, i) => (
            <View key={tag} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {i > 0 && <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>·</Text>}
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2 }}>{tag}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -0.5 }}>{destination.city}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>{destination.country}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 15 }}>·</Text>
          <Text style={{ color: '#FF8F65', fontSize: 15, fontWeight: '600' }}>{formatFlightPrice(destination.flightPrice, destination.currency)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export const SwipeCard = React.memo(SwipeCardInner, (prev, next) => {
  return (
    prev.destination.id === next.destination.id &&
    prev.isActive === next.isActive &&
    prev.isPreloaded === next.isPreloaded &&
    prev.isSaved === next.isSaved
  );
});
