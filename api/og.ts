// OG Image generator — returns an HTML page styled as a 1200x630 social card
// Usage: /api/og?id=<destination_id> (fetches from Appwrite)
//    or: /api/og?city=Paris&country=France&price=64&image=https://...
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { cors } from './_cors.js';
import { env } from '../utils/env';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const TIER_COLORS: Record<string, string> = {
  amazing: '#4ADE80',
  great: '#FBBF24',
  good: '#60A5FA',
};

const TIER_LABELS: Record<string, string> = {
  amazing: 'INCREDIBLE DEAL',
  great: 'GREAT DEAL',
  good: 'GOOD PRICE',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  let cityStr = 'Amazing Destination';
  let countryStr = '';
  let priceStr = '';
  let imageUrl = 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630';
  let tagline = '';
  let flightDuration = '';
  let costLevel = '';
  let dealTier = '';
  let savingsPercent = 0;

  const { id, city, country, price, image } = req.query;

  if (id) {
    try {
      const { data: dest } = await supabase
        .from(TABLES.destinations)
        .select('*')
        .eq('id', String(id))
        .single();
      if (dest) {
        cityStr = escapeHtml(dest.city || cityStr);
        countryStr = escapeHtml(dest.country || '');
        tagline = escapeHtml(dest.tagline || '');
        try {
          const parsedUrl = new URL(dest.image_url || imageUrl);
          if (parsedUrl.protocol === 'https:') imageUrl = escapeHtml(parsedUrl.href);
        } catch { /* invalid URL — keep default image */ }
        const rawPrice = dest.live_price ?? dest.flight_price;
        const effectivePrice = rawPrice ? Math.round(rawPrice * (1 + env.BOOKING_MARKUP_PERCENT / 100)) : null;
        priceStr = effectivePrice ? `$${effectivePrice}` : '';
        flightDuration = escapeHtml(dest.flight_duration || '');
        const hotelPrice = dest.hotel_price_per_night || 0;
        costLevel = hotelPrice <= 60 ? '$' : hotelPrice <= 120 ? '$$' : hotelPrice <= 200 ? '$$$' : '$$$$';
      }

      // Fetch deal quality from price_calendar
      try {
        const { data: calendarRows } = await supabase
          .from(TABLES.priceCalendar)
          .select('deal_tier, savings_percent')
          .eq('destination_id', String(id))
          .order('deal_score', { ascending: false })
          .limit(1);
        if (calendarRows && calendarRows.length > 0) {
          const pd = calendarRows[0];
          const dbTier = (pd.deal_tier as string) || '';
          if (dbTier in TIER_COLORS) dealTier = dbTier;
          savingsPercent = Math.max(0, Math.min(100, (pd.savings_percent as number) || 0));
        }
      } catch {
        // OK — proceed without deal data
      }
    } catch {
      // Fall through to query params
    }
  }

  // Query param overrides (sanitized)
  if (city) cityStr = escapeHtml(String(city));
  if (country) countryStr = escapeHtml(String(country));
  if (price) priceStr = `$${escapeHtml(String(price))}`;
  if (image) {
    try {
      const parsed = new URL(String(image));
      if (parsed.protocol === 'https:') imageUrl = escapeHtml(parsed.href);
    } catch { /* invalid URL — keep default image */ }
  }
  if (req.query.dealTier) {
    const tier = String(req.query.dealTier);
    if (tier in TIER_COLORS) dealTier = tier;
  }
  if (req.query.savingsPercent) savingsPercent = Math.max(0, Math.min(100, parseInt(String(req.query.savingsPercent), 10) || 0));

  const metaRow = [countryStr, flightDuration, costLevel].filter(Boolean).join('  ·  ');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:1200px;height:630px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="position:relative;width:1200px;height:630px;background:#2C1F1A">
    <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block" />
    <!-- Vignette -->
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,0.5) 100%)"></div>
    <!-- Bottom gradient -->
    <div style="position:absolute;inset:0;background:linear-gradient(transparent 25%,rgba(44,31,26,0.3) 50%,rgba(44,31,26,0.85) 80%,rgba(44,31,26,0.95) 100%)"></div>
    <!-- Top-left branding -->
    <div style="position:absolute;top:28px;left:40px;display:flex;align-items:center;gap:12px">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px">SoGo<span style="color:#C8DDD4">Jet</span></div>
      <div style="width:1px;height:20px;background:rgba(255,255,255,0.2)"></div>
      <div style="font-size:14px;font-weight:500;color:rgba(255,255,255,0.5);letter-spacing:1px;text-transform:uppercase">Discover Your Next Trip</div>
    </div>
    <!-- Deal tier badge (top-right) -->
    ${dealTier && TIER_COLORS[dealTier] ? `
    <div style="position:absolute;top:28px;right:40px;display:inline-flex;align-items:center;gap:8px;background:${TIER_COLORS[dealTier]}20;border:1px solid ${TIER_COLORS[dealTier]}60;padding:8px 18px;border-radius:8px">
      <div style="width:10px;height:10px;border-radius:5px;background:${TIER_COLORS[dealTier]}"></div>
      <span style="font-size:16px;font-weight:700;color:${TIER_COLORS[dealTier]};letter-spacing:1px">${TIER_LABELS[dealTier] || ''}</span>
      ${savingsPercent > 0 ? `<span style="font-size:16px;font-weight:600;color:${TIER_COLORS[dealTier]};margin-left:6px">${savingsPercent}% OFF</span>` : ''}
    </div>` : ''}
    <!-- Content -->
    <div style="position:absolute;bottom:40px;left:40px;right:40px;color:#fff">
      <div style="font-size:72px;font-weight:800;line-height:1;letter-spacing:-2px;text-shadow:0 2px 20px rgba(0,0,0,0.5)">${cityStr}</div>
      ${tagline ? `<div style="font-size:22px;font-weight:400;font-style:italic;color:rgba(255,255,255,0.6);margin-top:8px;text-shadow:0 1px 8px rgba(0,0,0,0.4)">${tagline}</div>` : ''}
      ${metaRow ? `<div style="font-size:18px;font-weight:500;color:rgba(255,255,255,0.7);margin-top:8px;letter-spacing:0.5px">${metaRow}</div>` : ''}
      ${priceStr ? `<div style="margin-top:20px;display:inline-flex;align-items:center;gap:8px;padding:10px 28px;border-radius:999px;background:linear-gradient(135deg,rgba(168,196,184,0.9),rgba(168,196,184,0.9));font-size:28px;font-weight:700;box-shadow:0 4px 20px rgba(168,196,184,0.3)">✈️ From ${priceStr}</div>` : ''}
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.status(200).send(html);
}
