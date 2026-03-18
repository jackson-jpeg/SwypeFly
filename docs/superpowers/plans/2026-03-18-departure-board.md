# Departure Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the split-flap departure board view with mechanical animation and a segmented control to toggle between the existing swipe feed and the new board view.

**Architecture:** Bottom-up component build. Animation primitives first (SplitFlapChar → SplitFlapRow → DepartureRow), then compose into DepartureBoard, add SegmentedControl, and wire into the feed screen. All components are pure React Native with Reanimated 4 for animations and expo-haptics for tactile feedback.

**Tech Stack:** React Native, react-native-reanimated 4.x, react-native-gesture-handler, expo-haptics, Zustand, expo-router

**Spec:** `docs/superpowers/specs/2026-03-18-departure-board-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/board/SplitFlapChar.tsx` | Create | Single animated character cell — cycling + settle |
| `components/board/SplitFlapRow.tsx` | Create | String as row of staggered SplitFlapChar cells |
| `components/board/DepartureRow.tsx` | Create | One deal = 5 column segments (time, dest, flight, price, status) |
| `components/board/DepartureBoard.tsx` | Create | Full board: 5 rows + detail strip + action buttons + animation sequence |
| `components/SegmentedControl.tsx` | Create | "Swipe \| Board" pill toggle with animated indicator |
| `app/(tabs)/index.tsx` | Modify | Add SegmentedControl, conditional view rendering, crossfade |
| `__tests__/board/splitFlapLogic.test.ts` | Create | Pure logic tests for character cycling, padding, status colors |

---

### Task 1: SplitFlapChar — Animated Character Cell

**Files:**
- Create: `components/board/SplitFlapChar.tsx`

This is the atomic unit. A single cell that cycles through random characters before settling on the target.

- [ ] **Step 1: Create the board directory**

```bash
mkdir -p components/board
```

- [ ] **Step 2: Build SplitFlapChar component**

Create `components/board/SplitFlapChar.tsx` with:

```typescript
import { useEffect, useRef, useState, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme/tokens';
import { lightHaptic } from '../../utils/haptics';

const CHAR_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CYCLE_INTERVAL = 60; // ms between random chars
const DEFAULT_DURATION = 500; // total cycling time

interface SplitFlapCharProps {
  target: string;
  delay: number;
  duration?: number;
  size: 'sm' | 'md';
  color: string;
  animate: boolean;
  isFirstInColumn?: boolean;
  onSettled?: () => void;
}

const SIZES = {
  sm: { width: 13, height: 22, fontSize: 16 },
  md: { width: 17, height: 28, fontSize: 22 },
} as const;

function SplitFlapChar({
  target,
  delay,
  duration = DEFAULT_DURATION,
  size,
  color,
  animate,
  isFirstInColumn = false,
  onSettled,
}: SplitFlapCharProps) {
  const [displayChar, setDisplayChar] = useState(target || ' ');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpace = target === ' ' || target === '';

  useEffect(() => {
    // Clean up previous animation
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);

    if (!animate || isSpace) {
      setDisplayChar(target || ' ');
      return;
    }

    // Start cycling after delay
    timeoutRef.current = setTimeout(() => {
      // Cycle through random characters
      intervalRef.current = setInterval(() => {
        setDisplayChar(CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)]);
      }, CYCLE_INTERVAL);

      // Settle on target after duration (or cycle indefinitely if no target)
      if (target) {
        settleTimeoutRef.current = setTimeout(() => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setDisplayChar(target);
          if (isFirstInColumn) lightHaptic();
          onSettled?.();
        }, duration);
      }
    }, delay);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
  }, [target, animate, delay, duration, isFirstInColumn, onSettled, isSpace]);

  const dims = SIZES[size];

  if (isSpace) {
    return <View style={[styles.cell, { width: dims.width, height: dims.height, backgroundColor: 'transparent', borderWidth: 0 }]} />;
  }

  return (
    <View style={[styles.cell, { width: dims.width, height: dims.height }]}>
      <Text style={[styles.text, { fontSize: dims.fontSize, color }]}>
        {displayChar}
      </Text>
      {/* Flap split line */}
      <View style={styles.splitLine} />
    </View>
  );
}

export default memo(SplitFlapChar);

const styles = StyleSheet.create({
  cell: {
    backgroundColor: colors.cell,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  text: {
    fontFamily: fonts.display,
    textAlign: 'center',
  },
  splitLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: '#0A0A0880',
  },
});
```

- [ ] **Step 3: Verify it renders**

Run: `npm run start` and temporarily import SplitFlapChar in the feed screen with a hardcoded target to visually confirm the cell renders correctly. Remove after verification.

- [ ] **Step 4: Commit**

```bash
git add components/board/SplitFlapChar.tsx
git commit -m "feat(board): add SplitFlapChar — animated character cell with cycling + settle"
```

---

### Task 2: SplitFlapRow — String as Staggered Cells

**Files:**
- Create: `components/board/SplitFlapRow.tsx`

Renders a string as a row of SplitFlapChar cells with staggered delays.

- [ ] **Step 1: Build SplitFlapRow component**

Create `components/board/SplitFlapRow.tsx`:

```typescript
import { useCallback, useRef, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import SplitFlapChar from './SplitFlapChar';

interface SplitFlapRowProps {
  text: string;
  maxLength: number;
  size: 'sm' | 'md';
  color: string;
  align: 'left' | 'right';
  staggerMs?: number;
  startDelay?: number;
  animate: boolean;
  onComplete?: () => void;
}

function SplitFlapRow({
  text,
  maxLength,
  size,
  color,
  align,
  staggerMs = 25,
  startDelay = 0,
  animate,
  onComplete,
}: SplitFlapRowProps) {
  const settledCount = useRef(0);
  const totalNonSpace = useRef(0);

  // Pad text to maxLength
  const truncated = text.slice(0, maxLength).toUpperCase();
  const padded =
    align === 'right'
      ? truncated.padStart(maxLength, ' ')
      : truncated.padEnd(maxLength, ' ');

  const chars = padded.split('');

  // Count non-space chars for completion tracking
  totalNonSpace.current = chars.filter((c) => c !== ' ').length;
  settledCount.current = 0;

  const handleSettled = useCallback(() => {
    settledCount.current += 1;
    if (settledCount.current >= totalNonSpace.current) {
      onComplete?.();
    }
  }, [onComplete]);

  // Find index of first non-space char (for haptic)
  const firstNonSpaceIdx = chars.findIndex((c) => c !== ' ');

  return (
    <View style={styles.row}>
      {chars.map((char, i) => (
        <SplitFlapChar
          key={`${i}-${char}`}
          target={char}
          delay={startDelay + i * staggerMs}
          size={size}
          color={color}
          animate={animate}
          isFirstInColumn={i === firstNonSpaceIdx}
          onSettled={char !== ' ' ? handleSettled : undefined}
        />
      ))}
    </View>
  );
}

export default memo(SplitFlapRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 1.5,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/board/SplitFlapRow.tsx
git commit -m "feat(board): add SplitFlapRow — staggered character row with completion tracking"
```

---

### Task 3: DepartureRow — 5-Column Deal Row

**Files:**
- Create: `components/board/DepartureRow.tsx`
- Create: `__tests__/board/splitFlapLogic.test.ts`

One deal rendered as 5 SplitFlapRow column segments with the spec's column layout.

- [ ] **Step 1: Write logic tests for status colors and text formatting**

Create `__tests__/board/splitFlapLogic.test.ts`:

```typescript
// Pure logic tests — no React rendering needed

describe('DepartureRow helpers', () => {
  const STATUS_COLORS: Record<string, string> = {
    DEAL: '#7BAF8E',
    HOT: '#D4734A',
    NEW: '#F7E8A0',
  };

  it('maps each status to the correct color', () => {
    expect(STATUS_COLORS['DEAL']).toBe('#7BAF8E');
    expect(STATUS_COLORS['HOT']).toBe('#D4734A');
    expect(STATUS_COLORS['NEW']).toBe('#F7E8A0');
  });

  it('formats price as $-prefixed string for board display', () => {
    const formatBoardPrice = (price: number): string => {
      return `$${price}`;
    };
    expect(formatBoardPrice(387)).toBe('$387');
    expect(formatBoardPrice(1234)).toBe('$1234');
  });

  it('truncates destination to 12 chars uppercase', () => {
    const formatDest = (name: string): string =>
      name.toUpperCase().slice(0, 12);
    expect(formatDest('Santorini')).toBe('SANTORINI');
    expect(formatDest('Rio de Janeiro')).toBe('RIO DE JANEI');
  });

  it('pads right-aligned text with leading spaces', () => {
    const padRight = (text: string, max: number): string =>
      text.padStart(max, ' ');
    expect(padRight('$387', 5)).toBe(' $387');
    expect(padRight('14:25', 5)).toBe('14:25');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest __tests__/board/splitFlapLogic.test.ts -v`
Expected: 4 tests PASS

- [ ] **Step 3: Build DepartureRow component**

Create `components/board/DepartureRow.tsx`:

```typescript
import { memo, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import SplitFlapRow from './SplitFlapRow';
import { colors } from '../../theme/tokens';
import type { BoardDeal } from '../../types/deal';

const STATUS_COLORS: Record<BoardDeal['status'], string> = {
  DEAL: colors.green,
  HOT: colors.orange,
  NEW: colors.yellow,
};

interface DepartureRowProps {
  deal: BoardDeal;
  isActive: boolean;
  animate: boolean;
  onAnimationComplete?: () => void;
}

function DepartureRow({ deal, isActive, animate, onAnimationComplete }: DepartureRowProps) {
  const completedCols = useRef(0);

  const handleColumnComplete = useCallback(() => {
    completedCols.current += 1;
    if (completedCols.current >= 5) {
      completedCols.current = 0;
      onAnimationComplete?.();
    }
  }, [onAnimationComplete]);

  // Reset counter when animation starts (in useEffect, not render phase)
  useEffect(() => {
    if (animate) completedCols.current = 0;
  }, [animate]);

  return (
    <View
      style={[
        styles.row,
        isActive ? styles.active : styles.inactive,
      ]}
    >
      {/* Time — e.g. "14:25" */}
      <SplitFlapRow
        text={deal.departureTime}
        maxLength={5}
        size="sm"
        color={colors.yellow}
        align="right"
        startDelay={0}
        animate={animate}
        onComplete={handleColumnComplete}
      />

      {/* Destination — e.g. "SANTORINI" */}
      <SplitFlapRow
        text={deal.destination}
        maxLength={12}
        size="md"
        color={colors.yellow}
        align="left"
        startDelay={80}
        animate={animate}
        onComplete={handleColumnComplete}
      />

      {/* Flight — e.g. "DL847" */}
      <SplitFlapRow
        text={deal.flightCode}
        maxLength={6}
        size="sm"
        color={colors.whiteDim}
        align="left"
        startDelay={160}
        animate={animate}
        onComplete={handleColumnComplete}
      />

      {/* Price — e.g. "$387" */}
      <SplitFlapRow
        text={deal.priceFormatted}
        maxLength={5}
        size="md"
        color={colors.green}
        align="right"
        startDelay={240}
        animate={animate}
        onComplete={handleColumnComplete}
      />

      {/* Status — e.g. "DEAL" */}
      <SplitFlapRow
        text={deal.status}
        maxLength={4}
        size="sm"
        color={STATUS_COLORS[deal.status]}
        align="left"
        startDelay={320}
        animate={animate}
        onComplete={handleColumnComplete}
      />
    </View>
  );
}

export default memo(DepartureRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1510',
    gap: 10,
    borderLeftWidth: 3,
  },
  active: {
    borderLeftColor: colors.yellow,
    opacity: 1,
  },
  inactive: {
    borderLeftColor: 'transparent',
    opacity: 0.45,
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add components/board/DepartureRow.tsx __tests__/board/splitFlapLogic.test.ts
git commit -m "feat(board): add DepartureRow — 5-column deal row with staggered animation"
```

---

### Task 4: DepartureBoard — Full Board Assembly

**Files:**
- Create: `components/board/DepartureBoard.tsx`

The complete board view: 5 visible rows, detail strip, action buttons, NEXT FLIGHT animation, swipe-up gesture.

- [ ] **Step 1: Build DepartureBoard component**

Create `components/board/DepartureBoard.tsx`:

```typescript
import { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import Ionicons from '@expo/vector-icons/Ionicons';
import DepartureRow from './DepartureRow';
import SplitFlapRow from './SplitFlapRow';
import { colors, fonts, spacing } from '../../theme/tokens';
import { useDealStore } from '../../stores/dealStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { mediumHaptic, lightHaptic } from '../../utils/haptics';
import type { BoardDeal } from '../../types/deal';

interface DepartureBoardProps {
  deals: BoardDeal[];
  onTapDeal: (deal: BoardDeal) => void;
  isLoading?: boolean;
}

export default function DepartureBoard({ deals, onTapDeal, isLoading = false }: DepartureBoardProps) {
  const boardIndex = useDealStore((s) => s.boardIndex);
  const advanceBoard = useDealStore((s) => s.advanceBoard);
  const jumpToBoard = useDealStore((s) => s.jumpToBoard);
  const fetchMore = useDealStore((s) => s.fetchMore);
  const departureCode = useSettingsStore((s) => s.departureCode);
  const router = useRouter();

  const [animatingRow, setAnimatingRow] = useState<number | null>(null);
  const detailOpacity = useSharedValue(1);

  // Get 5 visible deals starting from boardIndex
  const visibleDeals = deals.slice(boardIndex, boardIndex + 5);

  // Active deal is always index 0 of visible
  const activeDeal = visibleDeals[0];

  const handleNextFlight = useCallback(() => {
    if (boardIndex >= deals.length - 1) return;

    // 1. Haptic thunk
    mediumHaptic();

    // 2. Advance the board index
    advanceBoard();

    // 3. Prefetch if near end
    if (boardIndex >= deals.length - 4) {
      fetchMore(departureCode);
    }

    // 4. Trigger row 0 animation
    setAnimatingRow(0);

    // 5. Fade detail strip
    detailOpacity.value = withTiming(0, { duration: 75 }, () => {
      detailOpacity.value = withTiming(1, { duration: 75 });
    });
  }, [boardIndex, deals.length, advanceBoard, fetchMore, departureCode, detailOpacity]);

  const handleRowPress = useCallback(
    (localIndex: number) => {
      if (localIndex === 0 && activeDeal) {
        // Tap row 0 → navigate to detail
        onTapDeal(activeDeal);
      } else {
        // Tap other rows → make it active
        lightHaptic();
        jumpToBoard(boardIndex + localIndex);
        setAnimatingRow(0);

        // Fade detail strip
        detailOpacity.value = withTiming(0, { duration: 75 }, () => {
          detailOpacity.value = withTiming(1, { duration: 75 });
        });
      }
    },
    [activeDeal, boardIndex, jumpToBoard, onTapDeal, detailOpacity],
  );

  const swipeUpGesture = Gesture.Pan()
    .onEnd((event) => {
      if (event.translationY < -50 && event.velocityY < -200) {
        runOnJS(handleNextFlight)();
      }
    });

  const handleBookIt = useCallback(() => {
    if (!activeDeal?.affiliateUrl) return;
    lightHaptic();
    if (Platform.OS === 'web') {
      window.open(activeDeal.affiliateUrl, '_blank', 'noopener');
    } else {
      Linking.openURL(activeDeal.affiliateUrl);
    }
  }, [activeDeal]);

  const handleAnimationComplete = useCallback(() => {
    setAnimatingRow(null);
  }, []);

  const detailAnimStyle = useAnimatedStyle(() => ({
    opacity: detailOpacity.value,
  }));

  // Loading state — 5 rows cycling indefinitely
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.boardArea}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={`loading-${i}`} style={[styles.loadingRow, i === 0 ? styles.active : styles.loadingInactive]}>
              <SplitFlapRow text="" maxLength={5} size="sm" color={colors.yellow} align="right" animate startDelay={0} />
              <SplitFlapRow text="" maxLength={12} size="md" color={colors.yellow} align="left" animate startDelay={80} />
              <SplitFlapRow text="" maxLength={6} size="sm" color={colors.whiteDim} align="left" animate startDelay={160} />
              <SplitFlapRow text="" maxLength={5} size="md" color={colors.green} align="right" animate startDelay={240} />
              <SplitFlapRow text="" maxLength={4} size="sm" color={colors.green} align="left" animate startDelay={320} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Empty state
  if (deals.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        {/* 5 placeholder rows with dashes */}
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.emptyRow, { opacity: 0.25 }]}>
            <Text style={styles.emptyRowText}>{'—'.repeat(30)}</Text>
          </View>
        ))}
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyIcon}>✈</Text>
          <Text style={styles.emptyTitle}>No flights available</Text>
          <Text style={styles.emptySubtitle}>Check back soon</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Board area with swipe gesture */}
      <GestureDetector gesture={swipeUpGesture}>
        <Animated.View style={styles.boardArea}>
          {visibleDeals.map((deal, localIndex) => (
            <Pressable
              key={deal.id}
              onPress={() => handleRowPress(localIndex)}
            >
              <DepartureRow
                deal={deal}
                isActive={localIndex === 0}
                animate={animatingRow === localIndex}
                onAnimationComplete={
                  localIndex === 0 ? handleAnimationComplete : undefined
                }
              />
            </Pressable>
          ))}

          {/* Fill empty slots if fewer than 5 deals visible */}
          {visibleDeals.length < 5 &&
            Array.from({ length: 5 - visibleDeals.length }).map((_, i) => (
              <View
                key={`empty-${i}`}
                style={[styles.emptyRow, { opacity: 0.25 }]}
              >
                <Text style={styles.emptyRowText}>{'—'.repeat(30)}</Text>
              </View>
            ))}
        </Animated.View>
      </GestureDetector>

      {/* Detail strip */}
      {activeDeal && (
        <Animated.View style={[styles.detailStrip, detailAnimStyle]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.detailContent}
          >
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>
                {activeDeal.departureDate} — {activeDeal.returnDate}
              </Text>
            </View>
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>
                {activeDeal.flightDuration}
              </Text>
            </View>
            {activeDeal.vibeTags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.detailPill}>
                <Text style={styles.detailPillText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Action buttons */}
      <View style={styles.actionContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.nextButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleNextFlight}
        >
          <Ionicons name="shuffle" size={16} color={colors.muted} />
          <Text style={styles.nextButtonText}>NEXT FLIGHT</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.bookButton,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleBookIt}
        >
          <Ionicons name="airplane" size={16} color={colors.bg} />
          <Text style={styles.bookButtonText}>BOOK IT</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  boardArea: {
    flex: 1,
  },

  // Detail strip
  detailStrip: {
    backgroundColor: colors.cell,
    paddingVertical: spacing.sm,
  },
  detailContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  detailPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detailPillText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
  },

  // Action buttons
  actionContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: 10,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.muted,
    backgroundColor: 'transparent',
  },
  nextButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.muted,
  },
  bookButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.green,
  },
  bookButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.bg,
  },

  // Loading state
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1510',
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  loadingInactive: {
    opacity: 0.45,
  },

  // Empty states
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  emptyRow: {
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1510',
  },
  emptyRowText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.border,
    letterSpacing: 2,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.muted,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.faint,
    marginTop: 4,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/board/DepartureBoard.tsx
git commit -m "feat(board): add DepartureBoard — full assembly with rows, detail strip, actions, gestures"
```

---

### Task 5: SegmentedControl — View Toggle

**Files:**
- Create: `components/SegmentedControl.tsx`

Pill toggle for switching between "Swipe" and "Board" views with animated sliding indicator.

- [ ] **Step 1: Build SegmentedControl component**

Create `components/SegmentedControl.tsx`:

```typescript
import { memo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts, spacing } from '../theme/tokens';
import { lightHaptic } from '../utils/haptics';

interface SegmentedControlProps {
  value: 'swipe' | 'board';
  onChange: (value: 'swipe' | 'board') => void;
}

const INDICATOR_PADDING = 2;

function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorX = useSharedValue(value === 'swipe' ? 0 : 1);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const handlePress = (newValue: 'swipe' | 'board') => {
    if (newValue === value) return;
    lightHaptic();
    indicatorX.value = withTiming(newValue === 'swipe' ? 0 : 1, {
      duration: 150,
    });
    onChange(newValue);
  };

  const segmentWidth = containerWidth > 0 ? (containerWidth - INDICATOR_PADDING * 2) / 2 : 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value * segmentWidth }],
    width: segmentWidth,
  }));

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* Sliding indicator */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />

      {/* Segments */}
      <Pressable style={styles.segment} onPress={() => handlePress('swipe')}>
        <Text
          style={[
            styles.segmentText,
            value === 'swipe' && styles.activeText,
          ]}
        >
          Swipe
        </Text>
      </Pressable>

      <Pressable style={styles.segment} onPress={() => handlePress('board')}>
        <Text
          style={[
            styles.segmentText,
            value === 'board' && styles.activeText,
          ]}
        >
          Board
        </Text>
      </Pressable>
    </View>
  );
}

export default memo(SegmentedControl);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 36,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: colors.cell,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: INDICATOR_PADDING,
    left: INDICATOR_PADDING,
    height: 36 - INDICATOR_PADDING * 2 - 2, // Account for border
    backgroundColor: colors.highlight,
    borderRadius: 8,
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.muted,
    letterSpacing: 1,
  },
  activeText: {
    color: colors.yellow,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/SegmentedControl.tsx
git commit -m "feat: add SegmentedControl — animated pill toggle for Swipe/Board views"
```

---

### Task 6: Wire Feed Screen — Segmented Control + Crossfade

**Files:**
- Modify: `app/(tabs)/index.tsx`

Add SegmentedControl below header, conditionally render SwipeFeed or DepartureBoard with crossfade.

- [ ] **Step 1: Update feed screen**

Replace the contents of `app/(tabs)/index.tsx` with:

```typescript
import { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDealStore } from '../../stores/dealStore';
import { useSettingsStore } from '../../stores/settingsStore';
import SwipeFeed from '../../components/swipe/SwipeFeed';
import DepartureBoard from '../../components/board/DepartureBoard';
import SegmentedControl from '../../components/SegmentedControl';
import SkeletonCard from '../../components/swipe/SkeletonCard';
import { colors, fonts } from '../../theme/tokens';
import type { BoardDeal } from '../../types/deal';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { deals, isLoading, error, fetchDeals } = useDealStore();
  const departureCode = useSettingsStore((s) => s.departureCode);
  const preferredView = useSettingsStore((s) => s.preferredView);
  const setPreferredView = useSettingsStore((s) => s.setPreferredView);
  const router = useRouter();

  // Crossfade animation
  const contentOpacity = useSharedValue(1);

  useEffect(() => {
    fetchDeals(departureCode);
  }, [departureCode, fetchDeals]);

  const handleViewChange = useCallback(
    (view: 'swipe' | 'board') => {
      // Fade out → switch view on JS thread → fade in
      contentOpacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(setPreferredView)(view);
        contentOpacity.value = withTiming(1, { duration: 150 });
      });
    },
    [contentOpacity, setPreferredView],
  );

  const handleTapDeal = useCallback(
    (deal: BoardDeal) => {
      router.push(`/destination/${deal.id}`);
    },
    [router],
  );

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    flex: 1,
  }));

  return (
    <View style={styles.container}>
      {/* Floating header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.logo}>✈ SOGOJET</Text>
        <View style={styles.airportBadge}>
          <Text style={styles.airportText}>{departureCode}</Text>
        </View>
      </View>

      {/* Spacer for header */}
      <View style={{ height: insets.top + 52 }} />

      {/* Segmented control */}
      <SegmentedControl value={preferredView} onChange={handleViewChange} />

      {/* Content area with crossfade */}
      <Animated.View style={contentAnimStyle}>
        {isLoading ? (
          preferredView === 'board' ? (
            <DepartureBoard deals={[]} onTapDeal={handleTapDeal} isLoading />
          ) : (
            <SkeletonCard />
          )
        ) : deals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🌎</Text>
            <Text style={styles.emptyTitle}>No deals found</Text>
            <Text style={styles.emptySubtitle}>
              {error
                ? 'Check your connection and try again'
                : 'Try a different departure city'}
            </Text>
          </View>
        ) : preferredView === 'swipe' ? (
          <SwipeFeed />
        ) : (
          <DepartureBoard deals={deals} onTapDeal={handleTapDeal} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.bg,
    ...Platform.select({
      web: { pointerEvents: 'box-none' as const },
      default: {},
    }),
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  airportBadge: {
    backgroundColor: 'rgba(10,8,6,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.green + '60',
  },
  airportText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.green,
    letterSpacing: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.muted,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.faint,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
```

Key changes from original:
- Added `SegmentedControl` between header and content
- Header now has `backgroundColor: colors.bg` (solid, not transparent) since the board view doesn't have full-bleed photos behind it
- Added spacer `View` for header height since header is absolute
- Content area wrapped in `Animated.View` for crossfade using `runOnJS` (not `setTimeout`)
- Conditional rendering: `SwipeFeed` or `DepartureBoard` based on `preferredView`
- Board-specific loading state: passes `isLoading` to DepartureBoard which shows cycling rows
- `handleTapDeal` navigates to `destination/[id]` for board row taps

- [ ] **Step 2: Run the app and verify**

Run: `npm run start`

Verify:
1. Feed loads with swipe view (default)
2. Segmented control shows "Swipe" active with yellow text
3. Tapping "Board" switches to departure board view
4. Board shows 5 deal rows with split-flap character cells
5. "NEXT FLIGHT" button advances the board with animation
6. "BOOK IT" opens affiliate URL
7. Tapping row 0 navigates to destination detail
8. Tapping rows 1-4 makes them the active row
9. Switching back to "Swipe" shows the photo card feed
10. Crossfade transition is visible between views
11. View preference persists after restarting the app

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `npm run test`
Expected: All 161 existing tests pass. The new `splitFlapLogic.test.ts` also passes.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: wire SegmentedControl + DepartureBoard into feed screen with crossfade"
```

---

### Task 7: Final Verification + Push

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass (161 existing + new splitFlapLogic tests).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No TypeScript errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors (warnings are OK).

- [ ] **Step 4: Manual verification on device/simulator**

Test checklist:
- [ ] Swipe feed works as before (no regression)
- [ ] Segmented control toggles between Swipe and Board
- [ ] Board rows show split-flap character cells with correct fonts/colors
- [ ] NEXT FLIGHT animates row 0 characters through random pool then settles
- [ ] Haptic feedback: medium thunk on NEXT FLIGHT, light click on character settle
- [ ] BOOK IT opens affiliate link
- [ ] Tap row 0 → navigates to destination detail
- [ ] Tap rows 1-4 → makes that row active with detail strip update
- [ ] Detail strip shows dates, duration, vibe tags for active deal
- [ ] Empty state renders correctly when no deals
- [ ] View preference persists across app restarts
- [ ] Crossfade animation visible when switching views

- [ ] **Step 5: Push to main**

```bash
git push origin main
```
