// Dynamic OG share page — returns HTML with meta tags for social crawlers,
// redirects real users to the SPA destination page.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../../services/supabaseServer';
import { cors } from '../_cors.js';
import { env } from '../../utils/env';
import { sendError } from '../../utils/apiResponse';

const BOOKING_MARKUP_PERCENT = env.BOOKING_MARKUP_PERCENT;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  const { id } = req.query;
  const destId = String(id);

  // Validate destination ID to prevent open redirect
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(destId)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid destination ID');
  }

  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /bot|crawl|spider|facebook|twitter|linkedin|slack|discord|telegram|whatsapp/i.test(ua);

  // Real users get redirected to the SPA
  if (!isBot) {
    return res.redirect(302, `/destination/${destId}`);
  }

  try {
    const { data: dest, error } = await supabase
      .from(TABLES.destinations)
      .select('city, country, tagline, flight_price, live_price, hotel_price_per_night, airline_name')
      .eq('id', destId)
      .single();
    if (error || !dest) throw error ?? new Error('Not found');
    const city = escapeHtml(dest.city || 'Amazing Destination');
    const country = escapeHtml(dest.country || '');
    const tagline = escapeHtml(dest.tagline || 'Discover cheap flights');
    const rawPrice = (dest.live_price ?? dest.flight_price) as number | null;
    const price = rawPrice ? Math.round(rawPrice * (1 + BOOKING_MARKUP_PERCENT / 100)) : '';
    const priceText = price ? ` from $${price}` : '';

    let dealBadge = '';
    let savingsText = '';
    try {
      const { data: calendarRows } = await supabase
        .from(TABLES.priceCalendar)
        .select('deal_tier, savings_percent')
        .eq('destination_id', destId)
        .order('deal_score', { ascending: false })
        .limit(1);
      if (calendarRows && calendarRows.length > 0) {
        const pd = calendarRows[0];
        const tier = pd.deal_tier as string;
        const savings = pd.savings_percent as number;
        if (tier === 'amazing') dealBadge = 'Incredible Deal';
        else if (tier === 'great') dealBadge = 'Great Deal';
        else if (tier === 'good') dealBadge = 'Good Price';
        if (savings > 0) savingsText = `${savings}% below average`;
      }
    } catch {
      // OK — proceed without deal context
    }

    const descParts = [tagline];
    if (dealBadge) descParts.push(dealBadge);
    if (savingsText) descParts.push(savingsText);
    descParts.push('Discover cheap flights on SoGoJet');
    const ogDescription = escapeHtml(descParts.join(' — '));

    const ogImageUrl = `https://sogojet.com/api/og?id=${destId}`;
    const destUrl = `https://sogojet.com/destination/${destId}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${city}, ${country}${priceText} — SoGoJet</title>
  <meta name="description" content="${ogDescription}">
  <meta property="og:title" content="${city}, ${country}${priceText}">
  <meta property="og:description" content="${ogDescription}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${destUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="SoGoJet">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${city}${priceText} — SoGoJet">
  <meta name="twitter:description" content="${ogDescription}">
  <meta name="twitter:image" content="${ogImageUrl}">
  <meta http-equiv="refresh" content="0;url=/destination/${destId}">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TravelAction",
    "name": "${city}, ${country}",
    "description": "${tagline}",
    "toLocation": {
      "@type": "Place",
      "name": "${city}",
      "address": { "@type": "PostalAddress", "addressCountry": "${country}" }
    }${price ? `,
    "priceSpecification": {
      "@type": "PriceSpecification",
      "price": "${price}",
      "priceCurrency": "USD"
    }` : ''}
  }
  </script>
</head>
<body>
  <p>Redirecting to <a href="/destination/${destId}">${city} on SoGoJet</a>...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.status(200).send(html);
  } catch {
    return res.redirect(302, `/destination/${destId}`);
  }
}
