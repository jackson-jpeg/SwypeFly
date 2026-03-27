// Dynamic sitemap generator — pulls active destinations from Supabase
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Fetch all active destinations (paginated)
    let allDests: { id: string; city: string }[] = [];
    let offset = 0;
    while (allDests.length < 5000) {
      const { data, error } = await supabase
        .from(TABLES.destinations)
        .select('id, city')
        .eq('is_active', true)
        .order('city', { ascending: true })
        .range(offset, offset + 499);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allDests = allDests.concat(data);
      offset += 500;
      if (data.length < 500) break;
    }

    const today = new Date().toISOString().split('T')[0];

    const destUrls = allDests.map(
      (d) => `  <url>
    <loc>https://sogojet.com/destination/${d.id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
    );

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://sogojet.com</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://sogojet.com/legal/privacy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://sogojet.com/legal/terms</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
${destUrls.join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.status(200).send(sitemap);
  } catch (err) {
    console.error('[sitemap] Error generating sitemap:', err);
    return res.status(500).send('Error generating sitemap');
  }
}
