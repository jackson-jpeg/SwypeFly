// One-time migration endpoint — creates missing performance indexes
// Usage: POST /api/migrate with header Authorization: Bearer <CRON_SECRET>
// Safe to run multiple times (IF NOT EXISTS)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from './_cors.js';

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\\n/g, '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').replace(/\\n/g, '').trim();

const MIGRATIONS = [
  'CREATE INDEX IF NOT EXISTS idx_price_origin_departure ON cached_prices(origin, departure_date);',
  'CREATE INDEX IF NOT EXISTS idx_dest_active_iata ON destinations(is_active, iata_code);',
  'CREATE INDEX IF NOT EXISTS idx_cal_origin_score ON price_calendar(origin, deal_score DESC);',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const secret = req.headers.authorization?.replace('Bearer ', '');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  // Use Supabase's PostgREST /rpc endpoint won't work for DDL.
  // Instead, use the pg REST query endpoint via the management API.
  // Supabase exposes a /rest/v1/rpc endpoint, but for DDL we need the SQL editor API.
  // Simplest approach: use the Supabase client's .from() to test if indexes help,
  // and document manual steps.

  // Try each migration via Supabase's SQL execution (requires pg_net or custom function)
  const results: { sql: string; status: string }[] = [];

  for (const sql of MIGRATIONS) {
    try {
      // Use fetch to Supabase's pg/query endpoint (available on Pro plans)
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (resp.ok) {
        results.push({ sql, status: 'ok' });
      } else {
        const text = await resp.text();
        // If exec_sql doesn't exist, document the manual steps
        results.push({ sql, status: `failed: ${resp.status} — ${text.slice(0, 200)}` });
      }
    } catch (e) {
      results.push({ sql, status: `error: ${(e as Error).message}` });
    }
  }

  const allOk = results.every((r) => r.status === 'ok');
  if (!allOk) {
    return res.json({
      message: 'Some migrations need manual execution via Supabase SQL Editor',
      manual_sql: MIGRATIONS.join('\n'),
      results,
    });
  }

  return res.json({ message: 'All migrations applied', results });
}
