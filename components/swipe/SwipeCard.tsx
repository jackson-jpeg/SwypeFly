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
import { shareDestination } from '../../utils/share';
import { successHaptic } from '../../utils/haptics';
import { colors, layout, fonts } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface SwipeCardProps {
  destination: Destination;
  isActive: boolean;
  isPreloaded: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  index?: number;
}

const DOUBLE_TAP_DELAY = 300;
const SLIDESHOW_INTERVAL = 4500;
const STAGGER_DURATION = 350;
const STAGGER_EASE = Easing.out(Easing.cubic);

// ── SVG Icons (web only) ──

const HeartOutline = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HeartFilled = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill={colors.primary} stroke={colors.primary} strokeWidth="1.8" />
  </svg>
);

const ShareIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
      stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function SwipeCardInner({ destination, isActive, isPreloaded, isSaved, onToggleSave, index }: SwipeCardProps) {
  const shouldLoadImage = isActive || isPreloaded;

  // ── Image slideshow ──
  const imageList = destination.imageUrls?.length ? destination.imageUrls : [destination.imageUrl];
  const hasMultipleImages = imageList.length > 1;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const slideshowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setActiveImageIndex(0); }, [destination.id]);

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

  // ── Double-tap (native) ──
  const lastTapRef = useRef(0);

  // ── Heart burst ──
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  // ── Card scale (native) ──
  const cardScale = useSharedValue(isActive ? 1 : 0.97);
  const prevIsActive = useRef(isActive);

  // ── Native stagger shared values ──
  const cityY = useSharedValue(isActive ? 0 : 20);
  const metaY = useSharedValue(isActive ? 0 : 15);
  const actionsX = useSharedValue(isActive ? 0 : 20);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (isActive && !prevIsActive.current) {
      cardScale.value = 0.97;
      cardScale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.8 });
      cityY.value = 20;
      cityY.value = withDelay(50, withTiming(0, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));
      metaY.value = 15;
      metaY.value = withDelay(100, withTiming(0, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));
      actionsX.value = 20;
      actionsX.value = withDelay(80, withTiming(0, { duration: STAGGER_DURATION, easing: STAGGER_EASE }));
    }
    prevIsActive.current = isActive;
  }, [isActive, cardScale, cityY, metaY, actionsX]);

  const cardAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const cityAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateY: cityY.value }] }));
  const metaAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateY: metaY.value }] }));
  const actionsAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateX: actionsX.value }] }));

  // ── Heart burst (web) ──
  const [showWebHeart, setShowWebHeart] = useState(false);

  const triggerHeartBurst = useCallback(() => {
    if (!isSaved) onToggleSave();
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

  const handleCardTap = () => { router.push(`/destination/${destination.id}`); };
  const handleShare = () => {
    shareDestination(destination.city, destination.country, destination.tagline, destination.id, destination.livePrice ?? destination.flightPrice, destination.currency);
  };

  const effectivePrice = destination.livePrice ?? destination.flightPrice;
  const isDeal = destination.livePrice != null && destination.livePrice < destination.flightPrice * 0.85;
  const savings = isDeal ? Math.round(((destination.flightPrice - destination.livePrice!) / destination.flightPrice) * 100) : 0;
  const isNew = parseInt(destination.id) >= 147; // batch3 destinations

  // ── Ken Burns effect — cycle through different pan/zoom combos ──
  const kenBurnsVariants = [
    { from: 'scale(1) translate(0%, 0%)', to: 'scale(1.15) translate(-2%, -1%)' },
    { from: 'scale(1.1) translate(-3%, 0%)', to: 'scale(1) translate(1%, 2%)' },
    { from: 'scale(1) translate(2%, 1%)', to: 'scale(1.12) translate(-1%, -2%)' },
    { from: 'scale(1.08) translate(0%, -2%)', to: 'scale(1.02) translate(2%, 1%)' },
  ];

  // ── Horizontal swipe gesture (web) ──
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDragging = useRef(false);

  const SWIPE_THRESHOLD = 80;
  const swipeLabel = swipeX > SWIPE_THRESHOLD ? 'SAVE' : swipeX < -SWIPE_THRESHOLD ? 'SKIP' : null;
  const swipeColor = swipeX > SWIPE_THRESHOLD ? '#22C55E' : swipeX < -SWIPE_THRESHOLD ? '#EF4444' : 'transparent';

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    isDragging.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    if (!isDragging.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      isDragging.current = true;
    }
    if (isDragging.current) {
      setSwipeX(dx * 0.6);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeX > SWIPE_THRESHOLD) {
      if (!isSaved) onToggleSave();
      successHaptic();
    }
    setSwipeX(0);
    touchStartRef.current = null;
    isDragging.current = false;
  }, [swipeX, isSaved, onToggleSave]);

  // ── Web ──
  if (Platform.OS === 'web') {
    // Generate unique animation name per card for Ken Burns
    const kbId = `kb-${destination.id}`;

    return (
      <div
        onClick={(e) => { if (!isDragging.current) handleCardTap(); }}
        onDoubleClick={(e) => { e.stopPropagation(); triggerHeartBurst(); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          cursor: 'pointer', overflow: 'hidden', backgroundColor: colors.navy,
          transition: swipeX === 0 ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
          transform: swipeX !== 0
            ? `translateX(${swipeX}px) rotate(${swipeX * 0.02}deg)`
            : isActive ? 'scale(1)' : 'scale(0.97)',
        }}
      >
        {/* Dynamic Ken Burns keyframes — per-card unique variants */}
        <style>{kenBurnsVariants.map((v, i) => `
          @keyframes ${kbId}-${i} {
            0% { transform: ${v.from}; }
            100% { transform: ${v.to}; }
          }
        `).join('')}</style>

        {/* Images — stack with crossfade + Ken Burns */}
        {shouldLoadImage && imageList.map((url, idx) => {
          const kbVariant = kenBurnsVariants[idx % kenBurnsVariants.length];
          const isActiveImg = idx === activeImageIndex;
          return (
            <img
              key={url}
              src={url}
              alt={idx === 0 ? destination.city : ''}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                objectFit: 'cover',
                opacity: isActiveImg ? 1 : 0,
                transition: 'opacity 0.8s ease',
                zIndex: isActiveImg ? 1 : 0,
                backgroundColor: colors.navy,
                animation: isActiveImg && isActive ? `${kbId}-${idx % kenBurnsVariants.length} ${SLIDESHOW_INTERVAL}ms ease-out forwards` : 'none',
                willChange: isActiveImg ? 'transform' : 'auto',
              }}
              loading={idx === 0 ? (isActive ? 'eager' : 'lazy') : 'lazy'}
              draggable={false}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750';
              }}
            />
          );
        })}

        {/* Vignette overlay for cinematic feel */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.45) 100%)',
        }} />

        {/* New badge */}
        {isNew && (
          <div style={{
            position: 'absolute', top: 56, left: 20, zIndex: 5,
            padding: '3px 8px', borderRadius: 6,
            backgroundColor: 'rgba(168,85,247,0.3)', border: '1px solid rgba(168,85,247,0.4)',
          }}>
            <span style={{ color: '#C084FC', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>NEW</span>
          </div>
        )}

        {/* Image indicator dots */}
        {hasMultipleImages && (
          <div style={{
            position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 4, zIndex: 5, pointerEvents: 'none',
          }}>
            {imageList.map((_, i) => (
              <div key={i} style={{
                width: i === activeImageIndex ? 16 : 6, height: 4, borderRadius: 2,
                backgroundColor: i === activeImageIndex ? '#fff' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>
        )}

        {/* Minimal gradient — just enough for text */}
        <CardGradient />

        {/* Heart burst overlay */}
        {showWebHeart && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', zIndex: 20, pointerEvents: 'none',
            animation: 'sg-heart-burst 0.8s ease-out forwards',
          }}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                fill={colors.primary} stroke={colors.primary} strokeWidth="1.2" />
            </svg>
          </div>
        )}

        {/* Swipe label overlay */}
        {swipeLabel && (
          <div style={{
            position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 25, pointerEvents: 'none',
            padding: '12px 32px', borderRadius: 16,
            border: `3px solid ${swipeColor}`,
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}>
            <span style={{
              color: swipeColor, fontSize: 32, fontWeight: 900, letterSpacing: 4,
            }}>{swipeLabel}</span>
          </div>
        )}

        {/* Right side: action column — deepDusk-translucent circles */}
        <div
          style={{
            position: 'absolute', bottom: 140, right: 16, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Save */}
          <button
            onClick={() => onToggleSave()}
            aria-label={isSaved ? 'Unsave destination' : 'Save destination'}
            style={{
              width: 52, height: 52, borderRadius: 26,
              backgroundColor: 'rgba(44,31,26,0.35)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: 0, fontFamily: 'inherit',
            }}
          >
            {isSaved ? HeartFilled : HeartOutline}
          </button>
          {/* Share */}
          <button
            onClick={handleShare}
            aria-label="Share destination"
            style={{
              width: 52, height: 52, borderRadius: 26,
              backgroundColor: 'rgba(44,31,26,0.35)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: 0, fontFamily: 'inherit',
            }}
          >
            {ShareIcon}
          </button>
        </div>

        {/* Bottom-left: content stack matching Paper design */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 80, zIndex: 5,
            padding: `0 ${layout.cardPaddingHorizontal}px ${layout.cardPaddingBottom + 8}px ${layout.cardPaddingHorizontal}px`,
          }}
        >
          {/* City — Syne ExtraBold, ALL CAPS */}
          <h1
            style={{
              margin: 0, color: '#fff',
              fontFamily: `${fonts.display}, sans-serif`, fontWeight: 800,
              fontSize: 48, letterSpacing: -1, lineHeight: 0.95,
              textTransform: 'uppercase' as const,
              textShadow: '0 2px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)',
              animation: isActive ? 'sg-city-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) both' : 'none',
            }}
          >
            {destination.city}
          </h1>

          {/* Tagline — Inter Regular, NOT italic */}
          <p style={{
            margin: '8px 0 0 0',
            fontFamily: `${fonts.body}, sans-serif`, fontWeight: 400,
            fontSize: 15, lineHeight: 1.3,
            color: 'rgba(255,255,255,0.7)',
            textShadow: '0 1px 8px rgba(0,0,0,0.5)',
            animation: isActive ? 'sg-meta-enter 0.5s 0.15s ease-out both' : 'none',
          }}>
            {destination.tagline}
          </p>

          {/* Metadata strip: COUNTRY · FLIGHT_DURATION · VIBE — all caps */}
          <p style={{
            margin: '6px 0 0 0', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center',
            fontFamily: `${fonts.body}, sans-serif`, fontWeight: 500,
            textTransform: 'uppercase' as const, letterSpacing: 1.5,
            textShadow: '0 1px 8px rgba(0,0,0,0.5)',
            animation: isActive ? 'sg-meta-enter 0.4s 0.2s ease-out both' : 'none',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{destination.country}</span>
            <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 8px' }}>•</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{destination.flightDuration?.replace(/\s/g, '') || 'Direct'}</span>
            <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 8px' }}>•</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{destination.vibeTags?.[0] || 'Travel'}</span>
          </p>

          {/* Price pill — deepDusk bg, Syne SemiBold price, LIVE PRICE in sageDrift */}
          <div style={{
            marginTop: 14, display: 'flex', alignItems: 'center', gap: 8,
            animation: isActive ? 'sg-price-enter 0.5s 0.3s ease-out both' : 'none',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 9999,
              backgroundColor: colors.deepDusk,
              border: `1px solid rgba(255,255,255,0.08)`,
            }}>
              <span style={{
                fontFamily: `${fonts.body}, sans-serif`, fontWeight: 400,
                color: 'rgba(255,255,255,0.6)', fontSize: 13,
              }}>From</span>
              <span style={{
                fontFamily: `${fonts.display}, sans-serif`, fontWeight: 700,
                color: '#fff', fontSize: 20,
              }}>
                ${effectivePrice}
              </span>
              {destination.priceSource && destination.priceSource !== 'estimate' && (
                <span style={{
                  fontFamily: `${fonts.body}, sans-serif`, fontWeight: 700,
                  fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' as const,
                  color: colors.sageDrift,
                }}>
                  LIVE PRICE
                </span>
              )}
            </div>
            {isDeal && (
              <span style={{
                padding: '6px 12px', borderRadius: 9999,
                backgroundColor: colors.sunriseButter,
                color: colors.deepDusk,
                fontFamily: `${fonts.display}, sans-serif`,
                fontSize: 12, fontWeight: 700,
              }}>
                {savings}% OFF
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Native ──
  const handleNativeTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      lastTapRef.current = 0;
      triggerHeartBurst();
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current !== 0) { lastTapRef.current = 0; runOnJS(handleCardTap)(); }
      }, DOUBLE_TAP_DELAY);
    }
  };

  return (
    <Animated.View style={[{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: colors.navy }, cardAnimStyle]}>
      <Pressable onPress={handleNativeTap} style={{ flex: 1, position: 'relative' }}
        accessibilityRole="button"
        accessibilityLabel={`${destination.city}, ${destination.country}. From $${effectivePrice}.`}
        accessibilityHint="Tap to view details, double tap to save"
      >
        {shouldLoadImage && imageList.map((url, idx) => (
          <Image key={url} source={{ uri: url }}
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

        {/* Heart burst (native) */}
        <Animated.View
          style={[{
            position: 'absolute', top: '50%', left: '50%',
            marginLeft: -40, marginTop: -40, zIndex: 20,
          }, heartAnimStyle]}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 64, textAlign: 'center' }}>❤️</Text>
        </Animated.View>

        {/* Right side: action column */}
        <Animated.View style={[{
          position: 'absolute', bottom: 120, right: 16, zIndex: 10,
          alignItems: 'center', gap: 20,
        }, actionsAnimStyle]}>
          <Pressable onPress={onToggleSave} hitSlop={12}
            style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: 'rgba(0,0,0,0.3)',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            }}>
            <Text style={{ fontSize: 24 }}>{isSaved ? '❤️' : '🤍'}</Text>
          </Pressable>
          <Pressable onPress={handleShare} hitSlop={12}
            style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: 'rgba(0,0,0,0.3)',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            }}>
            <Text style={{ fontSize: 22 }}>↗</Text>
          </Pressable>
        </Animated.View>

        {/* Bottom-left: minimal content */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 80, zIndex: 5,
          paddingHorizontal: layout.cardPaddingHorizontal,
          paddingBottom: layout.cardPaddingBottomNative,
        }}>
          <Animated.View style={cityAnimStyle}>
            <Text style={{
              color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -0.5,
              textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 16,
            }}>
              {destination.city}
            </Text>
          </Animated.View>

          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 }, metaAnimStyle]}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{destination.country}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>·</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{destination.flightDuration}</Text>
          </Animated.View>

          <Animated.View style={[{ marginTop: 14 }, metaAnimStyle]}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999,
              backgroundColor: 'rgba(0,0,0,0.3)', alignSelf: 'flex-start',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            }}>
              <Text style={{ fontSize: 14 }}>{isDeal ? '🔥' : '✈️'}</Text>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>From ${effectivePrice}</Text>
            </View>
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
    prev.isSaved === next.isSaved &&
    prev.index === next.index
  );
});
