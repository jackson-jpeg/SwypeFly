// Weekly deal newsletter — pulls top deals and sends branded email via Resend.
// Triggered as a Vercel cron: GET /api/newsletter?secret=CRON_SECRET
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { cors } from './_cors.js';
import { Resend } from 'resend';
import { env } from '../utils/env';
import { sendError } from '../utils/apiResponse';

export const maxDuration = 60;

const DEAL_TIER_COLORS: Record<string, string> = {
  amazing: '#4ADE80',
  great: '#FBBF24',
  good: '#60A5FA',
  fair: '#8B7D6B',
};

const BRAND = {
  bg: '#0A0806',
  surface: '#151210',
  yellow: '#F7E8A0',
  white: '#FFF8F0',
  muted: '#8B7D6B',
  green: '#A8C4B8',
  terracotta: '#E07A5F',
  deepDusk: '#1B1B3A',
};

interface DealRow {
  city: string;
  country: string;
  iata: string;
  price: number;
  usualPrice: number | null;
  savingsPercent: number | null;
  dealTier: string;
  airline: string;
  departureDate: string;
  tripDays: number;
  isNonstop: boolean;
  destinationId: string;
}

// ─── Top deals from all origins ──────────────────────────────────────

async function getTopDeals(limit: number): Promise<DealRow[]> {
  // Get top-scoring calendar entries across all origins
  const { data: rows, error } = await supabase
    .from(TABLES.priceCalendar)
    .select('*')
    .gt('deal_score', 60)
    .order('deal_score', { ascending: false })
    .limit(limit * 3); // over-fetch to deduplicate by destination

  if (error) throw error;
  const entries = rows ?? [];

  // Deduplicate by destination (keep best deal per city)
  const seen = new Set<string>();
  const deals: DealRow[] = [];

  for (const doc of entries) {
    const destId = doc.destination_id;
    if (seen.has(destId)) continue;
    seen.add(destId);

    deals.push({
      city: doc.city || 'Unknown',
      country: doc.country || '',
      iata: doc.destination_iata || '',
      price: doc.price ? Math.round((doc.price as number) * (1 + env.BOOKING_MARKUP_PERCENT / 100)) : 0,
      usualPrice: doc.usual_price || null,
      savingsPercent: doc.savings_percent || null,
      dealTier: doc.deal_tier || 'fair',
      airline: doc.airline || '',
      departureDate: doc.departure_date || '',
      tripDays: doc.trip_days || 0,
      isNonstop: doc.is_nonstop || false,
      destinationId: destId,
    });

    if (deals.length >= limit) break;
  }

  return deals;
}

// ─── Get all subscriber emails ───────────────────────────────────────

async function getSubscribers(): Promise<string[]> {
  const { data: rows, error } = await supabase
    .from(TABLES.subscribers)
    .select('email')
    .eq('active', true)
    .limit(500);
  if (error) throw error;
  return (rows ?? []).map((d) => d.email as string).filter(Boolean);
}

// ─── Build email HTML ────────────────────────────────────────────────

function buildNewsletterHtml(deals: DealRow[]): string {
  const dealRows = deals
    .map((d) => {
      const tierColor = DEAL_TIER_COLORS[d.dealTier] || BRAND.muted;
      const savingsStr =
        d.savingsPercent && d.savingsPercent > 0 ? `${d.savingsPercent}% below avg` : '';
      const nonstopBadge = d.isNonstop
        ? '<span style="background:#4ADE8020;color:#4ADE80;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:8px;">Nonstop</span>'
        : '';
      const dateStr = formatDate(d.departureDate);

      return `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #2A231A;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;">
                <div style="font-size:20px;font-weight:700;color:${BRAND.white};letter-spacing:0.5px;">
                  ${escapeHtml(d.city)}
                  <span style="font-size:12px;font-weight:400;color:${BRAND.muted};margin-left:6px;">${escapeHtml(d.country)}</span>
                </div>
                <div style="margin-top:4px;font-size:12px;color:${BRAND.muted};">
                  ${escapeHtml(d.airline)} · ${d.tripDays}d · ${dateStr}${nonstopBadge}
                </div>
                ${savingsStr ? `<div style="margin-top:4px;font-size:12px;font-weight:600;color:${tierColor};">${savingsStr}</div>` : ''}
              </td>
              <td style="text-align:right;vertical-align:top;">
                <div style="font-size:28px;font-weight:800;color:${BRAND.yellow};letter-spacing:-0.5px;">$${d.price}</div>
                ${d.usualPrice ? `<div style="font-size:12px;color:${BRAND.muted};text-decoration:line-through;">$${d.usualPrice}</div>` : ''}
                <div style="display:inline-block;margin-top:6px;background:${tierColor}20;color:${tierColor};font-size:10px;font-weight:600;padding:3px 10px;border-radius:4px;letter-spacing:0.5px;text-transform:uppercase;">
                  ${d.dealTier === 'amazing' ? 'INCREDIBLE' : d.dealTier === 'great' ? 'GREAT DEAL' : 'GOOD PRICE'}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>This Week's Best Flight Deals — SoGoJet</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <!-- Header -->
        <tr><td style="padding:24px 0;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:${BRAND.white};letter-spacing:-0.5px;">SoGo<span style="color:${BRAND.green}">Jet</span></div>
          <div style="font-size:12px;color:${BRAND.muted};letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Weekly Deal Report</div>
        </td></tr>

        <!-- Hero -->
        <tr><td style="background:${BRAND.surface};border-radius:14px;overflow:hidden;padding:24px;">
          <div style="font-size:24px;font-weight:700;color:${BRAND.white};line-height:1.2;">
            ✈️ This Week's Best Deals
          </div>
          <div style="font-size:14px;color:${BRAND.muted};margin-top:8px;">
            ${deals.length} incredible flight deals found this week. Prices can change fast — grab them before they're gone.
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
            ${dealRows}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:24px 0;text-align:center;">
          <a href="https://sogojet.com" style="display:inline-block;background:${BRAND.yellow};color:${BRAND.bg};font-size:16px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">
            Browse All Deals →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="text-align:center;font-size:11px;color:${BRAND.muted};padding:16px 0;border-top:1px solid #2A231A;">
          &copy; ${new Date().getFullYear()} SoGoJet — Travel deals, simplified.<br/>
          <a href="https://sogojet.com/unsubscribe" style="color:${BRAND.muted};text-decoration:underline;">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  // Auth — Vercel cron Bearer token, query param, or custom header
  const bearerToken = req.headers.authorization?.replace('Bearer ', '');
  const secret = bearerToken || req.query.secret || req.headers['x-cron-secret'];
  const preview = req.query.preview === 'true' && env.VERCEL_ENV !== 'production';

  if (!preview) {
    const cronSecret = env.CRON_SECRET?.trim();
    if (!cronSecret) return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'CRON_SECRET not configured');
    if (secret !== cronSecret) return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
  }

  try {
    const deals = await getTopDeals(5);
    if (deals.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No quality deals found this week' });
    }

    const html = buildNewsletterHtml(deals);

    // Preview mode — return HTML directly
    if (preview) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // Send to all active subscribers
    const resend = getResendClient();
    if (!resend) {
      return res.status(200).json({ sent: 0, message: 'RESEND_API_KEY not configured' });
    }

    const subscribers = await getSubscribers();
    if (subscribers.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No active subscribers' });
    }

    // Batch send (Resend supports up to 100 per call)
    const batchSize = 50;
    let sent = 0;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      await Promise.all(
        batch.map((email) =>
          resend
            .emails.send({
              from: 'SoGoJet Deals <deals@sogojet.com>',
              to: email,
              subject: `✈️ This Week's Best Flight Deals — from $${deals[0].price}`,
              html,
            })
            .catch((err) => console.error(`[newsletter] Failed to send to ${email}:`, err)),
        ),
      );
      sent += batch.length;
    }

    return res.status(200).json({ sent, deals: deals.length });
  } catch (err) {
    console.error('[newsletter] Error:', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal error');
  }
}

function getResendClient(): Resend | null {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}
