// ─── Motion Primitives ──────────────────────────────────────────────────────
// Named spring/timing configs for consistent animation across the app.
// Import these instead of inline animation values.

import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';
import { Easing } from 'react-native-reanimated';

// ─── Spring Configs ─────────────────────────────────────────────────────────
export const springs = {
  /** Card swipe gesture — medium resistance, natural feel */
  cardSwipe: {
    damping: 12,
    stiffness: 80,
    mass: 1,
  } satisfies WithSpringConfig,

  /** Seat selection tap feedback — snappy and responsive */
  seatSelection: {
    damping: 8,
    stiffness: 100,
    mass: 0.7,
  } satisfies WithSpringConfig,

  /** Heart save burst — quick overshoot then settle */
  saveHeart: {
    damping: 6,
    stiffness: 120,
    mass: 0.5,
  } satisfies WithSpringConfig,

  /** Generic UI element spring — well-damped, no overshoot */
  uiElement: {
    damping: 15,
    stiffness: 100,
    mass: 0.8,
  } satisfies WithSpringConfig,
} as const;

// ─── Timing Configs ─────────────────────────────────────────────────────────
export const timings = {
  /** Price tag entrance — slide up with ease-out */
  priceEntrance: {
    duration: 400,
    easing: Easing.out(Easing.cubic),
  } satisfies WithTimingConfig,

  /** Page/screen transitions */
  pageTransition: {
    duration: 350,
    easing: Easing.inOut(Easing.cubic),
  } satisfies WithTimingConfig,

  /** Fade in/out for overlays and modals */
  fade: {
    duration: 200,
    easing: Easing.inOut(Easing.ease),
  } satisfies WithTimingConfig,

  /** Tooltip/toast appearance */
  toast: {
    duration: 250,
    easing: Easing.out(Easing.cubic),
  } satisfies WithTimingConfig,
} as const;

// ─── CSS Animation Durations (for web keyframes in global.css) ──────────────
export const cssDurations = {
  heartBurst: '0.3s',
  cityEnter: '0.5s',
  priceEnter: '0.4s',
  metaFade: '0.35s',
  bounce: '1.8s',
  shimmer: '2s',
  pulse: '2s',
  float: '3s',
  fadeIn: '0.6s',
  toastIn: '0.25s',
  searchOpen: '0.3s',
  trendingIn: '0.3s',
} as const;
