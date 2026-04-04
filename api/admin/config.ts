import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../services/supabaseServer';
import { logApiError } from '../../utils/apiLogger';
import { cors } from '../_cors.js';
import { env } from '../../utils/env';
import { sendError } from '../../utils/apiResponse';

const CONFIG_TABLE = 'app_config';
const CONFIG_KEY = 'ios_config';

interface AppConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minVersion: string;
  bookingEnabled: boolean;
  forceUpdateUrl: string;
  stripePublishableKey: string;
  clerkPublishableKey: string;
  features: Record<string, boolean>;
}

const DEFAULT_CONFIG: AppConfig = {
  maintenanceMode: false,
  maintenanceMessage: '',
  minVersion: '1.0.0',
  bookingEnabled: true,
  forceUpdateUrl: 'https://apps.apple.com/app/sogojet/idXXXXXX',
  stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY ?? '',
  clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY ?? '',
  features: {},
};

async function loadConfig(): Promise<AppConfig> {
  const { data, error } = await supabase
    .from(CONFIG_TABLE)
    .select('value')
    .eq('key', CONFIG_KEY)
    .single();

  if (error || !data) return { ...DEFAULT_CONFIG };

  // Merge with defaults so new fields always have a value
  return { ...DEFAULT_CONFIG, ...(data.value as Partial<AppConfig>) };
}

// ─── GET — public config (cached 60s) ───────────────────────────────────────

async function handleGet(_req: VercelRequest, res: VercelResponse) {
  try {
    const config = await loadConfig();
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.json(config);
  } catch (err: unknown) {
    logApiError('api/admin/config GET', err);
    // Return defaults even on DB failure so the app always gets a valid response
    res.setHeader('Cache-Control', 'public, s-maxage=10');
    res.json({ ...DEFAULT_CONFIG });
  }
}

// ─── POST — admin-only config update ────────────────────────────────────────

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const adminSecret = env.ADMIN_SECRET;
  if (!adminSecret) {
    return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'ADMIN_SECRET not configured');
  }

  const token = req.headers.authorization?.replace('Bearer ', '') ?? '';
  if (token !== adminSecret) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
  }

  const updates = req.body;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Body must be a JSON object with config fields to update');
  }

  try {
    // Load current config, merge updates
    const current = await loadConfig();
    const merged: AppConfig = { ...current };

    // Only allow known keys
    const allowedKeys: (keyof AppConfig)[] = [
      'maintenanceMode',
      'maintenanceMessage',
      'minVersion',
      'bookingEnabled',
      'forceUpdateUrl',
      'stripePublishableKey',
      'clerkPublishableKey',
      'features',
    ];

    for (const key of allowedKeys) {
      if (key in updates) {
        // Safe: key is narrowed to keyof AppConfig by the allowedKeys array
        (merged as Record<keyof AppConfig, AppConfig[keyof AppConfig]>)[key] = updates[key];
      }
    }

    // Upsert the config row
    const { error } = await supabase.from(CONFIG_TABLE).upsert(
      { key: CONFIG_KEY, value: merged },
      { onConflict: 'key' },
    );

    if (error) throw error;

    res.json({ ok: true, config: merged });
  } catch (err: unknown) {
    logApiError('api/admin/config POST', err);
    const message = err instanceof Error ? err.message : 'Failed to update config';
    sendError(res, 500, 'INTERNAL_ERROR', message);
  }
}

// ─── Router ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    default:
      return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed. Use GET or POST.');
  }
}
