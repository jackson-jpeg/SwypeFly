interface SentryLike {
  captureException(error: unknown, options?: { extra?: Record<string, unknown> }): void;
  captureMessage(message: string, options?: { extra?: Record<string, unknown> }): void;
}

let SentryModule: SentryLike | null = null;
let initialized = false;

function isServer(): boolean {
  return typeof window === 'undefined' && typeof process !== 'undefined';
}

export function initSentry() {
  // Skip Sentry init on server-side (Vercel functions) — react-native can't be imported there
  if (isServer()) return;

  const dsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    (typeof window !== 'undefined'
      ? ((window as unknown as Record<string, unknown>).EXPO_PUBLIC_SENTRY_DSN as string)
      : undefined);
  if (!dsn || initialized) return;

  // Dynamically detect platform to avoid top-level react-native import
  try {
    const { Platform } = require('react-native');
    if (Platform.OS === 'web') {
      const WebSentry = require('@sentry/react') as typeof import('@sentry/react');
      WebSentry.init({
        dsn,
        tracesSampleRate: 0.1,
        environment: process.env.VERCEL_ENV || 'development',
      });
      SentryModule = WebSentry;
    } else {
      const NativeSentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
      NativeSentry.init({
        dsn,
        tracesSampleRate: 0.1,
        environment: process.env.VERCEL_ENV || 'development',
      });
      SentryModule = NativeSentry;
    }
    initialized = true;
  } catch {
    // react-native not available (e.g. server environment)
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized || !SentryModule) {
    console.error(error);
    return;
  }
  SentryModule.captureException(error, { extra: context });
}

export function captureMessage(message: string, context?: Record<string, unknown>) {
  if (!initialized || !SentryModule) {
    console.log(message, context);
    return;
  }
  SentryModule.captureMessage(message, { extra: context });
}
