// Social share card generator — returns 1080×1080 (Instagram) or 1200×630 (Twitter) HTML card.
// Usage: /api/share-card?id=<destination_id>&format=instagram|twitter
//        /api/share-card?top=5  — "Top 5 Deals" board card (Instagram format)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { cors } from './_cors.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const COLORS = {
  bg: '#0A0806',
  surface: '#151210',
  yellow: '#F7E8A0',
  white: '#FFF8F0',
  muted: '#8B7D6B',
  green: '#A8C4B8',
  dealAmazing: '#4ADE80',
  dealGreat: '#FBBF24',
  dealGood: '#60A5FA',
  border: '#2A231A',
};

const TIER_COLORS: Record<string, string> = {
  amazing: COLORS.dealAmazing,
  great: COLORS.dealGreat,
  good: COLORS.dealGood,
  fair: COLORS.muted,
};

// ─── Single deal card ────────────────────────────────────────────────

function singleDealCard(
  city: string,
  country: string,
  price: number,
  imageUrl: string,
  dealTier: string,
  savingsPercent: number | null,
  usualPrice: number | null,
  airline: string,
  isNonstop: boolean,
  format: 'instagram' | 'twitter',
): string {
  const w = format === 'instagram' ? 1080 : 1200;
  const h = format === 'instagram' ? 1080 : 630;
  const tierColor = TIER_COLORS[dealTier] || COLORS.muted;
  const tierLabel =
    dealTier === 'amazing'
      ? 'INCREDIBLE DEAL'
      : dealTier === 'great'
        ? 'GREAT DEAL'
        : dealTier === 'good'
          ? 'GOOD PRICE'
          : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="position:relative;width:${w}px;height:${h}px;background:${COLORS.bg};">
    <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" />
    <!-- Vignette + gradient -->
    <div style="position:absolute;inset:0;background:linear-gradient(transparent 20%,rgba(10,8,6,0.4) 50%,rgba(10,8,6,0.92) 80%,rgba(10,8,6,0.98) 100%);"></div>

    <!-- Deal badge -->
    ${
      tierLabel
        ? `<div style="position:absolute;top:40px;left:40px;display:inline-flex;align-items:center;gap:8px;background:${tierColor}20;border:1px solid ${tierColor}50;padding:8px 16px;border-radius:6px;">
        <div style="width:8px;height:8px;border-radius:4px;background:${tierColor};"></div>
        <span style="font-size:14px;font-weight:700;color:${tierColor};letter-spacing:1px;">${tierLabel}</span>
        ${savingsPercent && savingsPercent > 0 ? `<span style="font-size:14px;font-weight:600;color:${tierColor};margin-left:8px;">${savingsPercent}% BELOW AVG</span>` : ''}
      </div>`
        : ''
    }

    <!-- SoGoJet branding -->
    <div style="position:absolute;top:40px;right:40px;font-size:24px;font-weight:800;color:${COLORS.white};letter-spacing:-0.5px;">SoGo<span style="color:${COLORS.green}">Jet</span></div>

    <!-- Bottom content -->
    <div style="position:absolute;bottom:${format === 'instagram' ? 60 : 40}px;left:40px;right:40px;">
      <div style="font-size:${format === 'instagram' ? 64 : 52}px;font-weight:800;color:${COLORS.white};line-height:1;letter-spacing:-2px;text-shadow:0 2px 20px rgba(0,0,0,0.5);">${escapeHtml(city)}</div>
      <div style="font-size:18px;color:${COLORS.muted};margin-top:6px;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(country)}${airline ? ` · ${escapeHtml(airline)}` : ''}${isNonstop ? ' · Nonstop' : ''}</div>

      <!-- Price row -->
      <div style="margin-top:20px;display:flex;align-items:baseline;gap:16px;">
        <div style="font-size:${format === 'instagram' ? 56 : 44}px;font-weight:800;color:${COLORS.yellow};letter-spacing:-1px;">$${price}</div>
        ${usualPrice ? `<div style="font-size:22px;color:${COLORS.muted};text-decoration:line-through;">$${usualPrice}</div>` : ''}
        <div style="font-size:14px;color:${COLORS.muted};letter-spacing:0.5px;">round trip</div>
      </div>

      <!-- Footer -->
      <div style="margin-top:20px;font-size:14px;color:${COLORS.muted};letter-spacing:0.5px;">Found on SoGoJet · sogojet.com</div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Board card — top N deals ────────────────────────────────────────

function boardCard(
  deals: Array<{ origin: string; city: string; price: number; savingsPercent: number | null; dealTier: string; isNonstop: boolean }>,
): string {
  const w = 1080;
  const h = 1080;

  const rows = deals
    .map((d, i) => {
      const tierColor = TIER_COLORS[d.dealTier] || COLORS.muted;
      const savingsStr =
        d.savingsPercent && d.savingsPercent > 0 ? `−${d.savingsPercent}%` : '';
      return `
      <div style="display:flex;align-items:center;padding:18px 0;${i < deals.length - 1 ? `border-bottom:1px solid ${COLORS.border};` : ''}">
        <div style="width:80px;font-size:28px;font-weight:800;color:${COLORS.muted};font-family:'Courier New',monospace;">${escapeHtml(d.origin)}</div>
        <div style="font-size:16px;color:${COLORS.muted};margin:0 12px;">→</div>
        <div style="flex:1;">
          <div style="font-size:24px;font-weight:700;color:${COLORS.white};font-family:'Courier New',monospace;letter-spacing:1px;">${escapeHtml(d.city.toUpperCase())}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px;font-weight:800;color:${COLORS.yellow};font-family:'Courier New',monospace;">$${d.price}</div>
          ${savingsStr ? `<div style="font-size:13px;font-weight:600;color:${tierColor};">${savingsStr}</div>` : ''}
        </div>
        <div style="width:14px;height:14px;border-radius:7px;background:${tierColor};margin-left:16px;"></div>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="width:${w}px;height:${h}px;background:${COLORS.bg};display:flex;flex-direction:column;">
    <!-- Header -->
    <div style="padding:40px 40px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:32px;font-weight:800;color:${COLORS.white};letter-spacing:-0.5px;">SoGo<span style="color:${COLORS.green}">Jet</span></div>
        <div style="font-size:13px;color:${COLORS.muted};letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Flight Deals Board</div>
      </div>
      <div style="font-size:14px;color:${COLORS.muted};letter-spacing:0.5px;">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </div>

    <!-- Deals -->
    <div style="flex:1;padding:10px 40px;overflow:hidden;">
      ${rows}
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px 40px;text-align:center;font-size:14px;color:${COLORS.muted};">
      ✈️ sogojet.com — Swipe your next trip
    </div>
  </div>
</body>
</html>`;
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const format = (String(req.query.format || 'instagram')) as 'instagram' | 'twitter';
  const topN = req.query.top ? parseInt(String(req.query.top), 10) : 0;
  const destId = req.query.id ? String(req.query.id) : null;

  try {
    // Board mode — top N deals
    if (topN > 0) {
      const { data: entriesData, error: entriesError } = await supabase
        .from(TABLES.priceCalendar)
        .select('*')
        .gt('deal_score', 50)
        .order('deal_score', { ascending: false })
        .limit(topN * 2);

      if (entriesError) throw entriesError;
      const entries = entriesData ?? [];

      const seen = new Set<string>();
      const deals: Array<{ origin: string; city: string; price: number; savingsPercent: number | null; dealTier: string; isNonstop: boolean }> = [];

      for (const doc of entries) {
        const key = doc.destination_iata || doc.city;
        if (seen.has(key)) continue;
        seen.add(key);
        deals.push({
          origin: doc.origin || 'JFK',
          city: doc.city || 'Unknown',
          price: doc.price || 0,
          savingsPercent: doc.savings_percent || null,
          dealTier: doc.deal_tier || 'fair',
          isNonstop: doc.is_nonstop || false,
        });
        if (deals.length >= topN) break;
      }

      const html = boardCard(deals);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      return res.status(200).send(html);
    }

    // Single deal mode
    if (!destId) {
      return res.status(400).json({ error: 'Provide ?id=<destination_id> or ?top=N' });
    }

    const { data: dest, error: destError } = await supabase
      .from(TABLES.destinations)
      .select('*')
      .eq('id', destId)
      .single();

    if (destError) throw destError;

    // Try to get price calendar data for deal context
    let dealTier = 'fair';
    let savingsPercent: number | null = null;
    let usualPrice: number | null = null;
    let isNonstop = false;

    try {
      const { data: priceData } = await supabase
        .from(TABLES.priceCalendar)
        .select('*')
        .eq('destination_id', destId)
        .order('deal_score', { ascending: false })
        .limit(1);
      if (priceData && priceData.length > 0) {
        const pd = priceData[0];
        dealTier = pd.deal_tier || 'fair';
        savingsPercent = pd.savings_percent || null;
        usualPrice = pd.usual_price || null;
        isNonstop = pd.is_nonstop || false;
      }
    } catch {
      // OK — proceed without deal context
    }

    const city = dest.city || 'Amazing Destination';
    const country = dest.country || '';
    const price = dest.live_price ?? dest.flight_price ?? 0;
    const imageUrl = encodeURI(
      dest.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80',
    );
    const airline = dest.airline_name || '';

    const html = singleDealCard(city, country, price, imageUrl, dealTier, savingsPercent, usualPrice, airline, isNonstop, format);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[share-card] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
