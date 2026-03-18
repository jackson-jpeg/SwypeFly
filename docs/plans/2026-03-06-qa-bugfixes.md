# QA Bugfix Round 2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 9 bugs found during deep QA stress-test of sogojet.com

**Architecture:** All fixes are independent, mostly frontend (app-v2/src/) with one backend fix (api/feed.ts). No new dependencies needed. Each fix is surgical — smallest possible change.

**Tech Stack:** React (Vite SPA in app-v2/), Vercel Serverless Functions (api/), TypeScript

---

### Task 1: Fix feed duplicate destinations

**Problem:** `excludeIds` parameter is parsed in api/feed.ts but never used to filter destinations. Same destinations appear multiple times across pagination pages.

**Files:**
- Modify: `api/feed.ts:424-439`

**Step 1: Add excludeIds filtering after the other filters**

In `api/feed.ts`, after the `maxPrice` filter block (line 439) and before `let scored`, add:

```typescript
    if (excludeIds) {
      const excludeSet = new Set(excludeIds.split(',').map((s) => s.trim()).filter(Boolean));
      destinations = destinations.filter((d) => !excludeSet.has(d.$id));
    }
```

Note: destinations at this point use the DB field `$id` (Appwrite document ID). Check that `toFrontend()` maps `$id` to `id`. The `excludeIds` from the client sends frontend `id` values which equal `$id`.

**Step 2: Run tests**

Run: `cd /Users/jackson/SwypeFly && npm test -- --testPathPattern=feed`
Expected: All existing feed tests pass.

**Step 3: Commit**

```bash
git add api/feed.ts
git commit -m "fix: filter excludeIds in feed to prevent duplicate destinations"
```

---

### Task 2: Fix price label mismatch (detail page always says "Live price")

**Problem:** Feed cards correctly show "EST." or "LIVE PRICE" based on `priceSource`, but DestinationDetailScreen.tsx hardcodes "Live price" at line 438.

**Files:**
- Modify: `app-v2/src/screens/DestinationDetailScreen.tsx:420-440`

**Step 1: Replace the hardcoded "Live price" label**

Find the "Live price" text (around line 438) and replace the entire label block:

Change:
```tsx
                Live price
```

To a conditional that checks `stubDest.priceSource`:
```tsx
                {stubDest.priceSource === 'travelpayouts' || stubDest.priceSource === 'amadeus' || stubDest.priceSource === 'duffel' ? 'Live price' : 'Estimated'}
```

Also update the green dot color to be muted for estimates:
- Change `backgroundColor: colors.seafoamMist` → conditional: `backgroundColor: stubDest.priceSource === 'estimate' ? colors.borderTint : colors.seafoamMist`
- Change `color: colors.darkerGreen` → conditional: `color: stubDest.priceSource === 'estimate' ? colors.borderTint : colors.darkerGreen`

**Step 2: Commit**

```bash
git add app-v2/src/screens/DestinationDetailScreen.tsx
git commit -m "fix: show correct price source label on detail page (EST vs Live)"
```

---

### Task 3: Fix past flight dates showing on detail page

**Problem:** Atlanta shows "2026-02-27 – 2026-03-01" which is in the past. Dates come from cached Travelpayouts data. The display code in `getDefaultDetail()` doesn't filter stale dates.

**Files:**
- Modify: `app-v2/src/screens/DestinationDetailScreen.tsx:36-38`

**Step 1: Filter out past dates in getDefaultDetail**

Replace lines 36-38:

```tsx
    flightDates: dest.departureDate && dest.returnDate
      ? `${dest.departureDate} – ${dest.returnDate} · Economy`
      : 'Flexible dates · Economy',
```

With:

```tsx
    flightDates: (() => {
      if (dest.departureDate && dest.returnDate) {
        const dep = new Date(dest.departureDate);
        if (dep >= new Date(new Date().toISOString().split('T')[0])) {
          return `${dest.departureDate} – ${dest.returnDate} · Economy`;
        }
      }
      return 'Flexible dates · Economy';
    })(),
```

This checks if the departure date is today or in the future. If past, falls back to "Flexible dates".

**Step 2: Commit**

```bash
git add app-v2/src/screens/DestinationDetailScreen.tsx
git commit -m "fix: hide past flight dates, show 'Flexible dates' fallback"
```

---

### Task 4: Fix city name truncation on feed cards

**Problem:** "TEGUCIGALPA" gets clipped to "TEGUCIGA" on mobile. The text area has `right: 80` to avoid action buttons, but long uppercase names at `clamp(32px, 9vw, 48px)` font size overflow.

**Files:**
- Modify: `app-v2/src/screens/FeedScreen.tsx:114` and `FeedScreen.tsx:121`

**Step 1: Reduce font size and increase text area**

Find the destination info container (line 114), change `right: 80` to `right: 72`:

```tsx
        style={{ position: 'absolute', bottom: 140, left: 20, right: 72, ...
```

Find the city name font size (line 121), change from `clamp(32px, 9vw, 48px)` to `clamp(26px, 8vw, 44px)`:

```tsx
            fontSize: 'clamp(26px, 8vw, 44px)',
```

**Step 2: Commit**

```bash
git add app-v2/src/screens/FeedScreen.tsx
git commit -m "fix: reduce feed card font size to prevent long city name truncation"
```

---

### Task 5: Improve desktop layout — widen content area

**Problem:** Desktop shows a 430px phone-width column with 40%+ wasted beige space. Sidebar says "Best experienced on mobile" which is dismissive.

**Files:**
- Modify: `app-v2/src/tokens/global.css:115` — change max-width from `430px` to `520px`
- Modify: `app-v2/src/components/DesktopShell.tsx:78` — change "sogojet.com · Best experienced on mobile" to "sogojet.com"

**Step 1: Widen content column**

In `global.css`, change:
```css
    max-width: 430px;
```
To:
```css
    max-width: 520px;
```

**Step 2: Remove dismissive text**

In `DesktopShell.tsx`, change:
```tsx
              sogojet.com · Best experienced on mobile
```
To:
```tsx
              sogojet.com
```

**Step 3: Commit**

```bash
git add app-v2/src/tokens/global.css app-v2/src/components/DesktopShell.tsx
git commit -m "fix: widen desktop content column to 520px, remove dismissive mobile text"
```

---

### Task 6: Improve Similar Destinations quality

**Problem:** San Juan (Puerto Rico, culture/beach) shows Marrakech, Kyoto, Chiang Mai because the fallback filter matches ANY destination with same first vibe tag "culture" — too broad.

**Files:**
- Modify: `app-v2/src/screens/DestinationDetailScreen.tsx:22-28`

**Step 1: Improve the fallback similarity matching**

Replace lines 22-28 with overlap-scored matching:

```tsx
  const similarDests = (dest.similarDestinations ?? []).length > 0
    ? dest.similarDestinations!.map((d) => ({ id: d.id, city: d.city, price: d.flightPrice, image: d.imageUrl }))
    : (() => {
        const candidates = STUB_DESTINATIONS
          .filter((d) => d.id !== dest.id)
          .map((d) => {
            const sharedVibes = d.vibeTags.filter((t) => dest.vibeTags.includes(t)).length;
            const sameRegion = d.country === dest.country ? 2 : 0;
            return { d, score: sharedVibes + sameRegion };
          })
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        return candidates.map((c) => ({ id: c.d.id, city: c.d.city, price: c.d.flightPrice, image: c.d.imageUrl }));
      })();
```

**Step 2: Commit**

```bash
git add app-v2/src/screens/DestinationDetailScreen.tsx
git commit -m "fix: improve similar destinations matching with vibe overlap scoring"
```

---

### Task 7: Show all vibe tags in detail page subtitle

**Problem:** Detail subtitle shows only 1 vibe tag (e.g., "nature") while feed shows 2 (e.g., "nature · culture").

**Files:**
- Modify: `app-v2/src/screens/DestinationDetailScreen.tsx:32` (getDefaultDetail)
- Modify: `app-v2/src/screens/DestinationDetailScreen.tsx:358` (subtitle render)

**Step 1: Change vibe from single string to array**

Line 32, change:
```tsx
    vibe: dest.vibeTags[0] ?? 'Adventure',
```
To:
```tsx
    vibes: dest.vibeTags.length > 0 ? dest.vibeTags : ['Adventure'],
```

**Step 2: Update subtitle rendering**

Line 358, change:
```tsx
            {dest.country}{dest.region !== dest.country ? ` \u00B7 ${dest.region}` : ''} &middot; {dest.vibe}
```
To:
```tsx
            {dest.country}{dest.region !== dest.country ? ` \u00B7 ${dest.region}` : ''} &middot; {dest.vibes.join(' \u00B7 ')}
```

Also grep for any other `dest.vibe` references and update to `dest.vibes[0]` or `dest.vibes.join(...)`.

**Step 3: Commit**

```bash
git add app-v2/src/screens/DestinationDetailScreen.tsx
git commit -m "fix: show all vibe tags in detail page subtitle"
```

---

### Task 8: Remove non-functional Haptic Feedback toggle from web

**Problem:** "Haptic Feedback" toggle does nothing on web browsers.

**Files:**
- Modify: `app-v2/src/screens/SettingsScreen.tsx:230-233`

**Step 1: Remove the Haptic Feedback row**

Delete the entire block at lines 230-233:

```tsx
            <div style={rowStyle}>
              <span style={rowTitleStyle}>Haptic Feedback</span>
              <Toggle on={hapticsEnabled} onToggle={toggleHaptics} />
            </div>
```

Also remove the `hapticsEnabled` and `toggleHaptics` destructuring from the `useUIStore` call if they become unused. Check the imports and remove dead code.

**Step 2: Commit**

```bash
git add app-v2/src/screens/SettingsScreen.tsx
git commit -m "fix: remove non-functional Haptic Feedback toggle from web settings"
```

---

### Task 9: Remove fabricated strikethrough prices

**Problem:** Line 147 fabricates a strikethrough at 1.4x when no real `previousPrice` exists. This is misleading.

**Files:**
- Modify: `app-v2/src/screens/DestinationDetailScreen.tsx:147`

**Step 1: Remove fake strikethrough**

Change:
```tsx
    flightStrikethrough: detail.flightStrikethrough ?? Math.round(stubDest.flightPrice * 1.4),
```
To:
```tsx
    flightStrikethrough: detail.flightStrikethrough ?? 0,
```

The existing conditional at line 456 will correctly hide the strikethrough when it's 0.

**Step 2: Commit**

```bash
git add app-v2/src/screens/DestinationDetailScreen.tsx
git commit -m "fix: don't fabricate strikethrough prices when no real previous price exists"
```

---

### Final: Push all changes to main

```bash
git push origin main
```

Verify at https://sogojet.com after Vercel deploy completes (~2 min).
