import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { CardGradient } from './CardGradient';
import { CardActions } from './CardActions';
import { CardDealBadge } from './CardDealBadge';
import { CardFreshnessPill } from './CardFreshnessPill';
import { shareDestination } from '../../utils/share';
import { successHaptic } from '../../utils/haptics';
import type { Destination } from '../../types/destination';

interface SwipeCardProps {
  destination: Destination;
  isActive: boolean;
  isPreloaded: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
}

const DOUBLE_TAP_DELAY = 300;

function SwipeCardInner({ destination, isActive, isPreloaded, isSaved, onToggleSave }: SwipeCardProps) {
  const shouldLoadImage = isActive || isPreloaded;

  // ── Double-tap detection (native) ──
  const lastTapRef = useRef(0);

  // ── Heart burst animation (native) ──
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  // ── Card entry scale animation (native) ──
  const cardScale = useSharedValue(isActive ? 1 : 0.97);
  const prevIsActive = useRef(isActive);

  useEffect(() => {
    if (isActive && !prevIsActive.current) {
      cardScale.value = 0.97;
      cardScale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.8 });
    }
    prevIsActive.current = isActive;
  }, [isActive, cardScale]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  // ── Heart burst (web state) ──
  const [showWebHeart, setShowWebHeart] = useState(false);

  const triggerHeartBurst = useCallback(() => {
    if (!isSaved) {
      onToggleSave();
    }
    successHaptic();

    if (Platform.OS === 'web') {
      setShowWebHeart(true);
      setTimeout(() => setShowWebHeart(false), 800);
    } else {
      heartOpacity.value = 1;
      heartScale.value = withSequence(
        withTiming(1.5, { duration: 300, easing: Easing.out(Easing.back(2)) }),
        withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }),
      );
      heartOpacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 400 }),
      );
    }
  }, [isSaved, onToggleSave, heartScale, heartOpacity]);

  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  const handleCardTap = () => {
    router.push(`/destination/${destination.id}`);
  };

  const handleInfo = () => {
    router.push(`/destination/${destination.id}`);
  };

  const handleShare = () => {
    shareDestination(destination.city, destination.country, destination.tagline);
  };

  const attribution = destination.photographerAttribution;

  // ── Web ──
  if (Platform.OS === 'web') {
    return (
      <div
        onClick={handleCardTap}
        onDoubleClick={(e) => {
          e.stopPropagation();
          triggerHeartBurst();
        }}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          cursor: 'pointer',
          overflow: 'hidden',
          backgroundColor: '#0F172A',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: isActive ? 'scale(1)' : 'scale(0.97)',
        }}
      >
        <style>{`
          @keyframes sg-heart-burst {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
          }
        `}</style>

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

        {/* Heart Burst Overlay */}
        {showWebHeart && (
          <div
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              zIndex: 20,
              pointerEvents: 'none',
              animation: 'sg-heart-burst 0.8s ease-out forwards',
            }}
          >
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                fill="#38BDF8"
                stroke="#38BDF8"
                strokeWidth="1.2"
              />
            </svg>
          </div>
        )}

        {/* Top row: Freshness pill (left) + Actions (right) */}
        <div
          style={{ position: 'absolute', top: 56, left: 20, zIndex: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <CardFreshnessPill destination={destination} />
        </div>
        <div
          style={{ position: 'absolute', top: 56, right: 20, zIndex: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <CardActions
            isSaved={isSaved}
            onToggleSave={onToggleSave}
            onInfo={handleInfo}
            onShare={handleShare}
          />
        </div>

        {/* Content — bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            padding: '0 28px 84px 28px',
          }}
        >
          {/* Deal Badge */}
          <div style={{ marginBottom: 16 }}>
            <CardDealBadge destination={destination} />
          </div>

          {/* Tags — tiny, text-only */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            {destination.vibeTags.slice(0, 2).map((tag, i) => (
              <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>·</span>
                )}
                <span
                  style={{
                    color: 'rgba(255,255,255,0.6)',
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
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            {destination.city}
          </h1>

          {/* Country · Duration · Rating */}
          <p style={{ margin: '10px 0 0 0', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>
              {destination.country}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 10px' }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
              {destination.flightDuration}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 10px' }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
              {destination.rating}★
            </span>
          </p>

          {/* Photographer attribution */}
          {attribution && (
            <p style={{ margin: '10px 0 0 0', fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'right' as const }}>
              📷 by {attribution.name}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Native ──
  const handleNativeTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap
      lastTapRef.current = 0;
      triggerHeartBurst();
    } else {
      lastTapRef.current = now;
      // Wait to see if it's a double tap
      setTimeout(() => {
        if (lastTapRef.current !== 0) {
          lastTapRef.current = 0;
          runOnJS(handleCardTap)();
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  return (
    <Animated.View style={[{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#0F172A' }, cardAnimStyle]}>
      <Pressable
        onPress={handleNativeTap}
        style={{ flex: 1, position: 'relative' }}
      >
        {shouldLoadImage && (
          <Image
            source={{ uri: destination.imageUrl }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
            contentFit="cover"
            transition={isActive ? 300 : 0}
            priority={isActive ? 'high' : 'low'}
            placeholder={destination.blurHash || undefined}
          />
        )}

        <CardGradient />

        {/* Heart Burst Overlay (native) */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginLeft: -40,
              marginTop: -40,
              zIndex: 20,
            },
            heartAnimStyle,
          ]}
          pointerEvents="none"
        >
          <View>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                fill="#38BDF8"
                stroke="#38BDF8"
                strokeWidth="1.2"
              />
            </svg>
          </View>
        </Animated.View>

        {/* Top row: Freshness pill (left) + Actions (right) */}
        <View style={{ position: 'absolute', top: 56, left: 20, zIndex: 10 }}>
          <CardFreshnessPill destination={destination} />
        </View>
        <View style={{ position: 'absolute', top: 56, right: 20, zIndex: 10 }}>
          <CardActions
            isSaved={isSaved}
            onToggleSave={onToggleSave}
            onInfo={handleInfo}
            onShare={handleShare}
          />
        </View>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 28, paddingBottom: 100 }}>
          {/* Deal Badge */}
          <View style={{ marginBottom: 16 }}>
            <CardDealBadge destination={destination} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            {destination.vibeTags.slice(0, 2).map((tag, i) => (
              <View key={tag} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {i > 0 && <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>·</Text>}
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2 }}>{tag}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -0.5 }}>{destination.city}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15 }}>{destination.country}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 15 }}>·</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{destination.flightDuration}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13 }}>·</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' }}>{destination.rating}★</Text>
          </View>
          {attribution && (
            <Text style={{ marginTop: 10, fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
              📷 by {attribution.name}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
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
