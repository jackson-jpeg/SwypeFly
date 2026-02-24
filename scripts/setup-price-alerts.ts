/**
 * Create the price_alerts collection in Appwrite.
 * Run: npx tsx scripts/setup-price-alerts.ts
 */
import { Client, Databases, ID, Permission, Role } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
  .setProject(process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '')
  .setKey(process.env.APPWRITE_API_KEY ?? '');

const db = new Databases(client);
const DATABASE_ID = 'sogojet';
const COLLECTION_ID = 'price_alerts';

async function main() {
  console.log('Creating price_alerts collection...');

  try {
    await db.createCollection(DATABASE_ID, COLLECTION_ID, 'Price Alerts', [
      Permission.read(Role.any()),
      Permission.create(Role.any()),
      Permission.update(Role.any()),
    ]);
    console.log('✅ Collection created');
  } catch (e: any) {
    if (e.code === 409) {
      console.log('Collection already exists, adding attributes...');
    } else {
      throw e;
    }
  }

  const attrs = [
    () => db.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'user_id', 255, false),
    () => db.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'email', 320, false),
    () => db.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'destination_id', 255, true),
    () => db.createFloatAttribute(DATABASE_ID, COLLECTION_ID, 'target_price', true),
    () => db.createBooleanAttribute(DATABASE_ID, COLLECTION_ID, 'is_active', true),
    () => db.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'created_at', true),
    () => db.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'triggered_at', false),
    () => db.createFloatAttribute(DATABASE_ID, COLLECTION_ID, 'triggered_price', false),
  ];

  for (const create of attrs) {
    try {
      await create();
      console.log('  ✅ Attribute created');
    } catch (e: any) {
      if (e.code === 409) console.log('  ⏭️ Attribute already exists');
      else console.error('  ❌', e.message);
    }
  }

  // Index on destination_id + is_active for the cron check
  try {
    await db.createIndex(DATABASE_ID, COLLECTION_ID, 'idx_active', 'key' as any, ['is_active', 'destination_id']);
    console.log('✅ Index created');
  } catch (e: any) {
    if (e.code === 409) console.log('Index already exists');
    else console.error('Index error:', e.message);
  }

  console.log('\nDone! Run the price alert check cron: GET /api/alerts/check?secret=YOUR_CRON_SECRET');
}

main().catch(console.error);
