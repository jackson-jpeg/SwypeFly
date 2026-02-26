// OG Image generator — returns an HTML page styled as a 1200x630 social card
// Usage: /api/og?id=<destination_id> (fetches from Appwrite)
//    or: /api/og?city=Paris&country=France&price=64&image=https://...
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS } from '../services/appwriteServer';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let cityStr = 'Amazing Destination';
  let countryStr = '';
  let priceStr = '';
  let imageUrl = 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630';
  let tagline = '';
  let rating = '';
  let flightDuration = '';
  let costLevel = '';

  const { id, city, country, price, image } = req.query;

  if (id) {
    try {
      const dest = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.destinations, String(id));
      cityStr = escapeHtml(dest.city || cityStr);
      countryStr = escapeHtml(dest.country || '');
      tagline = escapeHtml(dest.tagline || '');
      imageUrl = encodeURI(dest.image_url || imageUrl);
      const effectivePrice = dest.live_price ?? dest.flight_price;
      priceStr = effectivePrice ? `$${effectivePrice}` : '';
      rating = dest.rating ? `★ ${dest.rating}` : '';
      flightDuration = dest.flight_duration || '';
      const hotelPrice = dest.hotel_price_per_night || 0;
      costLevel = hotelPrice <= 60 ? '$' : hotelPrice <= 120 ? '$$' : hotelPrice <= 200 ? '$$$' : '$$$$';
    } catch {
      // Fall through to query params
    }
  }

  // Query param overrides (sanitized)
  if (city) cityStr = escapeHtml(String(city));
  if (country) countryStr = escapeHtml(String(country));
  if (price) priceStr = `$${escapeHtml(String(price))}`;
  if (image) imageUrl = encodeURI(String(image));

  const metaRow = [countryStr, flightDuration, costLevel].filter(Boolean).join('  ·  ');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:1200px;height:630px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="position:relative;width:1200px;height:630px;background:#0F172A">
    <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block" />
    <!-- Vignette -->
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,0.5) 100%)"></div>
    <!-- Bottom gradient -->
    <div style="position:absolute;inset:0;background:linear-gradient(transparent 25%,rgba(15,23,42,0.3) 50%,rgba(15,23,42,0.85) 80%,rgba(15,23,42,0.95) 100%)"></div>
    <!-- Top-left branding -->
    <div style="position:absolute;top:28px;left:40px;display:flex;align-items:center;gap:12px">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px">SoGo<span style="color:#38BDF8">Jet</span></div>
      <div style="width:1px;height:20px;background:rgba(255,255,255,0.2)"></div>
      <div style="font-size:14px;font-weight:500;color:rgba(255,255,255,0.5);letter-spacing:1px;text-transform:uppercase">Discover Your Next Trip</div>
    </div>
    ${rating ? `<div style="position:absolute;top:28px;right:40px;padding:6px 16px;border-radius:999px;background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);color:#FBBF24;font-size:18px;font-weight:700">${rating}</div>` : ''}
    <!-- Content -->
    <div style="position:absolute;bottom:40px;left:40px;right:40px;color:#fff">
      <div style="font-size:72px;font-weight:800;line-height:1;letter-spacing:-2px;text-shadow:0 2px 20px rgba(0,0,0,0.5)">${cityStr}</div>
      ${tagline ? `<div style="font-size:22px;font-weight:400;font-style:italic;color:rgba(255,255,255,0.6);margin-top:8px;text-shadow:0 1px 8px rgba(0,0,0,0.4)">${tagline}</div>` : ''}
      ${metaRow ? `<div style="font-size:18px;font-weight:500;color:rgba(255,255,255,0.7);margin-top:8px;letter-spacing:0.5px">${metaRow}</div>` : ''}
      ${priceStr ? `<div style="margin-top:20px;display:inline-flex;align-items:center;gap:8px;padding:10px 28px;border-radius:999px;background:linear-gradient(135deg,rgba(56,189,248,0.9),rgba(129,140,248,0.9));font-size:28px;font-weight:700;box-shadow:0 4px 20px rgba(56,189,248,0.3)">✈️ From ${priceStr}</div>` : ''}
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.status(200).send(html);
}
