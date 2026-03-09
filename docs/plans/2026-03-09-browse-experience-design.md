# Browse Experience Upgrade — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the SoGoJet browse experience feel like a real travel app — stunning images on every card, search + filter to find destinations, and polished UX throughout.

**Architecture:** Three pillars shipped together: image quality overhaul (pipeline), search + filter (feed UI + API), and UX polish (skeletons, blur-up, empty states, optimistic saves).

**Tech Stack:** Vite + React (app-v2), Vercel Serverless Functions, Appwrite DB, Google Places API, Unsplash API.

---

## 1. Image Quality Overhaul

### Problem
Image refresh cron stores all Google Places photos without quality filtering. Some destinations have dark, indoor, portrait-oriented, or low-resolution images. Some have no images at all.

### Solution
Add a quality scoring pass to the image refresh pipeline:

**Reject criteria:**
- Images under 800px wide
- Portrait orientation (height > width)
- Known-bad patterns (indoor restaurant shots, Google Street View)

**Prefer criteria:**
- Landscape/aerial shots
- Minimum 1200px wide
- High color variance (not dark/night shots — check via simple brightness heuristic on image metadata)

**Fallback chain:**
Google Places → Unsplash → existing cached image (never show broken/empty)

**Storage:**
- Keep top 5 scored images per destination in `destination_images`
- Add `quality_score` (float) field to collection
- Highest-scored image becomes primary (used as hero in feed card)

**Batching:**
- Process 10 destinations per cron run (same pattern as price refresh) to fit 60s Vercel Hobby timeout
- Round-robin through destinations, stalest-first

---

## 2. Search + Filter System

### Filter Bar (always visible at top of feed)
- Horizontal scrollable chip row below the status bar
- Chips: price range, vibes, region
- Tapping a chip opens a dropdown/bottom sheet with options

**Price range chips:** Under $300 / $300–500 / $500–1000 / $1000+

**Vibe chips:** beach, city, nature, culture, adventure, romantic, foodie, luxury, budget (multi-select, these already exist as vibe_tags)

**Region chips:** Americas, Europe, Asia, Africa, Middle East, Oceania (multi-select)

- Active filters show as filled chips with "X" to clear
- "Clear all" button when any filter is active

### Search Overlay
- Search icon in top-right of feed
- Tapping opens a full-screen overlay with text input + autofocus
- Searches against city name, country, and tags
- Client-side filtering of already-loaded destinations + API call for full catalog
- Results as compact list (not swipe cards) — tap one to jump to detail page
- Recent searches stored in Zustand (persisted)

### How Filters Apply to the Feed
- Filters passed as query params to `/api/feed` (e.g., `?vibes=beach,culture&maxPrice=500&region=europe`)
- Server-side filtering before scoring — only matching destinations enter scoring pipeline
- Feed resets to page 1 when filters change
- Empty state: "No destinations match your filters" with suggestion to broaden

---

## 3. UX Polish

### Skeleton Loaders
- Feed cards: shimmer placeholder (image area + text lines + price pill) while loading
- Destination detail: skeleton for hero image, price card, content sections

### Image Loading
- Blur-up effect: show a low-res blurred version instantly, fade in full image (CSS blur + opacity transition)
- Lazy load images below the fold (only first 2 cards load images eagerly)

### Empty States
- Wishlist empty: "Start swiping to find your next adventure" with arrow to Explore
- Search no results: "No destinations found — try different filters"
- Feed error: Better error card with retry button

### Optimistic Saves
- Heart icon fills instantly on tap, syncs to server in background
- If save fails, revert with subtle toast "Couldn't save — try again"

---

## 4. Data Flow

```
Feed Screen
├── Filter Bar (chips) ──→ query params to /api/feed
├── Search Icon ──→ overlay, client-side + /api/feed?search=paris
└── Swipe Cards
    ├── Images ──→ destination_images (quality-scored, top 5)
    ├── Prices ──→ cached_prices (Duffel live)
    └── Save ──→ optimistic UI + POST /api/swipe

Image Refresh Cron (daily, batched 10/run)
├── Google Places API ──→ score & filter ──→ keep top 5
├── Unsplash fallback ──→ for destinations with <3 quality images
└── Store in destination_images with quality_score field

/api/feed changes:
├── New query params: vibes, maxPrice, minPrice, region, search
├── Server-side filtering before scoring
└── Returns filtered + scored results
```

**No new collections needed.** We add a `quality_score` field to `destination_images` and filter/sort params to the feed endpoint. Search is a text match on existing `destinations` fields (city, country, vibe_tags).

---

## Files Modified (Expected)

| File | Change |
|------|--------|
| `api/images/refresh.ts` | Quality scoring, batching, Unsplash fallback |
| `api/feed.ts` | Filter params, search, server-side filtering |
| `app-v2/src/screens/FeedScreen.tsx` | Filter bar, search overlay, skeletons |
| `app-v2/src/screens/DestinationDetailScreen.tsx` | Skeleton loaders |
| `app-v2/src/screens/WishlistScreen.tsx` | Empty state |
| `app-v2/src/stores/feedStore.ts` | Filter state, search history |
| `app-v2/src/components/` | New: FilterBar, SearchOverlay, SkeletonCard |
| `scripts/setup-image-quality-attr.ts` | Add quality_score to destination_images |
