import { captureException } from './sentry';

export function logApiError(endpoint: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[${endpoint}]`, error);
  captureException(error, { ...context, endpoint });
}
