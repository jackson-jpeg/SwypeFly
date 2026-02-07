// Placeholder — API routes require server-side rendering config.
// Using server/proxy.ts for live price fetching instead.
// This file kept for future migration to Expo Router API routes.

export async function GET() {
  return Response.json({ error: 'Use the price proxy server (npm run prices)' });
}
