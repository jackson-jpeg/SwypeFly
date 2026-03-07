import { z, ZodSchema } from 'zod';

// ─── Shared helpers ──────────────────────────────────────────────────

const iataCode = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter IATA code');

const uuid = z.string().uuid();

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
  regionFilter: z.enum(['all', 'domestic', 'caribbean', 'latam', 'europe', 'asia', 'africa-me', 'oceania']).optional(),
  maxPrice: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(10000)).optional(),
});

// ─── Swipe endpoint ──────────────────────────────────────────────────

export const swipeBodySchema = z.object({
  destination_id: uuid,
  action: z.enum(['viewed', 'skipped', 'saved']),
  time_spent_ms: z.number().int().min(0).optional(),
  price_shown: z.number().min(0).optional(),
});

// ─── Destination endpoint ────────────────────────────────────────────

export const destinationQuerySchema = z.object({
  id: z.string().min(1),
  origin: iataCode.default('TPA'),
});

// ─── Prices refresh endpoint ─────────────────────────────────────────

export const pricesQuerySchema = z.object({
  origin: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
});

// ─── Hotel prices refresh endpoint ───────────────────────────────────

export const hotelPricesQuerySchema = z.object({
  destination: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
});

// ─── AI endpoint schemas ─────────────────────────────────────────────

export const liveUpdatesQuerySchema = z.object({
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
});

export const destinationGuideQuerySchema = z.object({
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
});

export const nearbyGemsQuerySchema = z.object({
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  lat: z.string().transform(Number).pipe(z.number()).optional(),
  lng: z.string().transform(Number).pipe(z.number()).optional(),
});

export const priceCheckQuerySchema = z.object({
  origin: iataCode,
  destination: iataCode,
});

export const tripPlanBodySchema = z.object({
  destination_id: uuid.optional(),
  city: z.string().min(1).max(100),
  country: z.string().max(100).optional(),
  duration: z.number().int().min(1).max(30).optional().default(5),
  style: z.enum(['budget', 'comfort', 'luxury']).optional().default('comfort'),
  interests: z.string().max(500).optional(),
});

// ─── Price alert endpoint ────────────────────────────────────────────

export const priceAlertBodySchema = z.object({
  destination_id: uuid,
  target_price: z.number().positive().max(100000),
  email: z.string().email().max(255).optional(),
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
});

export const bookingOrderSchema = z.object({
  orderId: z.string().min(1).max(200),
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
