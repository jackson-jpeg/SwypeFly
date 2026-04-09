import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from './_cors.js';
import { logApiError } from '../utils/apiLogger';
import { sendError } from '../utils/apiResponse';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { verifyClerkToken } from '../utils/clerkAuth';
import { supabase, TABLES } from '../services/supabaseServer';
import { travelerCreateSchema, travelerUpdateSchema, validateRequest } from '../utils/validation';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ─── Saved Travelers Endpoint ──────────────────────────────────────────────
// CRUD operations for saved traveler profiles.
// Passport numbers are encrypted at rest using AES-256-GCM.

import { env } from '../utils/env';

const MAX_TRAVELERS_PER_USER = 10;
const ENCRYPTION_KEY = env.TRAVELER_ENCRYPTION_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  // Rate limit: 30 req/min per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`travelers:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests');
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'list':
        if (req.method !== 'GET') return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
        return await handleList(req, res);
      case 'create':
        if (req.method !== 'POST') return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
        return await handleCreate(req, res);
      case 'update':
        if (req.method !== 'PATCH') return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
        return await handleUpdate(req, res);
      case 'delete':
        if (req.method !== 'DELETE') return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
        return await handleDelete(req, res);
      default:
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid action. Use ?action=list|create|update|delete');
    }
  } catch (err) {
    logApiError('api/travelers', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to process traveler request');
  }
}

// ─── Encryption Helpers ────────────────────────────────────────────────────

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY || !text) return text;
  try {
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch {
    console.warn('[travelers] Encryption failed, storing plaintext');
    return text;
  }
}

function decrypt(encrypted: string): string {
  if (!ENCRYPTION_KEY || !encrypted || !encrypted.includes(':')) return encrypted;
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) return encrypted;
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const data = Buffer.from(parts[2], 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf8');
  } catch {
    return encrypted;
  }
}

// ─── Handlers ──────────────────────────────────────────────────────────────

interface TravelerRow {
  id: string;
  user_id: string;
  given_name: string;
  family_name: string;
  born_on: string | null;
  gender: string | null;
  title: string | null;
  email: string | null;
  phone_number: string | null;
  passport_number_encrypted: string | null;
  passport_expiry: string | null;
  nationality: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

function toFrontend(row: TravelerRow) {
  return {
    id: row.id,
    givenName: row.given_name,
    familyName: row.family_name,
    bornOn: row.born_on,
    gender: row.gender,
    title: row.title,
    email: row.email,
    phoneNumber: row.phone_number,
    passportNumber: row.passport_number_encrypted ? decrypt(row.passport_number_encrypted) : null,
    passportExpiry: row.passport_expiry,
    nationality: row.nationality,
    isPrimary: row.is_primary,
  };
}

async function handleList(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await verifyClerkToken(req.headers.authorization as string | undefined);
    if (!auth) return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');

    const { data, error } = await supabase
      .from(TABLES.savedTravelers)
      .select('*')
      .eq('user_id', auth.userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(MAX_TRAVELERS_PER_USER);

    if (error) throw error;

    return res.status(200).json({
      travelers: (data ?? []).map((row) => toFrontend(row as TravelerRow)),
    });
  } catch (err) {
    logApiError('api/travelers/list', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch travelers');
  }
}

async function handleCreate(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await verifyClerkToken(req.headers.authorization as string | undefined);
    if (!auth) return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');

    const v = validateRequest(travelerCreateSchema, req.body);
    if (!v.success) return sendError(res, 400, 'VALIDATION_ERROR', v.error);
    const body = v.data;

    // Check count limit
    const { count } = await supabase
      .from(TABLES.savedTravelers)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.userId);

    if ((count ?? 0) >= MAX_TRAVELERS_PER_USER) {
      return sendError(res, 400, 'VALIDATION_ERROR', `Maximum ${MAX_TRAVELERS_PER_USER} travelers allowed`);
    }

    // Check if this is the first traveler (auto-set as primary)
    const isPrimary = (count ?? 0) === 0;

    const { data, error } = await supabase
      .from(TABLES.savedTravelers)
      .insert({
        user_id: auth.userId,
        given_name: body.givenName.trim(),
        family_name: body.familyName.trim(),
        born_on: body.bornOn || null,
        gender: body.gender || null,
        title: body.title || null,
        email: body.email?.trim() || null,
        phone_number: body.phoneNumber?.trim() || null,
        passport_number_encrypted: body.passportNumber ? encrypt(body.passportNumber.trim()) : null,
        passport_expiry: body.passportExpiry || null,
        nationality: body.nationality || 'US',
        is_primary: isPrimary,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ traveler: toFrontend(data as TravelerRow) });
  } catch (err) {
    logApiError('api/travelers/create', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to create traveler');
  }
}

async function handleUpdate(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await verifyClerkToken(req.headers.authorization as string | undefined);
    if (!auth) return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');

    const { id } = req.query as { id: string };
    if (!id) return sendError(res, 400, 'VALIDATION_ERROR', 'Missing traveler id');

    const v = validateRequest(travelerUpdateSchema, req.body);
    if (!v.success) return sendError(res, 400, 'VALIDATION_ERROR', v.error);
    const body = v.data;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.givenName !== undefined) updates.given_name = body.givenName.trim();
    if (body.familyName !== undefined) updates.family_name = body.familyName.trim();
    if (body.bornOn !== undefined) updates.born_on = body.bornOn || null;
    if (body.gender !== undefined) updates.gender = body.gender || null;
    if (body.title !== undefined) updates.title = body.title || null;
    if (body.email !== undefined) updates.email = body.email?.trim() || null;
    if (body.phoneNumber !== undefined) updates.phone_number = body.phoneNumber?.trim() || null;
    if (body.passportNumber !== undefined) {
      updates.passport_number_encrypted = body.passportNumber ? encrypt(body.passportNumber.trim()) : null;
    }
    if (body.passportExpiry !== undefined) updates.passport_expiry = body.passportExpiry || null;
    if (body.nationality !== undefined) updates.nationality = body.nationality || 'US';

    const { data, error } = await supabase
      .from(TABLES.savedTravelers)
      .update(updates)
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return sendError(res, 404, 'NOT_FOUND', 'Traveler not found');

    return res.status(200).json({ traveler: toFrontend(data as TravelerRow) });
  } catch (err) {
    logApiError('api/travelers/update', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to update traveler');
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await verifyClerkToken(req.headers.authorization as string | undefined);
    if (!auth) return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');

    const { id } = req.query as { id: string };
    if (!id) return sendError(res, 400, 'VALIDATION_ERROR', 'Missing traveler id');

    const { error } = await supabase
      .from(TABLES.savedTravelers)
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId);

    if (error) throw error;

    return res.status(200).json({ deleted: true });
  } catch (err) {
    logApiError('api/travelers/delete', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to delete traveler');
  }
}
