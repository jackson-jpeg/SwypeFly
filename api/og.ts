// OG Image generator — returns an HTML page that renders as an image preview
// Usage: /api/og?city=Paris&country=France&price=64&image=https://...
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { city = 'Amazing Destination', country = '', price, image } = req.query;
  const cityStr = String(city);
  const countryStr = String(country);
  const priceStr = price ? `$${price}` : '';
  const imageUrl = image
    ? String(image)
    : 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:1200px;height:630px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
  <div style="position:relative;width:1200px;height:630px">
    <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block" />
    <div style="position:absolute;inset:0;background:linear-gradient(transparent 30%,rgba(0,0,0,0.8) 100%)"></div>
    <div style="position:absolute;bottom:48px;left:48px;right:48px;color:#fff">
      <div style="font-size:24px;font-weight:600;color:rgba(255,255,255,0.7);margin-bottom:8px">SoGo<span style="color:#38BDF8">Jet</span></div>
      <div style="font-size:64px;font-weight:800;line-height:1.1;letter-spacing:-1px">${cityStr}</div>
      ${countryStr ? `<div style="font-size:28px;font-weight:500;color:rgba(255,255,255,0.8);margin-top:4px">${countryStr}</div>` : ''}
      ${priceStr ? `<div style="margin-top:16px;display:inline-block;padding:8px 24px;border-radius:999px;background:rgba(56,189,248,0.9);font-size:28px;font-weight:700">✈️ From ${priceStr}</div>` : ''}
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.status(200).send(html);
}
