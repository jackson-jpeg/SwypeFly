# SoGoJet v5 — Production Readiness

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix every critical bug, data flow gap, and missing validation identified by a full-app audit so the booking flow, auth, feed, and backend all work end-to-end without surprises.

**Architecture:** Three batches — (A) Booking flow correctness, (B) Auth + API hardening, (C) Backend robustness + tests. Each batch is independently shippable.

**Tech Stack:** React 19, React Router, Zustand, Clerk auth, Stripe Elements, Duffel API, Vercel Serverless, Appwrite, TanStack React Query

---

## Batch A — Booking Flow Correctness

These are the issues that would cause a real user's booking to fail or produce wrong data.

---

### Task 1: Multi-passenger form loop

**Problem:** PassengerDetailsScreen only collects Passenger 1 (`id: 'pax-1'`). If `passengerCount > 1`, remaining passengers have no data, and Duffel order creation will fail.

**Files:**
- Modify: `app-v2/src/screens/PassengerDetailsScreen.tsx`
- Modify: `app-v2/src/stores/bookingStore.ts` (minor — clear passengers on count change)

**Steps:**

1. In `PassengerDetailsScreen.tsx`, add state `const [currentPaxIdx, setCurrentPaxIdx] = useState(0)` and derive `totalPax` from `bookingStore.passengerCount`.

2. When the "Continue" button is pressed and `currentPaxIdx < totalPax - 1`:
   - Save current passenger with `id: 'pax-${currentPaxIdx + 1}'`
   - Increment `currentPaxIdx`
   - Reset form fields (or pre-fill from `passengers[nextIdx]` if editing)
   - Stay on same screen

3. When `currentPaxIdx === totalPax - 1`:
   - Save final passenger
   - Navigate to `/booking/seats`

4. Update the header subtitle: `"Passenger ${currentPaxIdx + 1} of ${totalPax}"` after the step label.

5. Add a "Back" handler: if `currentPaxIdx > 0`, go to previous passenger (pre-fill from store). If `currentPaxIdx === 0`, navigate(-1) as before.

6. Pre-fill form from stored passenger if user navigates back into the screen (check `passengers[currentPaxIdx]` on mount).

7. In `bookingStore.ts`, update `setPassengerCount` to clear passengers array when count changes:
   ```ts
   setPassengerCount: (count) => set({ passengerCount: count, passengers: [] }),
   ```

8. **Verify:** `cd app-v2 && npx tsc --noEmit` — 0 errors.

9. **Commit:** `feat: multi-passenger form — collect details for all travelers`

---

### Task 2: Send passenger count to flight search API

**Problem:** `FlightSelectionScreen.tsx:30` hardcodes `passengers: [{ type: 'adult' as const }]` regardless of `passengerCount`.

**Files:**
- Modify: `app-v2/src/screens/FlightSelectionScreen.tsx:24-33`

**Steps:**

1. Replace the hardcoded passengers array in `searchParams` memo:
   ```ts
   passengers: Array.from({ length: passengers }, () => ({ type: 'adult' as const })),
   ```
   (Note: `passengers` is already defined on line 21 as `passengerCount`)

2. Add `passengers` to the `useMemo` dependency array (line 33).

3. **Verify:** `npx tsc --noEmit` — 0 errors.

4. **Commit:** `fix: send actual passenger count in flight search request`

---

### Task 3: Add seat price to booking total

**Problem:** `bookingStore.getTotal()` doesn't include seat upgrade cost. User selects a $25 exit row seat, pays $0 for it.

**Files:**
- Modify: `app-v2/src/stores/bookingStore.ts` — add `seatPrice` field + update `getTotal()`
- Modify: `app-v2/src/screens/SeatSelectionScreen.tsx` — store seat price alongside designator
- Modify: `app-v2/src/screens/ReviewPaymentScreen.tsx` — show seat price in line items

**Steps:**

1. In `bookingStore.ts`, add to interface and initial state:
   ```ts
   seatPrice: number;  // in BookingState interface
   seatPrice: 0,       // in INITIAL
   ```

2. Update `setSeat` action to also accept price:
   ```ts
   setSeat: (designator: string | null, price?: number) => set({ selectedSeat: designator, seatPrice: price ?? 0 }),
   ```

3. In `getTotal()`, add seat price after baggage block:
   ```ts
   // Seat upgrade
   perPerson += s.seatPrice;
   ```

4. Add `seatPrice` to the `partialize` list (line 127).

5. In `SeatSelectionScreen.tsx`, update the Continue button handler (line 341):
   ```ts
   const price = selectedSeat ? getSeatPrice(parseInt(selectedSeat.split('-')[0]!), selectedSeat.split('-')[1]!) : 0;
   storeSeat(selectedSeat ? selectedSeat.replace('-', '') : null, price);
   ```
   Also update the Skip button (line 364): `storeSeat(null, 0);`

6. In `ReviewPaymentScreen.tsx`, update the seat line item (line 152):
   ```ts
   { label: `Seat ${booking.selectedSeat ?? 'None'}`, price: booking.seatPrice > 0 ? `+$${booking.seatPrice}` : booking.selectedSeat ? 'Free' : '—', color: booking.seatPrice > 0 ? colors.bodyText : booking.selectedSeat ? colors.confirmGreen : colors.bodyText },
   ```

7. **Verify:** `npx tsc --noEmit` — 0 errors.

8. **Commit:** `fix: include seat upgrade price in booking total`

---

### Task 4: Guard booking routes from guests

**Problem:** `needsAuth = !session && !isGuest` means guests can reach payment screens. Stripe requires auth.

**Files:**
- Modify: `app-v2/src/App.tsx:58-63`

**Steps:**

1. Create a `needsRealAuth` check for booking routes:
   ```ts
   const needsRealAuth = !session; // guests can't book — must sign in
   ```

2. Change booking routes (lines 58-63) from `needsAuth` to `needsRealAuth`:
   ```tsx
   <Route path="/booking/flights" element={needsRealAuth ? <Navigate to="/login" state={{ returnTo: '/booking/flights' }} /> : <FlightSelectionScreen />} />
   <Route path="/booking/passengers" element={needsRealAuth ? <Navigate to="/login" state={{ returnTo: '/booking/passengers' }} /> : <PassengerDetailsScreen />} />
   <Route path="/booking/seats" element={needsRealAuth ? <Navigate to="/login" state={{ returnTo: '/booking/seats' }} /> : <SeatSelectionScreen />} />
   <Route path="/booking/extras" element={needsRealAuth ? <Navigate to="/login" state={{ returnTo: '/booking/extras' }} /> : <BagsExtrasScreen />} />
   <Route path="/booking/review" element={needsRealAuth ? <Navigate to="/login" state={{ returnTo: '/booking/review' }} /> : <ReviewPaymentScreen />} />
   <Route path="/booking/confirmation" element={needsRealAuth ? <Navigate to="/login" state={{ returnTo: '/booking/confirmation' }} /> : <ConfirmationScreen />} />
   ```

3. Keep feed, destination detail, wishlist, and settings accessible to guests (use `needsAuth` as before).

4. **Verify:** `npx tsc --noEmit` — 0 errors.

5. **Commit:** `fix: require real auth for booking flow — guests redirected to login`

---

### Task 5: Fix create-order response format + send seat to backend

**Problem:** (a) Live backend returns `{ bookingId, duffelOrderId, status, bookingReference }` but frontend expects `CreateOrderResponse` with `passengers[]`, `slices[]`, `totalPaid`. (b) Selected seat is never sent in the create-order payload.

**Files:**
- Modify: `api/booking.ts` — `handleCreateOrder()` to return full `CreateOrderResponse`
- Modify: `app-v2/src/screens/ReviewPaymentScreen.tsx` — add seat to `selectedServices`

**Steps:**

1. In `api/booking.ts`, find `handleCreateOrder` (live path). After `orders.create()`, build the full response:
   ```ts
   const orderRes = {
     orderId: order.id,
     bookingReference: order.booking_reference,
     status: 'confirmed' as const,
     passengers: order.passengers?.map((p: any) => ({
       id: p.id,
       name: `${p.given_name} ${p.family_name}`,
       seatDesignator: p.seat?.designator,
     })) ?? [],
     slices: (order.slices ?? []).map((s: any) => ({
       origin: s.origin?.iata_code ?? '',
       destination: s.destination?.iata_code ?? '',
       departureTime: s.segments?.[0]?.departing_at ?? '',
       arrivalTime: s.segments?.[0]?.arriving_at ?? '',
       duration: parseDuration(s.duration || ''),
       stops: (s.segments?.length || 1) - 1,
       airline: s.segments?.[0]?.operating_carrier?.name ?? '',
       flightNumber: `${s.segments?.[0]?.operating_carrier?.iata_code ?? ''} ${s.segments?.[0]?.operating_carrier_flight_number ?? ''}`.trim(),
       aircraft: s.segments?.[0]?.aircraft?.name ?? '',
     })),
     totalPaid: parseFloat(order.total_amount) || 0,
     currency: order.total_currency || 'USD',
   };
   ```

2. Update the stub `stubCreateOrder()` to match this shape too — add `passengers`, `slices`, `totalPaid`, `currency` fields.

3. In `ReviewPaymentScreen.tsx`, add the selected seat to `selectedServices` array (line 193-196):
   ```ts
   ...(booking.selectedSeat ? [{ id: `seat-${booking.selectedSeat}`, quantity: 1 }] : []),
   ```

4. **Verify:** `npx tsc --noEmit` on both root and app-v2 — 0 errors.

5. **Commit:** `fix: align create-order response format + send seat selection to backend`

---

### Task 6: Fix hardcoded dates + confirmation screen

**Problem:** (a) Flight search always uses 14 days from now. Should use destination's `departureDate` from feed data if available. (b) Confirmation shows hardcoded "1 stop".

**Files:**
- Modify: `app-v2/src/screens/FlightSelectionScreen.tsx:29`
- Modify: `app-v2/src/screens/ConfirmationScreen.tsx:229`

**Steps:**

1. In `FlightSelectionScreen.tsx`, use destination's dates if available:
   ```ts
   departureDate: dest?.departureDate ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
   returnDate: dest?.returnDate,
   ```

2. In `ConfirmationScreen.tsx`, replace hardcoded "1 stop" (line 229) with dynamic value:
   ```tsx
   {booking.selectedOffer?.slices?.[0]?.stops === 0 ? 'Nonstop' : `${booking.selectedOffer?.slices?.[0]?.stops ?? 1} stop${(booking.selectedOffer?.slices?.[0]?.stops ?? 1) > 1 ? 's' : ''}`}
   ```

3. **Verify:** `npx tsc --noEmit` — 0 errors.

4. **Commit:** `fix: use destination dates for search + dynamic stop count on confirmation`

---

### Task 7: Add offer expiry check

**Problem:** User can spend 20 minutes in the booking flow, then pay for an expired offer. Stripe charges but Duffel rejects.

**Files:**
- Modify: `app-v2/src/screens/ReviewPaymentScreen.tsx`

**Steps:**

1. Before the "Proceed to Pay" button handler, add expiry check:
   ```ts
   const offerExpired = booking.selectedOffer?.expiresAt
     ? new Date(booking.selectedOffer.expiresAt) < new Date()
     : false;
   ```

2. If `offerExpired`, disable the pay button and show warning:
   ```tsx
   {offerExpired && (
     <div style={{ textAlign: 'center', marginBottom: 8 }}>
       <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.terracotta }}>
         This offer has expired. Please go back and select a new flight.
       </span>
     </div>
   )}
   ```

3. Add `disabled={intentLoading || offerExpired}` to the Proceed button.

4. **Verify:** `npx tsc --noEmit` — 0 errors.

5. **Commit:** `feat: check offer expiry before payment — prevent charging for expired offers`

---

## Batch B — Auth + API Hardening

Issues that cause auth failures, broken API calls, or security gaps.

---

### Task 8: Add CORS headers to all API endpoints

**Problem:** No API endpoint sets `Access-Control-Allow-*` headers. Cross-origin browser requests are blocked.

**Files:**
- Create: `api/_cors.ts` — shared CORS utility
- Modify: Every file in `api/` — add cors() call

**Steps:**

1. Create `api/_cors.ts`:
   ```ts
   import type { VercelRequest, VercelResponse } from '@vercel/node';

   const ALLOWED_ORIGINS = [
     'https://sogojet.com',
     'https://www.sogojet.com',
     process.env.FRONTEND_URL,
     'http://localhost:5173', // dev
   ].filter(Boolean) as string[];

   export function cors(req: VercelRequest, res: VercelResponse): boolean {
     const origin = req.headers.origin ?? '';
     if (ALLOWED_ORIGINS.includes(origin)) {
       res.setHeader('Access-Control-Allow-Origin', origin);
     }
     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
     res.setHeader('Access-Control-Max-Age', '86400');

     if (req.method === 'OPTIONS') {
       res.status(204).end();
       return true; // handled
     }
     return false;
   }
   ```

2. In each API handler file (`feed.ts`, `destination.ts`, `swipe.ts`, `saved.ts`, `booking.ts`, `alerts.ts`, `og.ts`, `share/[id].ts`, `prices/refresh.ts`, `prices/refresh-hotels.ts`, `images/refresh.ts`, all `ai/*.ts`), add at the top of the default export:
   ```ts
   import { cors } from './_cors.js';
   // ... in handler:
   if (cors(req, res)) return;
   ```

3. **Verify:** `cd /Users/jackson/SwypeFly && npx tsc --noEmit` — 0 errors.

4. **Commit:** `feat: add CORS headers to all API endpoints`

---

### Task 9: Fix API client 401 handling + token race condition

**Problem:** (a) `apiFetch` throws generic error on 401 — doesn't trigger re-auth. (b) Token may not be set before first query fires after Clerk loads.

**Files:**
- Modify: `app-v2/src/api/client.ts`
- Modify: `app-v2/src/hooks/useAuth.ts`

**Steps:**

1. In `client.ts`, add 401 detection:
   ```ts
   if (res.status === 401) {
     setAuthToken(null);
     // Dispatch a custom event so AuthContext can redirect
     window.dispatchEvent(new CustomEvent('sogojet:auth-expired'));
     throw new Error('Session expired. Please sign in again.');
   }
   ```

2. In `useAuth.ts`, add listener in the main hook (inside the existing useEffect or a new one):
   ```ts
   useEffect(() => {
     const handler = () => {
       if (isSignedIn) {
         getToken({ skipCache: true }).then((t) => setAuthToken(t));
       }
     };
     window.addEventListener('sogojet:auth-expired', handler);
     return () => window.removeEventListener('sogojet:auth-expired', handler);
   }, [isSignedIn, getToken]);
   ```

3. Fix token race: In `useAuth.ts`, make the initial token set synchronous by adding `getToken()` call before returning loading=false. Change the isLoading logic (line 280):
   ```ts
   const [tokenReady, setTokenReady] = useState(false);

   useEffect(() => {
     if (!isLoaded) return;
     if (isSignedIn) {
       getToken().then((token) => {
         setAuthToken(token);
         setTokenReady(true);
       });
       setGuest(false);
     } else {
       setAuthToken(null);
       setTokenReady(true);
     }
   }, [isLoaded, isSignedIn, getToken, setGuest]);

   const isLoading = !isLoaded || (isSignedIn && (!onboardingChecked || !tokenReady));
   ```

4. **Verify:** `npx tsc --noEmit` — 0 errors.

5. **Commit:** `fix: handle 401 with token refresh + prevent race condition on initial auth`

---

### Task 10: Validate env vars at startup (fail-close)

**Problem:** Missing `CLERK_SECRET_KEY`, `DUFFEL_API_KEY`, `APPWRITE_API_KEY` cause silent failures or stub data in production.

**Files:**
- Modify: `services/appwriteServer.ts` — add startup validation
- Modify: `utils/clerkAuth.ts` — add startup validation
- Modify: `api/booking.ts` — log warning for STUB_MODE, return 503 instead of stubs in production

**Steps:**

1. In `services/appwriteServer.ts`, add after client initialization:
   ```ts
   if (!process.env.APPWRITE_API_KEY && !process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID) {
     console.error('[FATAL] Appwrite credentials not configured — database operations will fail');
   }
   ```

2. In `utils/clerkAuth.ts`, add at module level:
   ```ts
   if (!process.env.CLERK_SECRET_KEY) {
     console.error('[FATAL] CLERK_SECRET_KEY not configured — auth verification will fail');
   }
   ```

3. In `api/booking.ts`, change STUB_MODE behavior: if `NODE_ENV === 'production'` and STUB_MODE is true, return 503 instead of stub data:
   ```ts
   if (STUB_MODE && process.env.NODE_ENV === 'production') {
     return res.status(503).json({ error: 'Booking service not configured' });
   }
   ```
   Keep stub responses for development only.

4. **Verify:** `npx tsc --noEmit` — 0 errors. `npm run test` — all pass.

5. **Commit:** `fix: fail-close on missing credentials in production`

---

### Task 11: Invalidate feed cache when departure city changes

**Problem:** User changes departure city in settings, returns to feed, still sees old prices because React Query cache is stale.

**Files:**
- Modify: `app-v2/src/stores/uiStore.ts` — invalidate queries on departure change

**Steps:**

1. In `uiStore.ts`, import queryClient and invalidate on departure change:
   ```ts
   import { queryClient } from '@/api/client';

   // In the store actions:
   setDeparture: (code, city) => {
     set({ departureCode: code, departureCity: city });
     queryClient.invalidateQueries({ queryKey: ['feed'] });
     queryClient.invalidateQueries({ queryKey: ['booking-search'] });
   },
   ```

2. **Verify:** `npx tsc --noEmit` — 0 errors.

3. **Commit:** `fix: invalidate feed + booking cache when departure city changes`

---

## Batch C — Backend Robustness + Tests

Test coverage, error handling, and cron reliability.

---

### Task 12: Add booking endpoint tests

**Problem:** The most complex endpoint (6 actions, Stripe + Duffel integration) has zero tests.

**Files:**
- Create: `__tests__/api/booking.test.ts`

**Steps:**

1. Create `__tests__/api/booking.test.ts` with mocks for:
   - `node-appwrite` (Client, Databases, ID)
   - `utils/apiLogger` (logApiError)
   - `utils/clerkAuth` (verifyClerkToken)
   - `services/duffel` (searchFlights, getOffer, getSeatMap, createOrder)
   - `services/stripe` (createPaymentIntent)

2. Test cases for stub mode (no DUFFEL_API_KEY):
   ```ts
   describe('booking (stub mode)', () => {
     test('POST search — returns 3 offers', async () => { ... });
     test('GET offer — returns offer + 30-row seat map', async () => { ... });
     test('POST payment-intent — requires auth', async () => { ... });
     test('POST create-order — requires auth, returns booking reference', async () => { ... });
     test('GET order — returns order by ID', async () => { ... });
   });
   ```

3. Test validation:
   ```ts
   test('POST search — rejects missing origin', async () => { ... });
   test('POST search — rejects invalid cabin class', async () => { ... });
   test('POST create-order — rejects missing passengers', async () => { ... });
   ```

4. Test auth:
   ```ts
   test('POST payment-intent — 401 without auth header', async () => { ... });
   test('POST create-order — 401 without auth header', async () => { ... });
   ```

5. **Run:** `npm run test -- --testPathPattern booking` — all pass.

6. **Commit:** `test: add booking endpoint tests — stub mode, validation, auth`

---

### Task 13: Add cron job tests

**Problem:** Price refresh, hotel refresh, and image refresh crons have zero tests. Complex logic (Travelpayouts → Amadeus fallback) is unverified.

**Files:**
- Create: `__tests__/api/prices-refresh.test.ts`
- Create: `__tests__/api/images-refresh.test.ts`

**Steps:**

1. Create `__tests__/api/prices-refresh.test.ts`:
   - Mock `node-appwrite`, `services/travelpayouts`, `utils/apiLogger`
   - Test: CRON_SECRET required (401 without, 503 if missing env)
   - Test: Returns price data for valid origins
   - Test: Handles Travelpayouts timeout gracefully

2. Create `__tests__/api/images-refresh.test.ts`:
   - Mock `node-appwrite`, `services/unsplash`, `utils/apiLogger`
   - Test: CRON_SECRET required
   - Test: Refreshes images for destinations with stale images
   - Test: Handles Unsplash API error gracefully (doesn't delete existing images)

3. **Run:** `npm run test` — all pass.

4. **Commit:** `test: add cron job tests — prices, images`

---

### Task 14: Fix silent error handling in swipe + alerts

**Problem:** `api/swipe.ts` and `api/alerts.ts` have bare `catch {}` blocks that swallow errors. Swipe data can silently not persist.

**Files:**
- Modify: `api/swipe.ts`
- Modify: `api/alerts.ts`

**Steps:**

1. In `api/swipe.ts`, find the bare catch blocks around swipe history insertion and preference vector update. Replace:
   ```ts
   } catch (err) {
     logApiError('api/swipe/history', err);
     // Don't fail the whole request — swipe tracking is non-critical
   }
   ```
   Keep the request succeeding, but ensure `logApiError` is called.

2. In `api/alerts.ts`, find the bare catch in the alert check loop. Replace:
   ```ts
   } catch (err) {
     logApiError(`api/alerts/check/${alert.$id}`, err);
   }
   ```

3. **Verify:** `npm run test` — all pass (existing swipe tests still green).

4. **Commit:** `fix: log errors in swipe + alerts instead of silently swallowing`

---

### Task 15: Fix trip-plan streaming error handling

**Problem:** If error occurs mid-stream in `api/ai/trip-plan.ts`, corrupted data is sent to client.

**Files:**
- Modify: `api/ai/trip-plan.ts`

**Steps:**

1. Find the streaming loop. Wrap the chunk writing in try-catch:
   ```ts
   try {
     for await (const chunk of stream) {
       const text = chunk.choices?.[0]?.delta?.content ?? '';
       if (text) res.write(text);
     }
     res.end();
   } catch (err) {
     logApiError('api/ai/trip-plan/stream', err);
     if (!res.headersSent) {
       return res.status(500).json({ error: 'Failed to generate trip plan' });
     }
     // If headers already sent, write error marker and end
     res.write('\n\n[ERROR: Generation interrupted. Please try again.]');
     res.end();
   }
   ```

2. **Verify:** `npx tsc --noEmit` — 0 errors. `npm run test -- --testPathPattern trip-plan` — pass.

3. **Commit:** `fix: handle mid-stream errors in trip plan generation`

---

## Verification (All Batches)

After all tasks:

1. `cd app-v2 && npx tsc --noEmit` — 0 errors
2. `cd /Users/jackson/SwypeFly && npx tsc --noEmit` — 0 errors
3. `npm run test` — all pass (expect ~120+ tests with new booking + cron tests)
4. Manual flow check:
   - Feed loads → select destination → flight selection → 2-passenger form → seat selection (30 rows, price shown) → bags (no meals on stub) → review (total includes seat) → pay
   - Guest user: can browse feed/detail/wishlist, redirected to login when trying to book
   - Change departure city in settings → feed refreshes with new origin

---

## Out of Scope (Future v6)

- Multi-passenger seat selection (select different seats per passenger)
- One-way flights / flexible date search
- Promo code backend validation
- Push notification service worker
- Price alert email delivery
- Delete account / GDPR flow
- Distributed rate limiting (Upstash Redis)
- Infant/child passenger types
- Apple Pay / Google Pay wallet integration
- Offline mode / service worker
