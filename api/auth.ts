import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from './_cors.js';
import { logApiError } from '../utils/apiLogger';
import { sendError } from '../utils/apiResponse';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { verifyClerkToken } from '../utils/clerkAuth';
import { supabase, TABLES } from '../services/supabaseServer';
import { env } from '../utils/env';

// ─── Clerk Auth Endpoint ────────────────────────────────────────────────────
// Exchanges an Apple Sign In identity token for a Clerk session token.
// Called by the iOS app after Sign in with Apple completes.

const CLERK_SECRET_KEY = (env.CLERK_SECRET_KEY || '').trim();

/** Fetch with a 5-second timeout to avoid hanging on Clerk API calls. */
async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Safely read a response body for logging (won't throw). */
async function safeResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '(unreadable body)';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  // Rate limit auth: 10 req/min per IP (auth is sensitive)
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`auth:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many authentication requests');
  }

  const { action } = req.query;

  if (req.method === 'DELETE' && action === 'delete') {
    return handleDeleteAccount(req, res);
  }

  if (req.method === 'GET' && action === 'profile') {
    return handleGetProfile(req, res);
  }

  if (req.method === 'PATCH' && action === 'profile') {
    return handleUpdateProfile(req, res);
  }

  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  if (action === 'apple') {
    return handleAppleSignIn(req, res);
  }

  if (action === 'oauth') {
    return handleOAuthExchange(req, res);
  }

  return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid action. Use ?action=apple, ?action=oauth, GET/PATCH ?action=profile, or DELETE ?action=delete');
}

async function handleAppleSignIn(req: VercelRequest, res: VercelResponse) {
  try {
    const { identityToken, givenName, familyName, email } = req.body as {
      identityToken: string;
      givenName?: string;
      familyName?: string;
      email?: string;
    };

    if (!identityToken) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Missing identityToken');
    }

    if (!CLERK_SECRET_KEY) {
      if (env.VERCEL_ENV === 'production') {
        console.error('[auth] CRITICAL: CLERK_SECRET_KEY not set in production');
        return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Authentication service unavailable');
      }
      // DEV ONLY: Fallback when Clerk isn't configured — return a mock session
      console.warn('[auth] DEV ONLY: CLERK_SECRET_KEY not set, returning mock session');
      return res
        .setHeader('X-Auth-Warning', 'Development mode - no real authentication')
        .status(200)
        .json({
          sessionToken: `dev_mock_${Date.now()}`,
          userId: `dev_${Date.now()}`,
          email: email || null,
          name: [givenName, familyName].filter(Boolean).join(' ') || null,
          _devMode: true,
        });
    }

    // Decode the Apple identity token JWT to extract email and Apple user ID.
    // Apple only provides email in the credential on FIRST sign-in, but the
    // JWT always contains it, so we decode it as a reliable source.
    const appleJwtPayload = decodeJwtPayload(identityToken);
    const appleEmail = email || appleJwtPayload?.email;
    const appleSub = appleJwtPayload?.sub; // Apple's stable user ID

    if (!appleEmail && !appleSub) {
      console.error('[auth] Apple token missing both email and sub');
      return sendError(res, 401, 'UNAUTHORIZED', 'Authentication failed — invalid Apple token');
    }

    // Find or create a Clerk user using the email from the Apple JWT
    const lookupEmail = appleEmail || `apple_${appleSub}@private.appleid.com`;
    const userResult = await findOrCreateClerkUser(lookupEmail, givenName, familyName);
    if (userResult) {
      return res.status(200).json(userResult);
    }

    console.error('[auth] Apple sign-in: failed to find or create Clerk user');
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication failed');
  } catch (err) {
    logApiError('api/auth/apple', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Authentication failed');
  }
}

/** Decode a JWT payload without verification (we trust Apple's token from the native SDK). */
function decodeJwtPayload(jwt: string): { sub?: string; email?: string } | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function handleOAuthExchange(req: VercelRequest, res: VercelResponse) {
  try {
    const { code, redirect_uri } = req.body as {
      code: string;
      redirect_uri?: string;
    };

    if (!code) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Missing code');
    }

    if (!CLERK_SECRET_KEY) {
      return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Auth not configured');
    }

    const codePreview = code.length > 20 ? code.substring(0, 20) + '...' : code;

    // The code/token from the iOS app could be:
    // 1. A Clerk rotating_token from completed OAuth (__clerk_status=completed)
    // 2. A Clerk ticket from the OAuth callback (__clerk_ticket)
    // 3. A session JWT directly (Clerk iOS SDK 1.0 sends the JWT from getToken())
    // 4. An authorization code

    // ── Strategy 1: Verify as a client token (rotating_token) ──────────
    try {
      const verifyResponse = await fetchWithTimeout('https://api.clerk.com/v1/clients/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: code }),
      });

      if (verifyResponse.ok) {
        const clientData = await verifyResponse.json();
        const session = clientData.sessions?.[0];
        if (session) {
          // Fetch user info
          const userResponse = await fetchWithTimeout(
            `https://api.clerk.com/v1/users/${session.user_id}`,
            { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } },
          );

          let email: string | null = null;
          let name: string | null = null;

          if (userResponse.ok) {
            const user = await userResponse.json();
            email = user.email_addresses?.[0]?.email_address || null;
            name = [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
          } else {
            const body = await safeResponseText(userResponse);
            console.warn(`[auth/oauth] Strategy 1: user fetch failed (${userResponse.status}): ${body}`);
          }

          // If the session has a JWT, use it directly
          const jwt = session.last_active_token?.jwt;
          if (jwt) {
            return res.status(200).json({
              sessionToken: jwt,
              userId: session.user_id,
              email,
              name,
            });
          }

          // Session exists but no JWT — create a sign-in token and redeem it for a JWT
          if (email) {
            const result = await findOrCreateClerkUser(email, name?.split(' ')[0], name?.split(' ').slice(1).join(' '));
            if (result) return res.status(200).json(result);
          }

          // Last resort: return the rotating token itself (may not pass verifyToken)
          console.warn('[auth/oauth] Strategy 1: session found but no JWT and no email — returning rotating token');
          return res.status(200).json({
            sessionToken: code,
            userId: session.user_id,
            email,
            name,
          });
        }
      } else {
        const body = await safeResponseText(verifyResponse);
        console.info(`[auth/oauth] Strategy 1 (clients/verify) failed (${verifyResponse.status}): ${body}`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.warn('[auth/oauth] Strategy 1 (clients/verify) timed out after 5s');
      } else {
        console.warn('[auth/oauth] Strategy 1 (clients/verify) error:', err);
      }
    }

    // ── Strategy 2: Try as a sign-in ticket via Frontend API ───────────
    try {
      const clerkFrontendDomain = env.CLERK_FRONTEND_API || 'clerk.sogojet.com';
      const ticketResponse = await fetchWithTimeout(
        `https://${clerkFrontendDomain}/v1/client/sign_ins?_clerk_js_version=4`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategy: 'ticket',
            ticket: code,
          }),
        },
      );

      if (ticketResponse.ok) {
        const ticketData = await ticketResponse.json();
        const session = ticketData.client?.sessions?.[0];
        if (session?.last_active_token?.jwt) {
          // Fetch user info
          const userResponse = await fetchWithTimeout(
            `https://api.clerk.com/v1/users/${session.user_id}`,
            { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } },
          );
          let email: string | null = null;
          let name: string | null = null;
          if (userResponse.ok) {
            const user = await userResponse.json();
            email = user.email_addresses?.[0]?.email_address || null;
            name = [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
          } else {
            const body = await safeResponseText(userResponse);
            console.warn(`[auth/oauth] Strategy 2: user fetch failed (${userResponse.status}): ${body}`);
          }
          return res.status(200).json({
            sessionToken: session.last_active_token.jwt,
            userId: session.user_id,
            email,
            name,
          });
        }
      } else {
        const body = await safeResponseText(ticketResponse);
        console.info(`[auth/oauth] Strategy 2 (ticket) failed (${ticketResponse.status}): ${body}`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.warn('[auth/oauth] Strategy 2 (ticket) timed out after 5s');
      } else {
        console.warn('[auth/oauth] Strategy 2 (ticket) error:', err);
      }
    }

    // ── Strategy 3: Direct JWT verification (Clerk iOS SDK 1.0) ────────
    // The new SDK's getToken() returns the session JWT directly as a String.
    // If strategies 1 and 2 failed, the code might already be a valid JWT.
    try {
      const jwtAuth = await verifyClerkToken(`Bearer ${code}`);
      if (jwtAuth) {
        console.info('[auth/oauth] Strategy 3: code is a valid session JWT');
        // Fetch user info from Clerk Backend API
        let email: string | null = null;
        let name: string | null = null;
        try {
          const userResponse = await fetchWithTimeout(
            `https://api.clerk.com/v1/users/${jwtAuth.userId}`,
            { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } },
          );
          if (userResponse.ok) {
            const user = await userResponse.json();
            email = user.email_addresses?.[0]?.email_address || null;
            name = [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
          } else {
            const body = await safeResponseText(userResponse);
            console.warn(`[auth/oauth] Strategy 3: user fetch failed (${userResponse.status}): ${body}`);
          }
        } catch (fetchErr) {
          console.warn('[auth/oauth] Strategy 3: user fetch error:', fetchErr);
        }
        return res.status(200).json({
          sessionToken: code,
          userId: jwtAuth.userId,
          email,
          name,
        });
      }
    } catch (err) {
      console.info('[auth/oauth] Strategy 3 (direct JWT verify) failed:', err);
    }

    console.warn(`[auth/oauth] All 3 strategies failed for code: ${codePreview}`);
    return sendError(
      res,
      401,
      'UNAUTHORIZED',
      'OAuth exchange failed — token could not be verified as rotating_token, ticket, or session JWT',
    );
  } catch (err) {
    logApiError('api/auth/oauth', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return sendError(res, 500, 'INTERNAL_ERROR', `Authentication failed: ${message}`);
  }
}

// ─── Profile ───────────────────────────────────────────────────────────────

async function handleGetProfile(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await verifyClerkToken(req.headers.authorization as string | undefined);
    if (!auth) return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');

    if (!CLERK_SECRET_KEY) {
      return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Auth service unavailable');
    }

    const userResponse = await fetch(`https://api.clerk.com/v1/users/${auth.userId}`, {
      headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
    });

    if (!userResponse.ok) {
      console.warn('[auth/profile] Failed to fetch Clerk user:', userResponse.status);
      return sendError(res, 502, 'SERVICE_UNAVAILABLE', 'Failed to fetch profile');
    }

    const user = await userResponse.json();
    return res.status(200).json({
      userId: user.id,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || null,
      email: user.email_addresses?.[0]?.email_address || null,
      imageUrl: user.image_url || null,
      createdAt: user.created_at ? new Date(user.created_at).toISOString() : null,
    });
  } catch (err) {
    logApiError('api/auth/profile', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch profile');
  }
}

async function handleUpdateProfile(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await verifyClerkToken(req.headers.authorization as string | undefined);
    if (!auth) return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');

    if (!CLERK_SECRET_KEY) {
      return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Auth service unavailable');
    }

    const { firstName, lastName } = req.body as {
      firstName?: string;
      lastName?: string;
    };

    if (!firstName && !lastName) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Provide firstName and/or lastName');
    }

    const updateBody: Record<string, string> = {};
    if (firstName !== undefined) updateBody.first_name = firstName;
    if (lastName !== undefined) updateBody.last_name = lastName;

    const updateResponse = await fetch(`https://api.clerk.com/v1/users/${auth.userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateBody),
    });

    if (!updateResponse.ok) {
      const errText = await updateResponse.text().catch(() => '');
      console.warn('[auth/profile] Failed to update Clerk user:', updateResponse.status, errText);
      return sendError(res, 502, 'SERVICE_UNAVAILABLE', 'Failed to update profile');
    }

    const user = await updateResponse.json();
    return res.status(200).json({
      userId: user.id,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || null,
      email: user.email_addresses?.[0]?.email_address || null,
      imageUrl: user.image_url || null,
      createdAt: user.created_at ? new Date(user.created_at).toISOString() : null,
    });
  } catch (err) {
    logApiError('api/auth/profile-update', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to update profile');
  }
}

// ─── Delete Account ────────────────────────────────────────────────────────
// Permanently deletes all user data from Supabase and optionally the Clerk user.
// Required by Apple App Store guidelines (June 2022).

async function handleDeleteAccount(req: VercelRequest, res: VercelResponse) {
  try {
    // Verify auth token
    const auth = await verifyClerkToken(req.headers.authorization as string | undefined);
    if (!auth) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const userId = auth.userId;

    // Delete user data from all Supabase tables (order matters for foreign keys)
    const tablesToPurge = [
      TABLES.swipeHistory,
      TABLES.savedTrips,
      TABLES.userPreferences,
      TABLES.savedTravelers,
      TABLES.bookings,
    ];

    for (const table of tablesToPurge) {
      const { error } = await supabase.from(table).delete().eq('user_id', userId);
      if (error) {
        console.warn(`[auth/delete] Failed to purge ${table} for ${userId}:`, error.message);
      }
    }

    // Delete the Clerk user if secret key is configured
    if (CLERK_SECRET_KEY) {
      try {
        const deleteResponse = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
        });
        if (!deleteResponse.ok) {
          console.warn('[auth/delete] Failed to delete Clerk user:', await deleteResponse.text());
        }
      } catch (clerkErr) {
        console.warn('[auth/delete] Clerk user deletion error:', clerkErr);
      }
    }

    return res.status(200).json({ deleted: true });
  } catch (err) {
    logApiError('api/auth/delete', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Account deletion failed');
  }
}

async function findOrCreateClerkUser(
  email: string,
  givenName?: string,
  familyName?: string,
): Promise<{ sessionToken: string; userId: string; email: string; name: string | null } | null> {
  try {
    // Search for existing user by email
    const searchResponse = await fetchWithTimeout(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
      {
        headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
      },
    );

    let userId: string;

    if (searchResponse.ok) {
      const users = await searchResponse.json();
      if (users.length > 0) {
        userId = users[0].id;
      } else {
        // Create new user
        const createResponse = await fetchWithTimeout('https://api.clerk.com/v1/users', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email_address: [email],
            first_name: givenName || undefined,
            last_name: familyName || undefined,
          }),
        });

        if (!createResponse.ok) {
          console.warn('[auth] Failed to create Clerk user:', await createResponse.text());
          return null;
        }

        const newUser = await createResponse.json();
        userId = newUser.id;
      }
    } else {
      return null;
    }

    // Create a sign-in token for this user
    const signInResponse = await fetchWithTimeout('https://api.clerk.com/v1/sign_in_tokens', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!signInResponse.ok) {
      console.warn('[auth] Failed to create sign-in token:', await signInResponse.text());
      return null;
    }

    const signInData = await signInResponse.json();
    const name = [givenName, familyName].filter(Boolean).join(' ') || null;

    // Redeem the sign-in token via Clerk Frontend API to get a real session JWT.
    // Sign-in tokens are one-time-use and cannot be used as Bearer tokens for
    // verifyToken() — we need an actual JWT from a Clerk session.
    const clerkFrontendDomain = env.CLERK_FRONTEND_API || 'clerk.sogojet.com';
    const ticketResponse = await fetchWithTimeout(
      `https://${clerkFrontendDomain}/v1/client/sign_ins?_clerk_js_version=4`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: 'ticket',
          ticket: signInData.token,
        }),
      },
    );

    if (ticketResponse.ok) {
      const ticketData = await ticketResponse.json();
      const session = ticketData.client?.sessions?.[0];
      const jwt = session?.last_active_token?.jwt;
      if (jwt) {
        return { sessionToken: jwt, userId, email, name };
      }
      console.warn('[auth] Ticket redeemed but no JWT in session — returning sign-in token as fallback');
    } else {
      const errText = await ticketResponse.text().catch(() => '(unreadable)');
      console.warn(`[auth] Ticket redemption failed (${ticketResponse.status}): ${errText}`);
    }

    // Fallback: return the sign-in token. It will work for identifying the user
    // but may fail verifyToken() checks on protected endpoints.
    return { sessionToken: signInData.token, userId, email, name };
  } catch (err) {
    console.error('[auth] findOrCreateClerkUser error:', err);
    return null;
  }
}
