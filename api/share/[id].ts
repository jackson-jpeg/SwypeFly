// Dynamic OG share page — returns HTML with meta tags for social crawlers,
// redirects real users to the SPA destination page.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS } from '../../services/appwriteServer';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const destId = String(id);
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /bot|crawl|spider|facebook|twitter|linkedin|slack|discord|telegram|whatsapp/i.test(ua);

  // Real users get redirected to the SPA
  if (!isBot) {
    return res.redirect(302, `/destination/${destId}`);
  }

  try {
    const dest = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.destinations, destId);
    const city = escapeHtml(dest.city || 'Amazing Destination');
    const country = escapeHtml(dest.country || '');
    const tagline = escapeHtml(dest.tagline || 'Discover cheap flights');
    const imageUrl = encodeURI(dest.image_url || 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630');
    const price = dest.flight_price || '';
    const priceText = price ? ` from $${price}` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${city}, ${country}${priceText} — SoGoJet</title>
  <meta name="description" content="${tagline}">
  <meta property="og:title" content="${city}, ${country}${priceText}">
  <meta property="og:description" content="${tagline} — Discover cheap flights on SoGoJet">
  <meta property="og:image" content="https://sogojet.com/api/og?id=${destId}">
  <meta property="og:url" content="https://sogojet.com/destination/${destId}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="SoGoJet">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${city}${priceText} — SoGoJet">
  <meta name="twitter:description" content="${tagline}">
  <meta name="twitter:image" content="https://sogojet.com/api/og?id=${destId}">
  <meta http-equiv="refresh" content="0;url=/destination/${destId}">
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
