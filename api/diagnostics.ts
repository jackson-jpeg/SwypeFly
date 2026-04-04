import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logApiError } from '../utils/apiLogger';
import { cors } from './_cors.js';
import { sendError } from '../utils/apiResponse';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';

/**
 * POST /api/diagnostics
 *
 * Receives MetricKit crash/hang diagnostic payloads from the iOS app.
 * Logs them server-side for monitoring. In production, these could be
 * forwarded to a crash analytics service or stored in the database.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'POST only');

  // Rate limit: 20 reports per minute per IP (MetricKit delivers in batches)
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`diagnostics:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many diagnostic reports');
  }

  try {
    const { type, appVersion, buildNumber, osVersion, deviceModel, payload } = req.body ?? {};

    if (!type || !payload) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Missing required fields: type, payload');
    }

    // Log the diagnostic report (visible in Vercel function logs)
    console.warn(
      `[diagnostics] ${type} from ${deviceModel ?? 'unknown'} ` +
      `(v${appVersion ?? '?'} build ${buildNumber ?? '?'}, iOS ${osVersion ?? '?'}) ` +
      `payload=${typeof payload === 'string' ? payload.length : 0} bytes`
    );

    // In the future, this could be stored in a database table or forwarded
    // to an external crash analytics service (Sentry, Crashlytics, etc.)

    res.json({ received: true });
  } catch (err: unknown) {
    logApiError('api/diagnostics', err);
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to process diagnostic report');
  }
}
