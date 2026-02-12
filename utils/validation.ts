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
  destination_id: uuid,
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
});

// ─── Validate helper ─────────────────────────────────────────────────

export function validateRequest<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: messages };
}
