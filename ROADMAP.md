# SoGoJet Roadmap: From MVP to Full Product

## Current State

SoGoJet is a working travel discovery MVP with swipe-based browsing, ML-powered personalization, live pricing from 3 sources (Travelpayouts, Amadeus, LiteAPI), affiliate monetization, and cross-platform support (iOS, Android, web). 50 destinations, authentication, onboarding, and a sky-modern design system are complete.

---

## Phase 1: Production Hardening (Week 1-2)

### 1.1 Error Monitoring & Analytics
- Integrate Sentry for crash reporting (React error boundaries + API error capture)
- Add Mixpanel or PostHog for product analytics (page views, funnels, retention)
- Track affiliate click-through rates and conversion attribution
- Add Web Vitals reporting (LCP, FID, CLS)

### 1.2 Testing Infrastructure
- Set up Jest + React Native Testing Library
- Unit tests for scoring algorithms (`scoreFeed`, `cosineSimilarity`, `priceFitScore`)
- Component tests for SwipeCard, SavedCard, ItineraryTimeline
- API integration tests for `/api/feed`, `/api/swipe`, `/api/prices/refresh`
- E2E smoke tests with Detox (native) or Playwright (web)

### 1.3 Legal & Compliance
- Privacy policy page (`/legal/privacy`)
- Terms of service page (`/legal/terms`)
- Cookie consent banner (GDPR)
- Account deletion flow (GDPR right to erasure)
- Data export endpoint (GDPR right to portability)

### 1.4 Security Hardening
- Rate limiting on all API endpoints (Vercel Edge Middleware or Upstash)
- Input validation with Zod on all API handlers
- Add security headers (CSP, HSTS, X-Frame-Options) in `vercel.json`
- CSRF token for state-changing endpoints
- Audit Supabase RLS policies

### 1.5 DevOps
- ESLint + Prettier configuration
- Husky pre-commit hooks (lint + type-check)
- GitHub Actions CI pipeline (lint, type-check, test, build)
- Staging environment on Vercel (preview deployments)

---

## Phase 2: Search & Discovery (Week 3-4)

### 2.1 Search & Filters
- Search bar on Explore tab (city, country, vibe tag autocomplete)
- Filter panel: price range slider, vibe tags multi-select, region checkboxes, best-month filter
- Sort options: price low-high, rating, flight time, popularity
- "Surprise Me" random destination button
- Recent searches with localStorage persistence

### 2.2 Curated Collections
- Database table `collections` (id, title, subtitle, cover_image, destination_ids, sort_order)
- "Top 10 Budget Beaches", "Weekend City Breaks", "Adventure Escapes", "Romantic Getaways"
- Horizontal collection carousel on Saved tab or new Discover tab
- Admin-seeded initially, eventually user-created

### 2.3 Map View
- Toggle between swipe and map view on Explore tab
- react-native-maps (native) + Mapbox GL JS (web)
- Destination pins colored by vibe tag
- Tap pin to see mini-card, tap card to open detail
- Cluster pins at zoom levels

### 2.4 Destination Expansion
- Scale from 50 to 200+ destinations
- Add domestic US destinations (National Parks, lesser-known cities)
- Add Southeast Asia, Eastern Europe, South America depth
- Automate image sourcing via Unsplash API
- Store images on Cloudflare R2 or Supabase Storage (not Pexels hotlinks)

---

## Phase 3: Trip Planning & Booking (Week 5-7)

### 3.1 Trip Builder
- New "Trips" tab replacing or alongside Saved
- Create named trips with multiple destinations
- Drag-to-reorder destinations within a trip
- Date range picker per trip
- Estimated total budget (flights + hotels + activities)
- Share trip link with friends

### 3.2 Calendar Integration
- "Add to Calendar" button on destination detail
- Generate .ics files for trip dates
- Google Calendar API integration for synced trips
- Travel date suggestions based on best months + cheapest prices

### 3.3 Booking Deep Links
- Direct deep links to Aviasales with pre-filled dates and origin
- Kiwi.com / Skyscanner as alternative booking partners
- Hotel deep links to Booking.com with dates
- Activity deep links to GetYourGuide / Viator with dates
- Track which booking partner converts best

### 3.4 Price Alerts
- "Watch Price" button on destination detail
- Database table `price_alerts` (user_id, destination_id, target_price, is_active)
- Background cron checks prices daily, sends email when price drops
- Push notification support (Expo Notifications + OneSignal)
- Price history chart on destination detail (7-day, 30-day, 90-day)

---

## Phase 4: Social & Engagement (Week 8-10)

### 4.1 User Profiles
- Profile page with avatar, display name, travel stats
- "Countries visited" count, "Destinations saved" count
- Travel style badge (Beach Lover, City Explorer, Adventurer, etc.)
- Profile sharing with public URL

### 4.2 Social Features
- Share destination/trip to Instagram Stories, WhatsApp, iMessage
- "Invite Friends" referral flow with unique referral codes
- See friends' saved destinations (opt-in)
- "X friends saved this destination" social proof on cards

### 4.3 Reviews & Photos
- User reviews on destination detail (1-5 stars + text)
- User-submitted photos with moderation queue
- "Traveler Tips" section with top tips
- Upvote/downvote on tips

### 4.4 Push Notifications
- Expo Push Notifications setup
- Deal alerts: "Flights to Bali dropped 30%!"
- Weekly digest: "5 new destinations match your vibe"
- Saved destination updates: "Best time to visit Tokyo is next month"
- Smart frequency capping (max 3/week)

### 4.5 Email Marketing
- Resend or SendGrid integration
- Welcome email sequence (3 emails over 7 days)
- Weekly personalized deal digest
- Re-engagement emails for inactive users (14-day, 30-day)
- Transactional emails (account changes, price alerts)

---

## Phase 5: Performance & PWA (Week 11-12)

### 5.1 Image Pipeline
- Migrate destination images to Cloudflare R2 or Supabase Storage
- Cloudflare Image Resizing or imgproxy for on-the-fly transforms
- Serve WebP/AVIF with fallback
- Responsive srcset for different screen sizes
- BlurHash placeholders for all images (pre-computed, stored in DB)

### 5.2 Service Worker & Offline
- Workbox service worker with precaching
- Cache destination data for offline browsing of saved destinations
- Background sync for swipe actions when offline
- App shell caching for instant loads
- Custom offline fallback page

### 5.3 Performance Optimization
- Code splitting by route (already handled by Expo Router)
- Lazy load destination detail components
- Virtualized list for saved destinations (already using FlashList)
- Reduce JS bundle size (tree-shake unused Supabase features)
- Preconnect to API domains in HTML head
- Font subsetting if using custom fonts

### 5.4 Native App Polish
- EAS Build configuration for iOS and Android
- App Store screenshots and metadata
- Deep linking with Universal Links (iOS) and App Links (Android)
- Splash screen animation (expo-splash-screen)
- App icon and adaptive icon design

---

## Phase 6: Monetization & Growth (Week 13-16)

### 6.1 Enhanced Monetization
- A/B test booking partner CTAs (Aviasales vs Kiwi vs direct airline)
- "Featured Destinations" promoted placement (paid by tourism boards)
- Premium subscription tier: ad-free, exclusive deals, priority alerts
- In-app "Deal of the Day" banner with highest commission offers
- Conversion tracking pixel integration with Travelpayouts

### 6.2 SEO & Content
- Dynamic meta tags per destination (`<meta og:title>`, `<meta description>`)
- Sitemap.xml generation from destination catalog
- Structured data (JSON-LD) for destinations (TouristDestination schema)
- `/destinations/[city]` public pages (SSR or ISR via Vercel)
- Blog/travel guide pages for top destinations (SEO content)

### 6.3 Internationalization
- i18n framework (react-i18next or expo-localization)
- Translate UI to Spanish, French, German, Portuguese, Japanese
- Currency auto-detection from user locale
- Right-to-left (RTL) layout support for Arabic
- Localized destination descriptions

### 6.4 Growth Loops
- Referral program: "Give $5, Get $5" (credit toward premium)
- Social sharing with branded preview cards (og:image)
- "Embed on your site" widget for travel bloggers
- Partnerships with travel influencers (affiliate sub-tracking)
- App Store Optimization (ASO) for native app listings

---

## Phase 7: Intelligence & Personalization (Week 17-20)

### 7.1 Advanced Recommendation Engine
- Collaborative filtering: "Users who saved Bali also saved..."
- Temporal patterns: recommend winter destinations in fall, beach in spring
- Price sensitivity modeling per user
- "Because you saved X" explanation cards in feed
- Explore/exploit balance tuning per user engagement level

### 7.2 Smart Pricing
- Historical price trend analysis (is this a good deal?)
- "Price Score" indicator (1-10, compared to historical average)
- Cheapest departure date suggestions
- Multi-city trip price optimization
- Fare calendar view (cheapest day to fly per month)

### 7.3 AI Features
- AI trip itinerary generator (Claude API): "Plan my 5 days in Tokyo"
- Natural language search: "Show me cheap beach destinations in December"
- AI travel assistant chatbot for trip planning questions
- Auto-generate destination descriptions from structured data
- Smart photo selection (best image per destination based on engagement)

### 7.4 Behavioral Analytics
- Cohort analysis dashboard (Supabase + Metabase or custom)
- Funnel: Browse > Save > Click Booking > Convert
- Retention curves by acquisition channel
- Feature usage heatmaps
- Revenue attribution per destination, partner, and user segment

---

## Phase 8: Scale & Reliability (Week 21-24)

### 8.1 Infrastructure
- Upgrade Vercel to Pro for 10s function timeout and more crons
- Database connection pooling (Supabase already handles via PgBouncer)
- Redis cache layer (Upstash) for hot paths (feed scoring, price lookups)
- CDN edge caching for API responses (Vercel Edge Config)
- Database read replicas for analytics queries

### 8.2 Observability
- Structured logging (JSON logs with request IDs)
- Distributed tracing (OpenTelemetry)
- Uptime monitoring (Better Uptime or Checkly)
- Database query performance monitoring
- Alerting: PagerDuty or Opsgenie for P0/P1 incidents

### 8.3 Data Pipeline
- Nightly ETL for swipe_history → analytics tables
- Price history table for trend analysis
- User segments table (computed daily)
- Export pipeline to data warehouse (BigQuery or Snowflake)
- Dashboard for business metrics (Metabase or Preset)

### 8.4 Accessibility
- Full WCAG 2.1 AA audit
- Screen reader support for all interactive elements
- Keyboard navigation for entire app
- Color contrast validation
- Focus management for modals and sheets
- Reduced motion support

---

## Technical Architecture Target

```
                    ┌──────────────────────┐
                    │    Cloudflare CDN     │
                    │  (Images, Static)     │
                    └──────────┬───────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                       │
    ┌────┴────┐          ┌─────┴─────┐          ┌─────┴─────┐
    │  Vercel  │          │  Vercel   │          │   Expo    │
    │   Web    │          │   API     │          │  Native   │
    │  (SSG)   │          │ (Edge+Fn) │          │  (EAS)    │
    └────┬────┘          └─────┬─────┘          └─────┬─────┘
         │                     │                       │
         └─────────────────────┼───────────────────────┘
                               │
                    ┌──────────┴───────────┐
                    │      Supabase        │
                    │  (Postgres + Auth    │
                    │   + Realtime + RLS)  │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        ┌─────┴─────┐  ┌──────┴──────┐  ┌──────┴──────┐
        │Travelpayouts│  │   LiteAPI   │  │   Amadeus   │
        │  (Flights)  │  │  (Hotels)   │  │ (Fallback)  │
        └─────────────┘  └─────────────┘  └─────────────┘
```

---

## Success Metrics

| Metric | Current | Phase 2 | Phase 4 | Phase 8 |
|--------|---------|---------|---------|---------|
| Destinations | 50 | 200+ | 500+ | 1000+ |
| DAU | - | 100 | 1,000 | 10,000 |
| Save rate | - | 15% | 20% | 25% |
| Booking CTR | - | 5% | 8% | 12% |
| Avg session | - | 3 min | 5 min | 7 min |
| Revenue/user | - | $0.10 | $0.50 | $2.00 |
| Lighthouse score | ~70 | 85 | 90 | 95+ |
| Test coverage | 0% | 40% | 70% | 85% |

---

## Immediate Next Steps

1. Run Supabase migration for new destination columns (itinerary, restaurants, flight_days)
2. Run `npm run seed` to push enriched destination data
3. Deploy to Vercel: `vercel --prod`
4. Set up Sentry error monitoring
5. Add privacy policy and terms of service pages
6. Implement search bar on Explore tab
7. Add hotel price refresh cron job
8. Set up ESLint + Prettier + CI pipeline
