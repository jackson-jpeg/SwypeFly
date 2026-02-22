/**
 * Add 'approved' (boolean, nullable) and 'hidden' (boolean, default false)
 * attributes to the destinations collection.
 * Run: npx tsx scripts/add-audit-fields.ts
 */
import fs from 'node:fs';
import path from 'node:path';

for (const envFile of ['.env', '.env.local']) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const ENDPOINT = process.env.APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;
const DATABASE_ID = 'sogojet';
const COLLECTION_ID = 'destinations';

async function api(method: string, apiPath: string, body?: unknown) {
  const res = await fetch(`${ENDPOINT}${apiPath}`, {
    method,
    headers: {
      'X-Appwrite-Project': PROJECT_ID,
      'X-Appwrite-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok && res.status !== 409) throw new Error(`${res.status}: ${text}`);
  if (res.status === 409) { console.log('  (already exists)'); return null; }
  return text ? JSON.parse(text) : null;
}

async function main() {
  const basePath = `/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/attributes`;

  console.log('Adding "approved" boolean attribute...');
  await api('POST', `${basePath}/boolean`, {
    key: 'approved',
    required: false,
    default: null,
  });
  console.log('  ✓ approved');

  console.log('Adding "hidden" boolean attribute...');
  await api('POST', `${basePath}/boolean`, {
    key: 'hidden',
    required: false,
    default: false,
  });
  console.log('  ✓ hidden');

  console.log('Done! Attributes may take a moment to become available.');
}

main().catch(console.error);
