/**
 * Seed preference vectors for existing users in Appwrite.
 * Maps traveler_type -> preference vector and budget_level -> budget_numeric.
 *
 * Run: npx tsx scripts/seed-user-prefs.ts
 */
import { Client, Databases, Query } from 'node-appwrite';
import fs from 'node:fs';
import path from 'node:path';

// Load .env.local
for (const envFile of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (!process.env[key.trim()]) process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '';
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new Databases(client);
const DB = 'sogojet';

const TYPE_TO_PREFS: Record<string, Record<string, number>> = {
  beach: { pref_beach: 0.9, pref_nature: 0.6, pref_city: 0.3, pref_adventure: 0.4, pref_culture: 0.3, pref_nightlife: 0.4, pref_food: 0.5 },
  city: { pref_city: 0.9, pref_nightlife: 0.7, pref_food: 0.6, pref_culture: 0.5, pref_beach: 0.3, pref_adventure: 0.3, pref_nature: 0.2 },
  adventure: { pref_adventure: 0.9, pref_nature: 0.7, pref_beach: 0.4, pref_culture: 0.4, pref_city: 0.2, pref_nightlife: 0.2, pref_food: 0.4 },
  culture: { pref_culture: 0.9, pref_food: 0.7, pref_city: 0.5, pref_adventure: 0.4, pref_nature: 0.3, pref_beach: 0.3, pref_nightlife: 0.3 },
};

const BUDGET_TO_NUMERIC: Record<string, number> = { budget: 1, comfortable: 2, luxury: 3 };

async function main() {
  const result = await db.listDocuments(DB, 'user_preferences', [Query.limit(500)]);

  console.log(`Processing ${result.documents.length} user preference rows...`);

  let updated = 0;
  for (const user of result.documents) {
    const travelerType = (user.traveler_type as string) || '';
    const prefs = TYPE_TO_PREFS[travelerType] || {};
    const budgetNumeric = BUDGET_TO_NUMERIC[(user.budget_level as string) || ''] || 2;

    try {
      await db.updateDocument(DB, 'user_preferences', user.$id, {
        ...prefs,
        budget_numeric: budgetNumeric,
      });
      updated++;
    } catch (err) {
      console.error(`Failed to update ${user.$id}:`, err);
    }
  }

  console.log(`Successfully updated ${updated}/${result.documents.length} user preferences.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
