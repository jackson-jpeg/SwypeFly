import { z, ZodSchema } from 'zod';

// ─── Shared helpers ──────────────────────────────────────────────────

const iataCode = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter IATA code');

// ─── Feed endpoint ───────────────────────────────────────────────────

export const feedQuerySchema = z.object({
  origin: iataCode.default('TPA'),
  cursor: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(0))
    .optional(),
  sessionId: z.string().max(64).optional(),
  excludeIds: z.string().max(5000).optional(),
  vibeFilter: z.string().max(50).optional(),
  sortPreset: z.enum(['default', 'cheapest', 'trending']).optional(),
  regionFilter: z.string().max(100).optional(),
  maxPrice: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(10000)).optional(),
  minPrice: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(10000)).optional(),
  search: z.string().max(100).optional(),
  durationFilter: z.enum(['any', 'weekend', 'week', 'extended']).optional(),
  // Quiz-based personalization (optional — feed works without these)
  travelStyle: z.enum(['budget', 'comfort', 'luxury']).optional(),
  budgetLevel: z.enum(['low', 'medium', 'high']).optional(),
  preferredSeason: z.enum(['spring', 'summer', 'fall', 'winter']).optional(),
  preferredVibes: z.string().max(200).optional(),
});

// ─── Search deals endpoint ──────────────────────────────────────────

export const searchDealsQuerySchema = z.object({
  origin: iataCode.default('TPA'),
  search: z.string().max(100).optional(),
  region: z.enum(['all', 'domestic', 'caribbean', 'latam', 'europe', 'asia', 'africa-me', 'oceania']).optional(),
  minPrice: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(10000)).optional(),
  maxPrice: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(10000)).optional(),
  sort: z.enum(['cheapest', 'trending', 'newest']).default('cheapest'),
  cursor: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(0)).optional(),
});

// ─── Swipe endpoint ──────────────────────────────────────────────────

export const swipeBodySchema = z.object({
  destination_id: z.string().min(1).max(100),
  action: z.enum(['viewed', 'skipped', 'saved']),
  time_spent_ms: z.number().int().min(0).optional(),
  price_shown: z.number().min(0).optional(),
});

// ─── Destination endpoint ────────────────────────────────────────────

export const destinationQuerySchema = z.object({
  id: z.string().min(1),
  origin: iataCode.default('TPA'),
});

// ─── Price calendar query ────────────────────────────────────────────

export const priceCalendarQuerySchema = z.object({
  action: z.enum(['calendar', 'monthly']),
  origin: iataCode,
  destination: iataCode,
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM').optional(),
});

// ─── Week matrix query ──────────────────────────────────────────────

export const weekMatrixQuerySchema = z.object({
  action: z.literal('week-matrix'),
  origin: iataCode,
  destination: iataCode,
  departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ─── Price history query ────────────────────────────────────────────

export const priceHistoryQuerySchema = z.object({
  action: z.literal('price-history'),
  origin: iataCode,
  destination: iataCode,
});

// ─── Detect origin query ────────────────────────────────────────────

export const detectOriginQuerySchema = z.object({
  action: z.literal('detect-origin'),
});

// ─── Budget discovery query ─────────────────────────────────────────

export const budgetDiscoveryQuerySchema = z.object({
  action: z.literal('budget'),
  origin: iataCode.default('TPA'),
  minPrice: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(10000)).optional(),
  maxPrice: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(10000)),
});

// ─── Price alert list query ─────────────────────────────────────────

export const priceAlertListQuerySchema = z.object({
  action: z.literal('list'),
});

// ─── Prices refresh endpoint ─────────────────────────────────────────

export const pricesQuerySchema = z.object({
  origin: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
});

// ─── Live search endpoint ───────────────────────────────────────────

export const searchQuerySchema = z.object({
  origin: iataCode,
  destination: iataCode,
});

// ─── Hotel prices refresh endpoint ───────────────────────────────────

export const hotelPricesQuerySchema = z.object({
  destination: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
});

// ─── AI endpoint schemas ─────────────────────────────────────────────

export const tripPlanBodySchema = z.object({
  destination_id: z.string().min(1).max(100).optional(),
  city: z.string().min(1).max(100),
  country: z.string().max(100).optional(),
  duration: z.number().int().min(1).max(30).optional().default(5),
  style: z.enum(['budget', 'comfort', 'luxury']).optional().default('comfort'),
  interests: z.string().max(500).optional(),
});

// ─── Price alert endpoint ────────────────────────────────────────────

export const priceAlertBodySchema = z.object({
  destination_id: z.string().min(1).max(100),
  target_price: z.number().positive().max(100000),
  email: z.string().email().max(255).optional(),
});

// ─── Price alert delete ─────────────────────────────────────────────

export const priceAlertDeleteSchema = z.object({
  alertId: z.string().min(1).max(100),
});

// ─── Subscribe endpoint ─────────────────────────────────────────────

export const subscribeBodySchema = z.object({
  email: z.string().email().max(255),
  airport: iataCode.default('TPA'),
});

// ─── Booking flow schemas ───────────────────────────────────────────

export const passengerSchema = z.object({
  given_name: z.string().min(1).max(100),
  family_name: z.string().min(1).max(100),
  born_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  gender: z.enum(['f', 'm']),
  title: z.enum(['mr', 'mrs', 'ms', 'miss', 'dr']),
  email: z.string().email().max(255),
  phone_number: z.string().min(5).max(20),
});

export const bookingSearchSchema = z.object({
  origin: iataCode,
  destination: iataCode,
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  passengers: z.array(z.object({
    type: z.enum(['adult', 'child', 'infant_without_seat']),
  })).min(1).max(9),
  cabinClass: z.enum(['economy', 'premium_economy', 'business', 'first']).optional(),
  priceHint: z.number().positive().optional(),
});

export const bookingOfferSchema = z.object({
  offerId: z.string().min(1).max(200),
});

export const paymentIntentSchema = z.object({
  offerId: z.string().min(1).max(200),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
});

export const createOrderSchema = z.object({
  offerId: z.string().min(1).max(200),
  passengers: z.array(passengerSchema.extend({
    id: z.string().min(1),
  })).min(1).max(9),
  selectedServices: z.array(z.object({
    id: z.string().min(1),
    quantity: z.number().int().min(1).max(10),
  })).optional(),
  paymentIntentId: z.string().min(1).max(200),
  amount: z.number().optional(), // total in cents for Duffel payment
  currency: z.string().max(10).optional(),
  // Destination metadata for booking history display
  destinationCity: z.string().max(100).optional(),
  destinationIata: z.string().max(10).optional(),
  originIata: z.string().max(10).optional(),
  departureDate: z.string().max(20).optional(),
  returnDate: z.string().max(20).optional(),
});

export const bookingOrderSchema = z.object({
  orderId: z.string().min(1).max(200),
});

// ─── Hotel booking schemas ──────────────────────────────────────────

export const hotelSearchSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  guests: z.number().int().min(1).max(10).optional(),
});

export const hotelQuoteSchema = z.object({
  accommodationId: z.string().min(1).max(200),
  roomId: z.string().min(1).max(200),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

export const hotelBookSchema = z.object({
  quoteId: z.string().min(1).max(200),
  paymentIntentId: z.string().min(1).max(200),
  guestName: z.string().min(1).max(200),
  guestEmail: z.string().email().max(255),
});

// ─── Validate helper ─────────────────────────────────────────────────

type ValidationSuccess<T> = { success: true; data: T; error?: undefined };
type ValidationFailure = { success: false; error: string; data?: undefined };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function validateRequest<T>(
  schema: ZodSchema<T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: messages };
}
