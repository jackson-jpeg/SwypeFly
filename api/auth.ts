import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from './_cors.js';
import { logApiError } from '../utils/apiLogger';
import { verifyClerkToken } from '../utils/clerkAuth';
import { supabase, TABLES } from '../services/supabaseServer';

// ─── Clerk Auth Endpoint ────────────────────────────────────────────────────
// Exchanges an Apple Sign In identity token for a Clerk session token.
// Called by the iOS app after Sign in with Apple completes.

const CLERK_SECRET_KEY = (process.env.CLERK_SECRET_KEY || '').trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const { action } = req.query;

  if (req.method === 'DELETE' && action === 'delete') {
    return handleDeleteAccount(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (action === 'apple') {
    return handleAppleSignIn(req, res);
  }

  if (action === 'oauth') {
    return handleOAuthExchange(req, res);
  }

  return res.status(400).json({ error: 'Invalid action. Use ?action=apple, ?action=oauth, or DELETE ?action=delete' });
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
      return res.status(400).json({ error: 'Missing identityToken' });
    }

    if (!CLERK_SECRET_KEY) {
      // DEV ONLY: Fallback when Clerk isn't configured — return a mock session
      // WARNING: This must not be used in production. Set CLERK_SECRET_KEY in env.
      console.warn('[auth] CLERK_SECRET_KEY not set, returning mock session (DEV ONLY)');
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

    // Exchange Apple identity token for a Clerk session via Clerk's Backend API
    // Step 1: Create or get the user via the Apple ID token
    const ticketResponse = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        strategy: 'token',
        token: identityToken,
      }),
    });

    // If Clerk's sign_in_tokens doesn't support Apple tokens directly,
    // fall back to creating/finding the user manually
    if (!ticketResponse.ok) {
      // Try to find or create user by email
      if (email) {
        const userResult = await findOrCreateClerkUser(email, givenName, familyName);
        if (userResult) {
          return res.status(200).json(userResult);
        }
      }

      // Clerk token exchange failed and no user found by email — return error
      console.error('[auth] Clerk token exchange failed and user lookup failed');
      return res.status(401).json({
        error: 'Authentication failed. Could not verify Apple identity token.',
      });
    }

    const ticketData = await ticketResponse.json();
    if (!ticketData.token || !ticketData.user_id) {
      console.error('[auth] Clerk returned incomplete ticket data');
      return res.status(401).json({ error: 'Authentication failed. Incomplete response from auth provider.' });
    }
    return res.status(200).json({
      sessionToken: ticketData.token,
      userId: ticketData.user_id,
      email: email || null,
      name: [givenName, familyName].filter(Boolean).join(' ') || null,
    });
  } catch (err) {
    logApiError('api/auth/apple', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

async function handleOAuthExchange(req: VercelRequest, res: VercelResponse) {
  try {
    const { code, redirect_uri } = req.body as {
      code: string;
      redirect_uri?: string;
    };

    if (!code) {
      return res.status(400).json({ error: 'Missing code' });
    }

    if (!CLERK_SECRET_KEY) {
      return res.status(500).json({ error: 'Auth not configured' });
    }

    // The code/token from the iOS app is either:
    // 1. A Clerk rotating_token from completed OAuth
    // 2. A Clerk ticket from the OAuth callback
    // 3. An authorization code to exchange

    // Try to verify the token as a sign-in token first
    const verifyResponse = await fetch('https://api.clerk.com/v1/clients/verify', {
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
        // Get user info
        const userResponse = await fetch(
          `https://api.clerk.com/v1/users/${session.user_id}`,
          { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } },
        );

        let email: string | null = null;
        let name: string | null = null;

        if (userResponse.ok) {
          const user = await userResponse.json();
          email = user.email_addresses?.[0]?.email_address || null;
          name =
            [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
        }

        return res.status(200).json({
          sessionToken: session.last_active_token?.jwt || code,
          userId: session.user_id,
          email,
          name,
        });
      }
    }

    // If verify didn't work, try exchanging as an OAuth code
    const tokenResponse = await fetch('https://api.clerk.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect_uri || '',
        client_id: 'clerk',
      }).toString(),
    });

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();

      // Get user info from the access token
      const userinfoResponse = await fetch(
        `https://clerk.sogojet.com/oauth/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        },
      );

      let email: string | null = null;
      let name: string | null = null;
      let userId = 'oauth_user';

      if (userinfoResponse.ok) {
        const userinfo = await userinfoResponse.json();
        email = userinfo.email || null;
        name = userinfo.name || null;
        userId = userinfo.sub || userId;
      }

      return res.status(200).json({
        sessionToken: tokenData.access_token,
        userId,
        email,
        name,
      });
    }

    // Last attempt: treat code as a sign-in token and create a session
    const signInTokenResponse = await fetch(
      `https://api.clerk.com/v1/sign_in_tokens/${code}/revoke`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
      },
    );

    console.warn('[auth/oauth] All exchange methods failed');
    return res.status(401).json({ error: 'OAuth exchange failed' });
  } catch (err) {
    logApiError('api/auth/oauth', err);
    return res.status(500).json({ error: 'Authentication failed' });
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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = auth.userId;

    // Delete user data from all Supabase tables (order matters for foreign keys)
    const tablesToPurge = [
      TABLES.swipeHistory,
      TABLES.savedTrips,
      TABLES.userPreferences,
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
    return res.status(500).json({ error: 'Account deletion failed' });
  }
}

async function findOrCreateClerkUser(
  email: string,
  givenName?: string,
  familyName?: string,
): Promise<{ sessionToken: string; userId: string; email: string; name: string | null } | null> {
  try {
    // Search for existing user by email
    const searchResponse = await fetch(
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
        const createResponse = await fetch('https://api.clerk.com/v1/users', {
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

    // Create a sign-in token for this user (gives them a session)
    const signInResponse = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
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

    return {
      sessionToken: signInData.token,
      userId,
      email,
      name: [givenName, familyName].filter(Boolean).join(' ') || null,
    };
  } catch (err) {
    console.error('[auth] findOrCreateClerkUser error:', err);
    return null;
  }
}
