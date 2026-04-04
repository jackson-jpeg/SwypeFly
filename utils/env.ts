/**
 * Centralised environment variable validation for the SoGoJet backend.
 * Import `env` (validated object) and `STUB_MODE` instead of reading
 * process.env directly in API routes and services.
 */
import { z } from 'zod';

const envSchema = z.object({
  // ─── Database ──────────────────────────────────────────────────────
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // ─── Appwrite (legacy — still referenced by appwriteServer.ts) ────
  APPWRITE_ENDPOINT: z.string().optional(),
  APPWRITE_PROJECT_ID: z.string().optional(),
  APPWRITE_API_KEY: z.string().optional(),

  // ─── Auth ──────────────────────────────────────────────────────────
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_FRONTEND_API: z.string().optional(),

  // ─── Flights / Booking ─────────────────────────────────────────────
  DUFFEL_API_KEY: z.string().optional(),
  DUFFEL_WEBHOOK_SECRET: z.string().optional(),
  BOOKING_MARKUP_PERCENT: z.coerce.number().default(3),

  // ─── Pricing data ─────────────────────────────────────────────────
  TRAVELPAYOUTS_API_TOKEN: z.string().optional(),
  TRAVELPAYOUTS_MARKER: z.string().optional(),
  LITEAPI_API_KEY: z.string().optional(),
  AMADEUS_CLIENT_ID: z.string().optional(),
  AMADEUS_CLIENT_SECRET: z.string().optional(),

  // ─── Payments ──────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ─── AI ────────────────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_GENAI_API_KEY: z.string().optional(),

  // ─── Images ────────────────────────────────────────────────────────
  UNSPLASH_ACCESS_KEY: z.string().optional(),

  // ─── Email ─────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().optional(),

  // ─── Security ──────────────────────────────────────────────────────
  CRON_SECRET: z.string().optional(),
  ADMIN_SECRET: z.string().optional(),
  TRAVELER_ENCRYPTION_KEY: z.string().optional(),

  // ─── Observability ─────────────────────────────────────────────────
  SENTRY_DSN: z.string().optional(),

  // ─── Vercel runtime ────────────────────────────────────────────────
  VERCEL_ENV: z.string().optional(),
  NODE_ENV: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Parse & validate
// ---------------------------------------------------------------------------

const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null;

// In test/CI environments, provide defaults for required fields so imports don't explode
const input = isTest
  ? { SUPABASE_URL: 'http://localhost:54321', SUPABASE_SERVICE_ROLE_KEY: 'test-key', ...process.env }
  : process.env;

const parsed = envSchema.safeParse(input);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');

  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error(`[env] Missing critical environment variables:\n${formatted}`);
  }

  console.warn(`[env] Environment validation warnings:\n${formatted}`);
}

/** Validated environment variables. Falls back to defaults for optional vars. */
export const env = (parsed.success ? parsed.data : envSchema.parse(input)) as z.infer<typeof envSchema>;

/** True when DUFFEL_API_KEY is absent — endpoints return stub/demo data. */
export const STUB_MODE = !env.DUFFEL_API_KEY;
