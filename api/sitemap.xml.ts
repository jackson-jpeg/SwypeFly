// Dynamic sitemap generator
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const result = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.destinations,
      [Query.limit(300)],
    );

    const urls = result.documents.map((doc) => {
      const id = doc.$id;
      const city = doc.city || '';
      return `  <url>
    <loc>https://sogojet.com/destination/${id}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    const today = new Date().toISOString().split('T')[0];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://sogojet.com</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://sogojet.com/saved</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
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
${urls.join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.status(200).send(sitemap);
  } catch {
    return res.status(500).send('Error generating sitemap');
  }
}
