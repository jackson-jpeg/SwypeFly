/**
 * Creates Appwrite collections for the booking flow:
 * - bookings: stores confirmed bookings with Duffel order + Stripe payment refs
 * - booking_passengers: passenger details per booking
 *
 * Safe to re-run — skips collections/attributes/indexes that already exist (409 handling).
 *
 * Usage: npx tsx scripts/setup-booking-collections.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Client, Databases, Permission, Role, IndexType } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '';
const projectId =
  process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '';
const apiKey = process.env.APPWRITE_API_KEY ?? '';

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new Databases(client);
const DB = 'sogojet';

const BOOKINGS = 'bookings';
const PASSENGERS = 'booking_passengers';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safe(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`  + ${label}`);
  } catch (err: any) {
    if (err?.code === 409 || err?.message?.includes('already exists')) {
      console.log(`  ~ ${label} (already exists)`);
    } else {
      console.error(`  ! ${label}:`, err?.message || err);
    }
  }
}

async function createCollections() {
  console.log('\n--- Creating collections ---');

  await safe(`collection: ${BOOKINGS}`, () =>
    db.createCollection(DB, BOOKINGS, BOOKINGS, [
      Permission.read(Role.any()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ]),
  );

  await safe(`collection: ${PASSENGERS}`, () =>
    db.createCollection(DB, PASSENGERS, PASSENGERS, [
      Permission.read(Role.any()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ]),
  );

  // Appwrite needs time to initialize new collections before adding attributes
  console.log('  Waiting 2s for collection initialization...');
  await sleep(2000);
}

async function createBookingsAttributes() {
  console.log(`\n--- ${BOOKINGS} attributes ---`);

  // Required string attributes
  await safe('user_id', () => db.createStringAttribute(DB, BOOKINGS, 'user_id', 100, true));
  await safe('duffel_order_id', () =>
    db.createStringAttribute(DB, BOOKINGS, 'duffel_order_id', 100, true),
  );
  await safe('status', () => db.createStringAttribute(DB, BOOKINGS, 'status', 20, true));
  await safe('currency', () => db.createStringAttribute(DB, BOOKINGS, 'currency', 10, true));
  await safe('stripe_payment_intent_id', () =>
    db.createStringAttribute(DB, BOOKINGS, 'stripe_payment_intent_id', 100, true),
  );
  await safe('created_at', () => db.createStringAttribute(DB, BOOKINGS, 'created_at', 30, true));

  // Required numeric attributes
  await safe('total_amount', () => db.createFloatAttribute(DB, BOOKINGS, 'total_amount', true));
  await safe('passenger_count', () =>
    db.createIntegerAttribute(DB, BOOKINGS, 'passenger_count', true),
  );

  // Optional string attributes (for display in booking history)
  await safe('destination_city', () =>
    db.createStringAttribute(DB, BOOKINGS, 'destination_city', 100, false),
  );
  await safe('destination_iata', () =>
    db.createStringAttribute(DB, BOOKINGS, 'destination_iata', 10, false),
  );
  await safe('origin_iata', () =>
    db.createStringAttribute(DB, BOOKINGS, 'origin_iata', 10, false),
  );
  await safe('departure_date', () =>
    db.createStringAttribute(DB, BOOKINGS, 'departure_date', 20, false),
  );
  await safe('return_date', () => db.createStringAttribute(DB, BOOKINGS, 'return_date', 20, false));
  await safe('airline', () => db.createStringAttribute(DB, BOOKINGS, 'airline', 100, false));
  await safe('booking_reference', () =>
    db.createStringAttribute(DB, BOOKINGS, 'booking_reference', 20, false),
  );
}

async function createPassengersAttributes() {
  console.log(`\n--- ${PASSENGERS} attributes ---`);

  await safe('booking_id', () =>
    db.createStringAttribute(DB, PASSENGERS, 'booking_id', 100, true),
  );
  await safe('given_name', () =>
    db.createStringAttribute(DB, PASSENGERS, 'given_name', 100, true),
  );
  await safe('family_name', () =>
    db.createStringAttribute(DB, PASSENGERS, 'family_name', 100, true),
  );
  await safe('born_on', () => db.createStringAttribute(DB, PASSENGERS, 'born_on', 20, true));
  await safe('gender', () => db.createStringAttribute(DB, PASSENGERS, 'gender', 10, true));
  await safe('title', () => db.createStringAttribute(DB, PASSENGERS, 'title', 10, true));
  await safe('email', () => db.createStringAttribute(DB, PASSENGERS, 'email', 200, true));
  await safe('phone_number', () =>
    db.createStringAttribute(DB, PASSENGERS, 'phone_number', 30, true),
  );
}

async function createIndexes() {
  // Wait for attributes to be available before creating indexes
  console.log('\n  Waiting 2s for attributes to settle...');
  await sleep(2000);

  console.log(`\n--- ${BOOKINGS} indexes ---`);

  await safe('idx_user_id', () =>
    db.createIndex(DB, BOOKINGS, 'idx_user_id', IndexType.Key, ['user_id']),
  );
  await safe('idx_stripe_pi', () =>
    db.createIndex(DB, BOOKINGS, 'idx_stripe_pi', IndexType.Key, ['stripe_payment_intent_id']),
  );
  await safe('idx_status', () =>
    db.createIndex(DB, BOOKINGS, 'idx_status', IndexType.Key, ['status']),
  );

  console.log(`\n--- ${PASSENGERS} indexes ---`);

  await safe('idx_booking_id', () =>
    db.createIndex(DB, PASSENGERS, 'idx_booking_id', IndexType.Key, ['booking_id']),
  );
}

async function main() {
  console.log('Setting up booking collections in Appwrite...');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Project: ${projectId}`);

  await createCollections();
  await createBookingsAttributes();
  await createPassengersAttributes();
  await createIndexes();

  console.log('\nDone. Collections and attributes are provisioned.');
}

main().catch(console.error);
