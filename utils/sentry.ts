import { Platform } from 'react-native';

interface SentryLike {
  captureException(error: unknown, options?: { extra?: Record<string, unknown> }): void;
  captureMessage(message: string, options?: { extra?: Record<string, unknown> }): void;
}

let SentryModule: SentryLike | null = null;
let initialized = false;

export function initSentry() {
  const dsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    (typeof window !== 'undefined'
      ? ((window as unknown as Record<string, unknown>).EXPO_PUBLIC_SENTRY_DSN as string)
      : undefined);
  if (!dsn || initialized) return;

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
