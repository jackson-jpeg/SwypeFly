import { verifyToken } from '@clerk/backend';

/**
 * Verify a Clerk JWT from the Authorization header and return the user ID.
 * Returns null if the token is missing or invalid.
 */
export async function verifyClerkToken(
  authHeader: string | undefined,
): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? '',
    });
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
