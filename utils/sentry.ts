import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || (typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>).EXPO_PUBLIC_SENTRY_DSN as string : undefined);
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV || 'development',
  });

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) {
    console.error(error);
    return;
  }
  Sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string, context?: Record<string, unknown>) {
  if (!initialized) {
    console.log(message, context);
    return;
  }
  Sentry.captureMessage(message, { extra: context });
}
