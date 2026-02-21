# CLAUDE.md

This file provides guidance for AI assistants working on the SoGoJet (SwypeFly) codebase.

## Project Overview

SoGoJet is a travel deal discovery app with a TikTok-style swipe interface. Users swipe through destination cards showing live flight and hotel prices, save favorites, and get AI-generated trip plans. The app runs as a cross-platform Expo (React Native) app targeting **web** (primary, deployed on Vercel), **iOS**, and **Android**.

**Package name:** `sogojet` | **App name:** `SoGoJet` | **Repo:** `SwypeFly`

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 + React Native 0.81 + React 19 |
| Routing | expo-router v6 (file-based) |
| Styling | NativeWind v4 (TailwindCSS) + design tokens in `constants/theme.ts` |
| State | Zustand v5 (persisted stores) |
| Server state | TanStack React Query v5 |
| Backend/API | Vercel Serverless Functions (Node.js, `@vercel/node`) |
| Database | Appwrite (Database + Auth + Permissions) |
| AI | Gemini 2.5 Flash (destination guides, live updates, nearby gems) + Claude Sonnet 4.5 (trip plans) |
| Pricing data | Travelpayouts API (primary) + Amadeus API (fallback) + LiteAPI (hotels) |
| Images | Unsplash API |
| Validation | Zod v4 |
| Error monitoring | Sentry |
| Testing | Jest 30 + ts-jest |
| Linting | ESLint 9 (flat config) + Prettier |
| Language | TypeScript 5.9 (strict mode) |

## Quick Commands

```bash
npm run start          # Start Expo dev server
npm run web            # Start web dev server
npm run ios            # Start iOS simulator
npm run android        # Start Android emulator
npm run test           # Run Jest tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage
npm run lint           # Run ESLint
npm run typecheck      # Run tsc --noEmit
npm run format         # Run Prettier (write)
npm run format:check   # Run Prettier (check)
npm run seed           # Seed destinations to Appwrite (tsx scripts/seed-destinations.ts)
```

## Project Structure

```
SwypeFly/
├── app/                    # Expo Router pages (file-based routing)
│   ├── _layout.tsx         # Root layout: providers, auth guard, global styles
│   ├── +not-found.tsx      # 404 page
│   ├── (tabs)/             # Tab navigator group
│   │   ├── _layout.tsx     # Tab bar config (Explore, Saved, Settings)
│   │   ├── index.tsx       # Explore tab (swipe feed)
│   │   ├── saved.tsx       # Saved destinations grid
│   │   └── settings.tsx    # User settings
│   ├── auth/
│   │   ├── login.tsx       # Login screen (Google, Apple, Email, Guest)
│   │   └── onboarding.tsx  # Post-signup onboarding flow
│   ├── destination/
│   │   └── [id].tsx        # Destination detail page (modal)
│   └── legal/
│       ├── privacy.tsx     # Privacy policy
│       └── terms.tsx       # Terms of service
├── api/                    # Vercel Serverless Functions (backend)
│   ├── feed.ts             # GET /api/feed — paginated, scored destination feed
│   ├── destination.ts      # GET /api/destination — single destination with live prices
│   ├── swipe.ts            # POST /api/swipe — record swipe + update preference vectors
│   ├── ai/
│   │   ├── _gemini.ts      # Shared Gemini client, Appwrite cache helpers
│   │   ├── destination-guide.ts  # GET — AI itinerary + restaurant recommendations
│   │   ├── live-updates.ts       # GET — real-time travel tips
│   │   ├── nearby-gems.ts        # GET — hidden gem suggestions
│   │   ├── price-check.ts        # GET — price analysis
│   │   └── trip-plan.ts          # POST — personalized trip plan (Claude)
│   ├── prices/
│   │   ├── refresh.ts      # Cron: refresh flight prices (Travelpayouts + Amadeus)
│   │   └── refresh-hotels.ts  # Cron: refresh hotel prices (LiteAPI)
│   └── images/
│       └── refresh.ts      # Cron: refresh Unsplash images
├── components/
│   ├── common/             # Reusable UI: Badge, Button, ContentCard, EmptyState, etc.
│   ├── destination/        # Destination detail page components
│   ├── saved/              # SavedCard, SavedGrid
│   ├── swipe/              # SwipeCard, SwipeFeed, CardActions, FeedFilterBar, etc.
│   └── ErrorBoundary.tsx
├── constants/
│   ├── theme.ts            # Design tokens (colors, spacing, radii, fontSize, shadows, etc.)
│   ├── colors.ts           # Color constants
│   ├── layout.ts           # Layout constants
│   └── styles.ts           # Shared style objects
├── hooks/
│   ├── AuthContext.tsx      # React Context wrapper for auth
│   ├── useAuth.ts          # Auth hook (Appwrite: Google, Apple, Email, Guest)
│   ├── useAI.ts            # AI endpoint hooks
│   ├── useSaveDestination.ts  # Save/unsave with Appwrite sync
│   └── useSwipeFeed.ts     # Feed infinite query + swipe recording + destination query
├── services/
│   ├── appwrite.ts         # Appwrite client SDK (Account, Databases)
│   ├── appwriteServer.ts   # Appwrite server SDK (node-appwrite with API key)
│   ├── apiHelpers.ts       # API_BASE URL + auth header helpers (Appwrite JWT)
│   ├── queryClient.ts      # Shared TanStack Query client
│   ├── travelpayouts.ts    # Travelpayouts API client
│   ├── liteapi.ts          # LiteAPI hotel pricing client
│   └── unsplash.ts         # Unsplash image search client
├── stores/
│   ├── feedStore.ts        # Feed state: index, viewed IDs, vibe filter, sort preset
│   ├── savedStore.ts       # Saved destination IDs (persisted)
│   ├── uiStore.ts          # UI prefs: departure city, haptics, theme, guest mode (persisted)
│   └── toastStore.ts       # Toast notification queue
├── types/
│   ├── destination.ts      # Destination, DestinationFeedPage, VibeTag types
│   └── user.ts             # UserPreferences type
├── utils/
│   ├── validation.ts       # Zod schemas for all API endpoints
│   ├── scoreFeed.ts        # Client-side diversity-aware feed scoring
│   ├── affiliateLinks.ts   # Affiliate URL generators
│   ├── airlines.ts         # IATA airline code → name mapping
│   ├── apiLogger.ts        # Server-side API error logging
│   ├── formatDate.ts       # Date formatting helpers
│   ├── formatPrice.ts      # Price formatting
│   ├── haptics.ts          # Haptic feedback (native)
│   ├── sentry.ts           # Sentry error reporting
│   ├── share.ts            # Native/web share helpers
│   ├── storage.ts          # Cross-platform Zustand storage adapter
│   └── webVitals.ts        # Web Vitals performance tracking
├── scripts/                # Data seeding scripts (run with tsx)
├── scripts/               # Data seeding scripts (legacy Supabase refs)
├── __tests__/              # Jest test files
├── data/                   # Static destination seed data
└── public/                 # Static web assets (manifest, icons)
```

## Architecture Patterns

### Frontend ↔ Backend Split

- **Frontend** (app/, components/, hooks/, stores/): React Native + Expo Router. Communicates with backend via `fetch` using `API_BASE` from `services/apiHelpers.ts`.
- **Backend** (api/): Vercel Serverless Functions. Each file exports a `handler(req, res)` function. Uses Appwrite server SDK (`node-appwrite`) with API key for DB access.
- Both share `utils/validation.ts` (Zod schemas) and `types/`.

### Data Flow

1. **Feed**: Client calls `GET /api/feed` → server fetches destinations from Appwrite, merges with cached prices/images, applies scoring (personalized for auth'd users, generic + diversity for guests), returns paginated results.
2. **Swipe tracking**: Client calls `POST /api/swipe` → server records in `swipe_history` + updates user preference vectors via gradient-based learning.
3. **Price refresh**: Daily Vercel cron → `GET /api/prices/refresh` → fetches from Travelpayouts (bulk) → Amadeus (fallback) → upserts into `cached_prices`.
4. **AI content**: Lazy-loaded on destination detail pages via AI endpoints. Results cached in `ai_cache` collection with TTL.

### Feed Scoring Algorithm

The feed uses a two-tier scoring system:
- **Generic** (anonymous users): Weighted scoring on price, rating, with diversity penalties for consecutive same-region/same-vibe destinations.
- **Personalized** (auth'd users): Cosine similarity between user preference vector and destination feature vector, with price fit, seasonality, popularity, freshness, and exploration randomness. Post-scored with diversity reranking and soft shuffle.

### State Management

- **Zustand stores** are the source of truth for client state. `feedStore`, `savedStore`, and `uiStore` are persisted via cross-platform storage adapter (`utils/storage.ts`).
- **TanStack React Query** manages server state (feed pages, destination details). The `queryClient` is shared via `services/queryClient.ts`.

### Authentication

- Appwrite Account API with Google OAuth, Apple OAuth, and Email/Password providers.
- Guest mode allows browsing without auth.
- Auth guard in `app/_layout.tsx` redirects based on session state and onboarding completion.
- JWTs created via `account.createJWT()` are sent as Bearer tokens to API endpoints.
- Server-side endpoints verify JWTs by creating a client with `setJWT()` and calling `account.get()`.

## Database (Appwrite)

**Project:** `sogojet` (Database ID: `sogojet`)
**Endpoint:** `https://nyc.cloud.appwrite.io/v1`

### Collections

| Collection | Purpose |
|---|---|
| `destinations` | All travel destinations with metadata, vibe tags, feature vectors |
| `cached_prices` | Flight prices per origin-destination pair (refreshed via cron) |
| `cached_hotel_prices` | Hotel prices per destination (refreshed via cron) |
| `destination_images` | Unsplash images per destination (refreshed via cron) |
| `user_preferences` | User settings, departure city, preference vectors, onboarding status |
| `swipe_history` | Swipe action log (viewed/skipped/saved) per user |
| `saved_trips` | User's saved destinations |
| `ai_cache` | Cached AI-generated content with TTL |

### Permissions

User-specific collections use document-level permissions (set at creation time with `Permission.read/delete(Role.user(userId))`). Server-side operations use the API key for full access.

### SDK Usage

- **Client-side:** `services/appwrite.ts` — uses `appwrite` SDK (Client, Account, Databases)
- **Server-side:** `services/appwriteServer.ts` — uses `node-appwrite` SDK with API key
- Auth: Appwrite Account API (Google OAuth, Apple OAuth, Email/Password)
- JWTs: Created via `account.createJWT()` for API auth headers

## Environment Variables

Required variables (see `.env.example`):

| Variable | Used By | Purpose |
|---|---|---|
| `EXPO_PUBLIC_APPWRITE_ENDPOINT` | Client + Server | Appwrite API endpoint |
| `EXPO_PUBLIC_APPWRITE_PROJECT_ID` | Client + Server | Appwrite project ID |
| `APPWRITE_ENDPOINT` | Server only | Appwrite API endpoint (server override) |
| `APPWRITE_PROJECT_ID` | Server only | Appwrite project ID (server override) |
| `APPWRITE_API_KEY` | Server only | Appwrite API key (server-side DB access) |
| `TRAVELPAYOUTS_API_TOKEN` | Server | Flight price data |
| `AMADEUS_API_KEY` / `AMADEUS_API_SECRET` | Server | Flight price fallback |
| `LITEAPI_API_KEY` | Server | Hotel pricing |
| `GOOGLE_GEMINI_API_KEY` | Server | AI content generation |
| `ANTHROPIC_API_KEY` | Server | Trip plan generation (Claude) |
| `UNSPLASH_ACCESS_KEY` | Server | Destination photos |
| `CRON_SECRET` | Server | Cron job authentication |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | Error monitoring |

**Important:** Variables prefixed with `EXPO_PUBLIC_` are exposed to the client bundle. Never put secrets (like `APPWRITE_API_KEY`) in `EXPO_PUBLIC_` variables.

## Coding Conventions

### TypeScript

- Strict mode enabled. All code is TypeScript.
- Path alias: `@/*` maps to project root (e.g., `@/types/destination`).
- Use `type` imports for type-only imports: `import type { Destination } from '...'`.
- Unused variables prefixed with `_` are allowed (ESLint config).

### Styling

- **Design tokens** are the single source of truth for visual constants. Always import from `constants/theme.ts` — never hardcode colors, spacing, or font sizes.
- Uses `Platform.OS === 'web'` checks for web-specific rendering (e.g., HTML `<div>` with CSS vs React Native `<View>`).
- NativeWind (TailwindCSS) is configured but inline styles using design tokens are the predominant pattern.

### Components

- Functional components only, using hooks.
- Components are organized by feature domain: `swipe/`, `destination/`, `saved/`, `common/`.
- Platform-specific rendering is handled inline with `Platform.OS` checks, not separate files.

### API Endpoints

- All endpoints use Vercel Serverless Function pattern: `export default async function handler(req, res)`.
- Input validation using Zod schemas from `utils/validation.ts` with the `validateRequest()` helper.
- Error logging via `logApiError()` from `utils/apiLogger.ts`.
- Protected endpoints verify `Authorization: Bearer <token>` header via Appwrite JWT verification.
- Cron endpoints verify `CRON_SECRET`.

### Database Naming

- Database uses **snake_case** column names (e.g., `flight_price`, `vibe_tags`).
- Frontend uses **camelCase** (e.g., `flightPrice`, `vibeTags`).
- The `toFrontend()` function in `api/feed.ts` handles the transformation.

### Testing

- Tests live in `__tests__/` directory.
- Jest with ts-jest preset, running in Node environment.
- Test files follow the pattern `*.test.ts`.
- Test helpers use factory functions (e.g., `makeDest()`) for creating test fixtures.

### Formatting

- Prettier: single quotes, trailing commas, 100 char print width, 2-space indent, semicolons.
- ESLint: TypeScript recommended rules + Prettier integration.

## Vercel Deployment

- **Build command:** `npx expo export --platform web`
- **Output directory:** `dist/`
- **Cron jobs:** Prices refresh daily at 6 AM UTC, hotel prices at 6 PM UTC, images at noon UTC.
- **Security headers:** X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- **SPA routing:** All non-API routes rewrite to `index.html`.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push and PR:
1. `npm ci` (install)
2. `npm run typecheck` (TypeScript)
3. `npm run lint` (ESLint)
4. `npm run test` (Jest)
5. `npx expo export --platform web` (build)

## Common Tasks

### Adding a new API endpoint

1. Create handler file in `api/` (e.g., `api/my-endpoint.ts`).
2. Add Zod schema in `utils/validation.ts`.
3. Use `validateRequest()` for input validation.
4. Use `logApiError()` for error handling.
5. If auth required, verify Bearer token via Appwrite JWT.

### Adding a new destination detail component

1. Create component in `components/destination/`.
2. Import design tokens from `constants/theme.ts`.
3. Handle both web and native rendering via `Platform.OS` checks.
4. Add to the destination detail page (`app/destination/[id].tsx`).

### Adding a new Zustand store

1. Create store in `stores/`.
2. Use `create<StateType>()` pattern.
3. If persisted, use `persist()` middleware with `createPersistStorage()` from `utils/storage.ts`.
4. Use Zustand's `partialize` option to control what gets persisted.

### Running database migrations

1. Create collections/attributes via Appwrite Console or using the `node-appwrite` SDK.
2. Add indexes for query patterns (e.g., unique constraints, sort keys).
3. Set document-level permissions as needed for user-specific data.

## Key Dependencies & Patterns to Know

- **expo-router**: File-based routing. Route groups use `(parentheses)`. Dynamic routes use `[brackets]`.
- **react-native-gesture-handler**: Required for swipe gestures. Root must be wrapped in `GestureHandlerRootView`.
- **react-native-reanimated**: Used for animations. Babel plugin required (`react-native-reanimated/plugin` must be last).
- **expo-image**: Used instead of React Native's `Image` for better caching and BlurHash support.
- **@shopify/flash-list**: Used for performant lists (saved grid).
