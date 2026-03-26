// Newsletter subscriber registration — public endpoint.
// POST /api/subscribe { email: string }
// GET /api/subscribe?action=unsubscribe&email=...&token=...
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { cors } from './_cors.js';
import { z } from 'zod';

const subscribeSchema = z.object({
  email: z.string().email().max(254),
});

// Simple rate limiting — in-memory, per-IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // per minute
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  // ─── Unsubscribe (GET) ──────────────────────────────────────────
  if (req.method === 'GET' && req.query.action === 'unsubscribe') {
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
      const { data: existing } = await supabase
        .from(TABLES.subscribers)
        .select('id')
        .eq('email', email)
        .limit(1);
      if (existing && existing.length > 0) {
        await supabase
          .from(TABLES.subscribers)
          .update({ active: false, unsubscribed_at: new Date().toISOString() })
          .eq('id', existing[0].id);
      }
      // Return friendly HTML
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(`<!DOCTYPE html>
<html>
<head><title>Unsubscribed — SoGoJet</title></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;background:#0A0806;color:#FFF8F0;">
  <div style="text-align:center;max-width:400px;">
    <h1 style="color:#A8C4B8;">You've been unsubscribed</h1>
    <p style="color:#8B7D6B;">You won't receive any more deal newsletters from SoGoJet. We'll miss you!</p>
    <a href="https://sogojet.com" style="color:#F7E8A0;">← Back to SoGoJet</a>
  </div>
</body>
</html>`);
    } catch (err) {
      console.error('[subscribe] Unsubscribe error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }

  // ─── Subscribe (POST) ──────────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Rate limit
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const email = parsed.data.email.toLowerCase().trim();

  try {
    // Check for existing subscriber
    const { data: existingRows } = await supabase
      .from(TABLES.subscribers)
      .select('*')
      .eq('email', email)
      .limit(1);

    if (existingRows && existingRows.length > 0) {
      const doc = existingRows[0];
      if (doc.active) {
        return res.status(200).json({ message: 'Already subscribed!', subscribed: true });
      }
      // Re-activate
      await supabase
        .from(TABLES.subscribers)
        .update({ active: true, resubscribed_at: new Date().toISOString() })
        .eq('id', doc.id);
      return res.status(200).json({ message: 'Welcome back! You\'re resubscribed.', subscribed: true });
    }

    // Create new subscriber
    const { error: insertErr } = await supabase
      .from(TABLES.subscribers)
      .insert({
        email,
        active: true,
        subscribed_at: new Date().toISOString(),
        source: 'web',
      });
    if (insertErr) throw insertErr;

    return res.status(201).json({
      message: 'You\'re in! Watch your inbox for the best flight deals.',
      subscribed: true,
    });
  } catch (err) {
    console.error('[subscribe] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
