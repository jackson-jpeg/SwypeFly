// ─── Stripe Payment Service Layer ───────────────────────────────────────────
// Payment collection for flight bookings via Stripe.

import Stripe from 'stripe';
import { env } from '../utils/env';

const STRIPE_SECRET_KEY = (env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_WEBHOOK_SECRET = (env.STRIPE_WEBHOOK_SECRET || '').trim();

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
    });
  }
  return _stripe;
}

// ─── Create Payment Intent ──────────────────────────────────────────────────

export async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: Record<string, string>,
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe();

  const paymentIntent = await stripe.paymentIntents.create({
    amount, // in smallest currency unit (cents)
    currency: currency.toLowerCase(),
    metadata,
    automatic_payment_methods: { enabled: true },
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

// ─── Retrieve Payment Intent ────────────────────────────────────────────────

export async function getPaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

// ─── Auto-confirm Payment Intent (test mode) ───────────────────────────────
// Used when client-side Stripe Elements aren't wired up yet.
// Only works with Stripe test keys (sk_test_*).

export async function autoConfirmPaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  return stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: 'pm_card_visa',
  });
}

// ─── Refund Payment Intent ──────────────────────────────────────────────────
// Issues a full refund for a payment intent (e.g., when order creation fails after payment).

export async function refundPaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
  });
}

// ─── Verify Webhook Signature ───────────────────────────────────────────────

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();

  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}
