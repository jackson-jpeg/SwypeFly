import type { VercelResponse } from '@vercel/node';

interface ApiError {
  code: string;
  message: string;
  retryAfter?: number;
  detail?: string;
}

export function sendSuccess<T>(res: VercelResponse, data: T, status = 200): void {
  res.status(status).json({ ok: true, data });
}

export function sendError(
  res: VercelResponse,
  status: number,
  code: string,
  message: string,
  extra?: { retryAfter?: number; detail?: string },
): void {
  if (status === 429 && extra?.retryAfter) {
    res.setHeader('Retry-After', String(extra.retryAfter));
  }
  res.status(status).json({
    ok: false,
    error: { code, message, ...extra } satisfies ApiError,
  });
}
