# Departure Board + Segmented View Toggle — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Brief:** `/Users/jackson/Downloads/sogojet-native-dual-view-brief.md`

---

## Overview

Build the split-flap departure board view and a segmented control to toggle between the existing swipe feed and the new board view. The departure board is the app's differentiator — the mechanical animation with haptic clicks is what makes people screenshot and share it.

**Build approach:** Bottom-up. Primitives first (SplitFlapChar), compose upward (Row → DepartureRow → DepartureBoard), then wire into the feed screen via segmented control.

---

## 1. SplitFlapChar (`components/board/SplitFlapChar.tsx`)

A single character cell that cycles through random characters before settling on the target.

### Props

```typescript
interface SplitFlapCharProps {
  target: string;           // Single character to settle on (empty string = indefinite cycling)
  delay: number;            // ms before cycling starts
  duration?: number;        // Cycling phase duration (default 500ms)
  size: 'sm' | 'md';       // sm=13x22, md=17x28
  color: string;            // Text color
  animate: boolean;         // When true, triggers cycling animation
  isFirstInColumn?: boolean; // Controls haptic on settle
  onSettled?: () => void;   // Callback when animation completes
}
```

### Animation

- **Method:** Rapid text swap via `useSharedValue` + `runOnJS`. NOT 3D rotateX transforms.
- **Cycling:** Character changes every 50-70ms through random alphanumeric from pool `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`
- **Cycle count:** 6-10 random chars before landing on target
- **Indefinite mode:** When `target` is empty string and `animate` is true, cycle indefinitely at 70ms intervals. Display last random char (never blank). When target becomes non-empty, settle on it with normal timing.
- **Haptic:** `Haptics.impactAsync(Light)` on settle, only when `isFirstInColumn === true`
- **Trigger:** Animation starts when `animate` becomes true. Re-triggers when `target` changes while `animate` is true.

### Visual

- Background: `#1A1510`
- Border: `borderWidth: 0.5`, `borderColor: '#2A2218'`, `borderRadius: 2`
- Dimensions: `sm` = 13w x 22h, `md` = 17w x 28h
- Font: Bebas Neue, `sm` = 16px, `md` = 22px
- Text: centered both axes
- Flap split line: horizontal `View` at vertical center, height 0.5px, `bg: #0A0A0880`
- Gap between adjacent chars: 1.5px
- Space characters: same cell size, transparent background, no border

---

## 2. SplitFlapRow (`components/board/SplitFlapRow.tsx`)

A string rendered as a row of `SplitFlapChar` cells with staggered timing.

### Props

```typescript
interface SplitFlapRowProps {
  text: string;             // String to display
  maxLength: number;        // Pad to this length
  size: 'sm' | 'md';
  color: string;
  align: 'left' | 'right'; // Right-align: pad left. Left-align: pad right.
  staggerMs?: number;       // Delay between each char (default 25ms)
  startDelay?: number;      // Delay before first char starts (default 0)
  animate: boolean;         // When true, triggers cycling animation
  onComplete?: () => void;  // Fires when all chars have settled
}
```

### Behavior

- Right-align: pad with spaces on left (prices, times)
- Left-align: pad with spaces on right (destinations)
- Space chars: same cell size, transparent bg, no border
- Track settled count internally, fire `onComplete` when all done
- First non-space character in the row gets `isFirstInColumn=true` for haptic

---

## 3. DepartureRow (`components/board/DepartureRow.tsx`)

One deal rendered as 5 `SplitFlapRow` column segments.

### Props

```typescript
interface DepartureRowProps {
  deal: BoardDeal;
  isActive: boolean;
  animate: boolean;         // Trigger split-flap animation
  onAnimationComplete?: () => void;
}
```

Note: Tap handling lives in `DepartureBoard` (parent), which wraps each row in a `Pressable` with different behavior for row 0 vs rows 1-4.

### Column Specs

| Column      | maxLength | size | color       | align | startDelay |
|-------------|-----------|------|-------------|-------|------------|
| Time        | 5         | sm   | `#F7E8A0`   | right | 0ms        |
| Destination | 12        | md   | `#F7E8A0`   | left  | 80ms       |
| Flight      | 6         | sm   | `#FFFFFFB3` | left  | 160ms      |
| Price       | 5         | md   | `#7BAF8E`   | right | 240ms      |
| Status      | 4         | sm   | by status*  | left  | 320ms      |

*Status colors: `DEAL` = `#7BAF8E`, `HOT` = `#D4734A`, `NEW` = `#F7E8A0`

Note: The `BoardDeal` type in `types/deal.ts` has `status: 'DEAL' | 'HOT' | 'NEW'` — no `GONE` variant. If a `GONE` status is needed later (e.g., expired deals), add it to the union type at that time.

### Row Container

- `flexDirection: 'row'`, `alignItems: 'center'`
- Height: 52px, padding: `10px 16px`
- Background: `#0F0D0A`
- `borderBottomWidth: 0.5`, `borderBottomColor: '#1A1510'`
- Active: `borderLeftWidth: 3`, `borderLeftColor: '#F7E8A0'`, `opacity: 1`
- Inactive: `borderLeftWidth: 3`, `borderLeftColor: 'transparent'`, `opacity: 0.45`
- Gap between columns: 10px

---

## 4. DepartureBoard (`components/board/DepartureBoard.tsx`)

Full board assembly: 5 visible rows + detail strip + action buttons.

### Props

```typescript
interface DepartureBoardProps {
  deals: BoardDeal[];
  onTapDeal: (deal: BoardDeal) => void;
}
```

### Layout (top to bottom)

#### Board Area — 5 Visible Rows

- 5 `DepartureRow` components stacked vertically
- Row 0 = "active" (full opacity, left accent border)
- Rows 1-4 at 0.45 opacity, no accent border
- Tapping row 0 → calls `onTapDeal(deal)` which navigates to existing `app/destination/[id].tsx` via `router.push(`/destination/${deal.id}`)`
- Tapping rows 1-4 → makes that row active (updates `boardIndex` in `useDealStore`)
- Swipe up gesture on board area = same as "NEXT FLIGHT". Use `react-native-gesture-handler` `PanGestureHandler` wrapping the board area. Trigger on vertical swipe with `translationY < -50` and `velocityY < -200`. Taps pass through to individual row `Pressable` components.

#### Detail Strip

- Background: `#1A1510`
- Horizontal `ScrollView` of pill badges for the active deal
- Pill data: departure dates, flight duration, top 2-3 vibe tags
- Pill style: `bg: #0F0D0A`, `border: 1px solid #2A2218`, text `#C9A99A`, 11px Inter
- Height: ~40px with 8px vertical padding
- Content fades out/in (150ms) when active deal changes

#### Action Buttons

- Container: `bg: #0F0D0A`, padding `14px 16px`, 10px gap, `flexDirection: 'row'`

**"NEXT FLIGHT" button:**
- `bg: transparent`, `border: 1.5px solid #C9A99A`
- Text: Bebas Neue 16px, `#C9A99A`
- Shuffle icon left of text (16x16)
- `flex: 1`, height 50px, borderRadius 12px
- On press: triggers full animation sequence

**"BOOK IT" button:**
- `bg: #7BAF8E`
- Text: Bebas Neue 16px, `#0A0806`
- Airplane icon left of text
- `flex: 1`, height 50px, borderRadius 12px
- On press: `Linking.openURL(activeDeal.affiliateUrl)`

### "NEXT FLIGHT" Animation Sequence

1. `Haptics.impactAsync(Medium)` — one solid thunk
2. Increment `boardIndex` in dealStore
3. If within 3 of end, trigger `fetchMore()`
4. Row 0 chars cycle ~500ms with staggered column delays (0 → 80 → 160 → 240 → 320ms)
5. Rows 1-4 shift up (`withTiming`, 200ms), new row 4 slides in from below
6. Detail strip fades and updates
7. Haptic clicks: fire `Light` impact only for the first character settling in each column — 5 ticks across ~320ms

### Loading State

All 5 rows cycle indefinitely (empty string targets, `animate=true`) until data arrives. Each cell shows the last random character from its cycling pool — never blank. When data arrives, all rows settle with the normal staggered column timing (0 → 80 → 160 → 240 → 320ms).

### Fewer Than 5 Deals

If `deals.length < 5` after data loads, render actual deal rows for available deals and fill remaining slots with empty rows (all cells show `—` in `#2A2218` color, no animation, 0.25 opacity). This can happen with sparse API results or aggressive filtering in future.

### Empty State (No Deals)

If `deals.length === 0` after loading: show 5 empty rows (dashes) with a centered overlay message — airplane icon (48px, `#2A2218`), "No flights available" in Bebas Neue 20px `#C9A99A`, "Check back soon" in Inter 14px `#C9A99A80`.

---

## 5. SegmentedControl (`components/SegmentedControl.tsx`)

Pill toggle for switching between "Swipe" and "Board" views.

### Props

```typescript
interface SegmentedControlProps {
  value: 'swipe' | 'board';
  onChange: (value: 'swipe' | 'board') => void;
}
```

### Visual

- Container: `bg: #1A1510`, `borderRadius: 10`, `border: 1px solid #2A2218`, height 36px, horizontal margin 16px, marginVertical 8px
- Each segment: `flex: 1`, centered text
- Active segment: `bg: #F7E8A020`, `borderRadius: 8`, text `#F7E8A0`, Bebas Neue 14px
- Inactive segment: transparent bg, text `#C9A99A`, Bebas Neue 14px
- Active indicator slides between positions with Reanimated `withTiming` (150ms)
- On toggle: `Haptics.impactAsync(Light)`

### State

Reads/writes `settingsStore.preferredView`. Persists across sessions via AsyncStorage.

---

## 6. Feed Screen Update (`app/(tabs)/index.tsx`)

Wire segmented control and crossfade between SwipeFeed and DepartureBoard.

### Layout

```
<Header />           ← existing, no changes
<SegmentedControl /> ← NEW
{view content}       ← SwipeFeed or DepartureBoard based on preferredView
```

### Crossfade Transition

- Wrap content in `Animated.View` with opacity
- On switch: fade out current (150ms) → swap component → fade in new (150ms)
- Total transition: 300ms using Reanimated `withTiming`

### Shared Data

Both views consume the same `dealStore.deals` array and will share filter state when filters are added later. Each view maintains independent scroll/index state:
- SwipeFeed: own FlatList scroll offset
- DepartureBoard: own `boardIndex` in dealStore

---

## Explicitly Out of Scope

- **Filter chips** — added later, both views show all deals for now
- **Deal Peek bottom sheet** — existing `destination/[id].tsx` stays as-is
- **Pull-to-refresh** — not adding to either view yet
- **Real API integration** — board reads from same stub data as swipe feed
- **Sort chips on saved screen** — out of scope

---

## Dependencies

All required packages are already installed:
- `react-native-reanimated@~4.1.1` — animations
- `expo-haptics@~15.0.8` — haptic feedback
- `expo-linking` — affiliate URL opening
- Fonts: Bebas Neue, Inter already loaded in `app/_layout.tsx`
- Theme tokens: all colors defined in `theme/tokens.ts`
- Types: `BoardDeal` interface in `types/deal.ts`
- Stores: `useDealStore` (boardIndex + advanceBoard()) and `useSettingsStore` (preferredView) already exist
- `react-native-gesture-handler` — for swipe-up gesture on board area

## New Files

1. `components/board/SplitFlapChar.tsx`
2. `components/board/SplitFlapRow.tsx`
3. `components/board/DepartureRow.tsx`
4. `components/board/DepartureBoard.tsx`
5. `components/SegmentedControl.tsx`

## Modified Files

1. `app/(tabs)/index.tsx` — add SegmentedControl, conditional rendering, crossfade
