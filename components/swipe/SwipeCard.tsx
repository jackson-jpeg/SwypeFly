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
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { CardGradient } from './CardGradient';
import { CardActions } from './CardActions';
import { CardDealBadge } from './CardDealBadge';
import { CardFreshnessPill } from './CardFreshnessPill';
import { shareDestination } from '../../utils/share';
import { successHaptic } from '../../utils/haptics';
import { colors, layout } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface SwipeCardProps {
  destination: Destination;
  isActive: boolean;
  isPreloaded: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
}

const DOUBLE_TAP_DELAY = 300;

// Stagger animation config
const STAGGER_DURATION = 350;
const STAGGER_EASE = Easing.out(Easing.cubic);

const SLIDESHOW_INTERVAL = 4500; // ms between image transitions

function SwipeCardInner({ destination, isActive, isPreloaded, isSaved, onToggleSave }: SwipeCardProps) {
  const shouldLoadImage = isActive || isPreloaded;

  // ── Image slideshow ──
  const imageList = destination.imageUrls?.length ? destination.imageUrls : [destination.imageUrl];
  const hasMultipleImages = imageList.length > 1;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const slideshowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset image index when destination or active state changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [destination.id]);

  // Auto-cycle images when card is active
  useEffect(() => {
    if (isActive && hasMultipleImages) {
      slideshowTimerRef.current = setInterval(() => {
        setActiveImageIndex((prev) => (prev + 1) % imageList.length);
      }, SLIDESHOW_INTERVAL);
    }
    return () => {
      if (slideshowTimerRef.current) {
        clearInterval(slideshowTimerRef.current);
        slideshowTimerRef.current = null;
      }
    };
  }, [isActive, hasMultipleImages, imageList.length]);

  // ── Double-tap detection (native) ──
  const lastTapRef = useRef(0);

  // ── Heart burst animation (native) ──
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  // ── Card entry scale animation (native) ──
  const cardScale = useSharedValue(isActive ? 1 : 0.97);
  const prevIsActive = useRef(isActive);

  // ── Staggered content entrance animations (native) ──
  const dealY = useSharedValue(isActive ? 0 : 20);
  const dealOpacity = useSharedValue(isActive ? 1 : 0);
  const tagsY = useSharedValue(isActive ? 0 : 15);
  const tagsOpacity = useSharedValue(isActive ? 1 : 0);
  const cityY = useSharedValue(isActive ? 0 : 20);
  const cityOpacity = useSharedValue(isActive ? 1 : 0);
  const metaY = useSharedValue(isActive ? 0 : 15);
  const metaOpacity = useSharedValue(isActive ? 1 : 0);
  const actionsX = useSharedValue(isActive ? 0 : 20);
  const actionsOpacity = useSharedValue(isActive ? 1 : 0);

  // ── Web stagger state ──
  const [webStaggerActive, setWebStaggerActive] = useState(isActive);
  const webPrevIsActive = useRef(isActive);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (isActive && !webPrevIsActive.current) {
        // Reset then trigger stagger
        setWebStaggerActive(false);
        requestAnimationFrame(() => {
          setWebStaggerActive(true);
        });
      } else if (isActive) {
        setWebStaggerActive(true);
      }
      webPrevIsActive.current = isActive;
      return;
    }

    if (isActive && !prevIsActive.current) {
      cardScale.value = 0.97;
      cardScale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.8 });

      // Stagger content entrance
      dealY.value = 20;
      dealOpacity.value = 0;
      dealY.value = withTiming(0, { duration: STAGGER_DURATION, easing: STAGGER_EASE });
      dealOpacity.value = withTiming(1, { duration: STAGGER_DURATION, easing: STAGGER_EASE });

      tagsY.value = 15;
      tagsOpacity.value = 0;
      tagsY.value = withDelay(50, withTiming(0, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));
      tagsOpacity.value = withDelay(50, withTiming(1, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));

      cityY.value = 20;
      cityOpacity.value = 0;
      cityY.value = withDelay(100, withTiming(0, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));
      cityOpacity.value = withDelay(100, withTiming(1, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));

      metaY.value = 15;
      metaOpacity.value = 0;
      metaY.value = withDelay(150, withTiming(0, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));
      metaOpacity.value = withDelay(150, withTiming(1, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));

      actionsX.value = 20;
      actionsOpacity.value = 0;
      actionsX.value = withDelay(100, withTiming(0, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));
      actionsOpacity.value = withDelay(100, withTiming(1, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));
    }
    prevIsActive.current = isActive;
  }, [isActive, cardScale, dealY, dealOpacity, tagsY, tagsOpacity, cityY, cityOpacity, metaY, metaOpacity, actionsX, actionsOpacity]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const dealAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dealY.value }],
    opacity: dealOpacity.value,
  }));

  const tagsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tagsY.value }],
    opacity: tagsOpacity.value,
  }));

  const cityAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cityY.value }],
    opacity: cityOpacity.value,
  }));

  const metaAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: metaY.value }],
    opacity: metaOpacity.value,
  }));

  const actionsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: actionsX.value }],
    opacity: actionsOpacity.value,
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
    shareDestination(
      destination.city,
      destination.country,
      destination.tagline,
      destination.id,
      destination.livePrice ?? destination.flightPrice,
      destination.currency,
    );
  };

  // ── Web stagger CSS helper ──
  const webStagger = (delayMs: number, translatePx: number, direction: 'Y' | 'X' = 'Y') => ({
    transition: `transform ${STAGGER_DURATION}ms cubic-bezier(0.33, 1, 0.68, 1) ${delayMs}ms, opacity ${STAGGER_DURATION}ms cubic-bezier(0.33, 1, 0.68, 1) ${delayMs}ms`,
    transform: webStaggerActive
      ? 'translate(0, 0)'
      : direction === 'Y'
        ? `translateY(${translatePx}px)`
        : `translateX(${translatePx}px)`,
    opacity: webStaggerActive ? 1 : 0,
  });

  // ── Tiny thumbnail URL for progressive loading ──
  const thumbUrl = destination.imageUrl?.includes('unsplash.com')
    ? destination.imageUrl.replace(/w=\d+/, 'w=32').replace(/q=\d+/, 'q=20')
    : undefined;

  // Track web image loaded state for crossfade
  const [webImageLoaded, setWebImageLoaded] = useState(false);
  const prevDestId = useRef(destination.id);
  if (destination.id !== prevDestId.current) {
    prevDestId.current = destination.id;
    setWebImageLoaded(false);
  }

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
          backgroundColor: colors.navy,
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

        {/* Tiny blurred placeholder */}
        {thumbUrl && !webImageLoaded && (
          <img
            src={thumbUrl}
            alt=""
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              filter: 'blur(20px)',
              transform: 'scale(1.1)',
            }}
            draggable={false}
          />
        )}

        {/* Slideshow images — stack with crossfade */}
        {shouldLoadImage && imageList.map((url, idx) => (
          <img
            key={url}
            src={url}
            alt={idx === 0 ? destination.city : ''}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              opacity: idx === activeImageIndex ? (idx === 0 ? (webImageLoaded ? 1 : 0) : 1) : 0,
              transition: 'opacity 0.8s ease',
              zIndex: idx === activeImageIndex ? 1 : 0,
            }}
            loading={idx === 0 ? (isActive ? 'eager' : 'lazy') : 'lazy'}
            draggable={false}
            onLoad={idx === 0 ? () => setWebImageLoaded(true) : undefined}
          />
        ))}

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
                fill={colors.primary}
                stroke={colors.primary}
                strokeWidth="1.2"
              />
            </svg>
          </div>
        )}

        {/* Top-left: Freshness pill */}
        <div
          style={{ position: 'absolute', top: 56, left: 20, zIndex: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <CardFreshnessPill destination={destination} />
        </div>

        {/* Bottom-right: Action buttons (TikTok layout) */}
        <div
          style={{
            position: 'absolute',
            bottom: layout.cardPaddingBottom + 60,
            right: 20,
            zIndex: 10,
            ...webStagger(100, 20, 'X'),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <CardActions
            isSaved={isSaved}
            onToggleSave={onToggleSave}
            onInfo={handleInfo}
            onShare={handleShare}
          />
        </div>

        {/* Slideshow dots */}
        {hasMultipleImages && (
          <div
            style={{
              position: 'absolute',
              top: 56 + 36,
              left: 20,
              display: 'flex',
              gap: 4,
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            {imageList.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: idx === activeImageIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: idx === activeImageIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        )}

        {/* Content — bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 80,
            padding: `0 ${layout.cardPaddingHorizontal}px ${layout.cardPaddingBottom}px ${layout.cardPaddingHorizontal}px`,
          }}
        >
          {/* Deal Badge */}
          <div style={{ marginBottom: 16, ...webStagger(0, 20) }}>
            <CardDealBadge destination={destination} />
          </div>

          {/* Tags — tiny, text-only */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, ...webStagger(50, 15) }}>
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
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: -0.5,
              lineHeight: 1,
              textShadow: '0 2px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)',
              ...webStagger(100, 20),
            }}
          >
            {destination.city}
          </h1>

          {/* Tagline */}
          {destination.tagline && (
            <p style={{
              margin: '6px 0 0 0',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 14,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              ...webStagger(120, 12),
            }}>
              {destination.tagline}
            </p>
          )}

          {/* Country · Duration · Rating */}
          <p style={{
            margin: '10px 0 0 0', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center',
            ...webStagger(150, 15),
          }}>
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
    <Animated.View style={[{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: colors.navy }, cardAnimStyle]}>
      <Pressable
        onPress={handleNativeTap}
        style={{ flex: 1, position: 'relative' }}
      >
        {shouldLoadImage && imageList.map((url, idx) => (
          <Image
            key={url}
            source={{ uri: url }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              width: '100%', height: '100%',
              opacity: idx === activeImageIndex ? 1 : 0,
              zIndex: idx === activeImageIndex ? 1 : 0,
            }}
            contentFit="cover"
            transition={idx === 0 ? (isActive ? 300 : 0) : 800}
            priority={idx === 0 ? (isActive ? 'high' : 'low') : 'low'}
            placeholder={idx === 0 ? (destination.blurHash || undefined) : undefined}
          />
        ))}

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
                fill={colors.primary}
                stroke={colors.primary}
                strokeWidth="1.2"
              />
            </svg>
          </View>
        </Animated.View>

        {/* Top-left: Freshness pill */}
        <View style={{ position: 'absolute', top: 56, left: 20, zIndex: 10 }}>
          <CardFreshnessPill destination={destination} />
        </View>

        {/* Slideshow dots */}
        {hasMultipleImages && (
          <View style={{ position: 'absolute', top: 56 + 36, left: 20, flexDirection: 'row', gap: 4, zIndex: 10 }}>
            {imageList.map((_, idx) => (
              <View
                key={idx}
                style={{
                  width: idx === activeImageIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: idx === activeImageIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </View>
        )}

        {/* Bottom-right: Action buttons (TikTok layout) */}
        <Animated.View style={[{ position: 'absolute', bottom: layout.cardPaddingBottomNative + 60, right: 20, zIndex: 10 }, actionsAnimStyle]}>
          <CardActions
            isSaved={isSaved}
            onToggleSave={onToggleSave}
            onInfo={handleInfo}
            onShare={handleShare}
          />
        </Animated.View>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 80, paddingHorizontal: layout.cardPaddingHorizontal, paddingBottom: layout.cardPaddingBottomNative }}>
          {/* Deal Badge */}
          <Animated.View style={[{ marginBottom: 16 }, dealAnimStyle]}>
            <CardDealBadge destination={destination} />
          </Animated.View>

          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }, tagsAnimStyle]}>
            {destination.vibeTags.slice(0, 2).map((tag, i) => (
              <View key={tag} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {i > 0 && <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>·</Text>}
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2 }}>{tag}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View style={cityAnimStyle}>
            <Text style={{
              color: '#fff',
              fontSize: 38,
              fontWeight: '800',
              letterSpacing: -0.5,
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 16,
            }}>
              {destination.city}
            </Text>
          </Animated.View>

          {/* Tagline */}
          {destination.tagline ? (
            <Animated.View style={[{ marginTop: 4 }, cityAnimStyle]}>
              <Text
                numberOfLines={1}
                style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}
              >
                {destination.tagline}
              </Text>
            </Animated.View>
          ) : null}

          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 }, metaAnimStyle]}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15 }}>{destination.country}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 15 }}>·</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{destination.flightDuration}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13 }}>·</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' }}>{destination.rating}★</Text>
          </Animated.View>
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
