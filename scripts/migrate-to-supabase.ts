/**
 * Migrate all data from Appwrite to Supabase.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-supabase.ts
 *
 * Requires env vars (from .env.local):
 *   APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from 'node:fs';
import path from 'node:path';

// Load .env.local
for (const envFile of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Strip literal \n that some env files have
      val = val.replace(/\\n/g, '').trim();
      process.env[key] = val;
    }
  }
}

// ─── Appwrite config ─────────────────────────────────────
const AW_ENDPOINT = process.env.APPWRITE_ENDPOINT?.trim() || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT?.trim() || '';
const AW_PROJECT = process.env.APPWRITE_PROJECT_ID?.trim() || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID?.trim() || '';
const AW_KEY = process.env.APPWRITE_API_KEY?.trim() || '';
const AW_DB = 'sogojet';

// ─── Supabase config ─────────────────────────────────────
const SB_URL = process.env.SUPABASE_URL?.trim() || '';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

if (!AW_ENDPOINT || !AW_PROJECT || !AW_KEY) {
  console.error('Missing Appwrite credentials');
  process.exit(1);
}
if (!SB_URL || !SB_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

console.log('=== SoGoJet: Appwrite -> Supabase Migration ===\n');
console.log(`Appwrite: ${AW_ENDPOINT}`);
console.log(`Supabase: ${SB_URL}\n`);

// ─── Appwrite REST helpers ───────────────────────────────

async function awList(collection: string, queries: string[] = [], limit = 100, offset = 0): Promise<any> {
  const params = new URLSearchParams();
  for (const q of queries) params.append('queries[]', q);
  params.set('queries[]', JSON.stringify({ method: 'limit', values: [limit] }));

  const url = `${AW_ENDPOINT}/databases/${AW_DB}/collections/${collection}/documents?limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      'X-Appwrite-Project': AW_PROJECT,
      'X-Appwrite-Key': AW_KEY,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Appwrite ${collection} list failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function awListAll(collection: string): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const batchSize = 100;

  while (true) {
    const params = new URLSearchParams();
    params.append('queries[]', JSON.stringify({ method: 'limit', values: [batchSize] }));
    params.append('queries[]', JSON.stringify({ method: 'offset', values: [offset] }));
    const url = `${AW_ENDPOINT}/databases/${AW_DB}/collections/${collection}/documents?${params}`;
    const res = await fetch(url, {
      headers: {
        'X-Appwrite-Project': AW_PROJECT,
        'X-Appwrite-Key': AW_KEY,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Appwrite ${collection} list failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    all.push(...data.documents);

    if (data.documents.length < batchSize) break;
    offset += batchSize;
  }

  return all;
}

// ─── Supabase REST helpers ───────────────────────────────

async function sbInsertBatch(table: string, rows: any[]): Promise<number> {
  if (rows.length === 0) return 0;

  // Supabase REST API has a reasonable batch size limit
  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`  Supabase insert error for ${table} (batch ${i}): ${text}`);
      // Try individual inserts for the failed batch
      for (const row of batch) {
        try {
          const r2 = await fetch(`${SB_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              'apikey': SB_KEY,
              'Authorization': `Bearer ${SB_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify(row),
          });
          if (r2.ok) inserted++;
          else {
            const t2 = await r2.text();
            console.error(`    Individual insert failed: ${t2.slice(0, 200)}`);
          }
        } catch {}
      }
      continue;
    }
    inserted += batch.length;
  }

  return inserted;
}

// ─── Field mapping: strip Appwrite metadata, keep data fields ───

function stripAppwriteMeta(doc: any): any {
  const clean: any = {};
  for (const [key, value] of Object.entries(doc)) {
    // Skip Appwrite metadata fields
    if (key.startsWith('$')) continue;
    clean[key] = value;
  }
  return clean;
}

function mapDestination(doc: any): any {
  const clean = stripAppwriteMeta(doc);
  clean.id = doc.$id;
  // Ensure arrays are proper arrays
  if (clean.image_urls && !Array.isArray(clean.image_urls)) clean.image_urls = [];
  if (clean.vibe_tags && !Array.isArray(clean.vibe_tags)) clean.vibe_tags = [];
  if (clean.best_months && !Array.isArray(clean.best_months)) clean.best_months = [];
  if (clean.available_flight_days && !Array.isArray(clean.available_flight_days)) clean.available_flight_days = [];
  return clean;
}

function mapGeneric(doc: any): any {
  const clean = stripAppwriteMeta(doc);
  clean.id = doc.$id;
  return clean;
}

// ─── Collection migration configs ────────────────────────

interface MigrationConfig {
  appwriteCollection: string;
  supabaseTable: string;
  mapper: (doc: any) => any;
}

const migrations: MigrationConfig[] = [
  { appwriteCollection: 'destinations', supabaseTable: 'destinations', mapper: mapDestination },
  { appwriteCollection: 'saved_trips', supabaseTable: 'saved_trips', mapper: mapGeneric },
  { appwriteCollection: 'user_preferences', supabaseTable: 'user_preferences', mapper: mapGeneric },
  { appwriteCollection: 'swipe_history', supabaseTable: 'swipe_history', mapper: mapGeneric },
  { appwriteCollection: 'cached_prices', supabaseTable: 'cached_prices', mapper: mapGeneric },
  { appwriteCollection: 'cached_hotel_prices', supabaseTable: 'cached_hotel_prices', mapper: mapGeneric },
  { appwriteCollection: 'destination_images', supabaseTable: 'destination_images', mapper: mapGeneric },
  { appwriteCollection: 'ai_cache', supabaseTable: 'ai_cache', mapper: mapGeneric },
  { appwriteCollection: 'price_alerts', supabaseTable: 'price_alerts', mapper: mapGeneric },
  { appwriteCollection: 'subscribers', supabaseTable: 'subscribers', mapper: mapGeneric },
  { appwriteCollection: 'bookings', supabaseTable: 'bookings', mapper: mapGeneric },
  { appwriteCollection: 'booking_passengers', supabaseTable: 'booking_passengers', mapper: mapGeneric },
  { appwriteCollection: 'price_calendar', supabaseTable: 'price_calendar', mapper: mapGeneric },
  { appwriteCollection: 'price_history_stats', supabaseTable: 'price_history_stats', mapper: mapGeneric },
];

// ─── Main ────────────────────────────────────────────────

async function main() {
  const exportDir = path.resolve(process.cwd(), 'scripts/appwrite-export');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  let totalExported = 0;
  let totalImported = 0;

  for (const config of migrations) {
    const { appwriteCollection, supabaseTable, mapper } = config;

    process.stdout.write(`[${appwriteCollection}] Exporting...`);

    try {
      const docs = await awListAll(appwriteCollection);
      process.stdout.write(` ${docs.length} docs`);

      // Save export for safety
      fs.writeFileSync(
        path.join(exportDir, `${appwriteCollection}.json`),
        JSON.stringify(docs, null, 2)
      );
      totalExported += docs.length;

      if (docs.length === 0) {
        console.log(' (empty, skipping)');
        continue;
      }

      // Map to Supabase format
      const rows = docs.map(mapper);

      // Remove any keys with undefined values (Supabase doesn't like them)
      for (const row of rows) {
        for (const key of Object.keys(row)) {
          if (row[key] === undefined) delete row[key];
        }
      }

      process.stdout.write(' -> Importing...');
      const inserted = await sbInsertBatch(supabaseTable, rows);
      console.log(` ${inserted} rows inserted`);
      totalImported += inserted;
    } catch (err: any) {
      console.log(` ERROR: ${err.message}`);
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Exported: ${totalExported} documents from Appwrite`);
  console.log(`Imported: ${totalImported} rows into Supabase`);
  console.log(`\nExport backup saved to: scripts/appwrite-export/`);
}

main().catch(err => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
