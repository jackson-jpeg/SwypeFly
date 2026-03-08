/**
 * Creates Appwrite collections for the booking flow:
 * - bookings: stores confirmed bookings with Duffel order + Stripe payment refs
 * - booking_passengers: passenger details per booking
 *
 * Safe to re-run — skips collections/attributes that already exist (409 handling).
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

async function safe(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (err: any) {
    if (err?.code === 409 || err?.message?.includes('already exists')) {
      console.log(`⊘ ${label} (already exists)`);
    } else {
      console.error(`✗ ${label}:`, err?.message || err);
    }
  }
}

async function main() {
  // ─── Create collections ───────────────────────────────────────────
  await safe('collection: bookings', () =>
    db.createCollection(DB, 'bookings', 'bookings', [
      Permission.read(Role.any()),
    ]),
  );

  await safe('collection: booking_passengers', () =>
    db.createCollection(DB, 'booking_passengers', 'booking_passengers', [
      Permission.read(Role.any()),
    ]),
  );

  // ─── bookings attributes ─────────────────────────────────────────
  await safe('bookings.user_id', () =>
    db.createStringAttribute(DB, 'bookings', 'user_id', 100, true),
  );
  await safe('bookings.duffel_order_id', () =>
    db.createStringAttribute(DB, 'bookings', 'duffel_order_id', 100, false),
  );
  await safe('bookings.status', () =>
    db.createStringAttribute(DB, 'bookings', 'status', 20, true),
  );
  await safe('bookings.total_amount', () =>
    db.createFloatAttribute(DB, 'bookings', 'total_amount', true),
  );
  await safe('bookings.currency', () =>
    db.createStringAttribute(DB, 'bookings', 'currency', 10, true),
  );
  await safe('bookings.passenger_count', () =>
    db.createIntegerAttribute(DB, 'bookings', 'passenger_count', true),
  );
  await safe('bookings.stripe_payment_intent_id', () =>
    db.createStringAttribute(DB, 'bookings', 'stripe_payment_intent_id', 100, false),
  );
  await safe('bookings.created_at', () =>
    db.createStringAttribute(DB, 'bookings', 'created_at', 30, false),
  );

  // ─── bookings indexes ────────────────────────────────────────────
  // Wait for attributes to be ready
  console.log('\nWaiting 3s for attributes to provision...');
  await new Promise((r) => setTimeout(r, 3000));

  await safe('index: bookings.stripe_payment_intent_id', () =>
    db.createIndex(DB, 'bookings', 'idx_stripe_pi', IndexType.Key, ['stripe_payment_intent_id']),
  );
  await safe('index: bookings.user_id', () =>
    db.createIndex(DB, 'bookings', 'idx_user_id', IndexType.Key, ['user_id']),
  );

  // ─── booking_passengers attributes ────────────────────────────────
  await safe('booking_passengers.booking_id', () =>
    db.createStringAttribute(DB, 'booking_passengers', 'booking_id', 100, true),
  );
  await safe('booking_passengers.given_name', () =>
    db.createStringAttribute(DB, 'booking_passengers', 'given_name', 100, true),
  );
  await safe('booking_passengers.family_name', () =>
    db.createStringAttribute(DB, 'booking_passengers', 'family_name', 100, true),
  );
  await safe('booking_passengers.born_on', () =>
    db.createStringAttribute(DB, 'booking_passengers', 'born_on', 20, false),
  );
  await safe('booking_passengers.gender', () =>
    db.createStringAttribute(DB, 'booking_passengers', 'gender', 10, false),
  );
  await safe('booking_passengers.title', () =>
    db.createStringAttribute(DB, 'booking_passengers', 'title', 10, false),
  );
  await safe('booking_passengers.email', () =>
    db.createStringAttribute(DB, 'booking_passengers', 'email', 200, false),
  );
  await safe('booking_passengers.phone_number', () =>
    db.createStringAttribute(DB, 'booking_passengers', 'phone_number', 30, false),
  );

  // ─── booking_passengers indexes ───────────────────────────────────
  console.log('\nWaiting 3s for passenger attributes...');
  await new Promise((r) => setTimeout(r, 3000));

  await safe('index: booking_passengers.booking_id', () =>
    db.createIndex(
      DB,
      'booking_passengers',
      'idx_booking_id',
      IndexType.Key,
      ['booking_id'],
    ),
  );

  console.log('\nDone. Collections and attributes are provisioned.');
}

main().catch(console.error);
