// Structured JSON logging for Vercel serverless functions.
// Logs are captured by Vercel's log drain and can be forwarded to
// Sentry, Datadog, or any log aggregation service.

interface LogEntry {
  level: 'error' | 'warn' | 'info';
  endpoint: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

function emitLog(entry: LogEntry) {
  const log = {
    ...entry,
    ...(entry.context || {}),
  };
  if (entry.level === 'error') {
    console.error(JSON.stringify(log));
  } else if (entry.level === 'warn') {
    console.warn(JSON.stringify(log));
  } else {
    console.log(JSON.stringify(log));
  }
}

export function logApiError(endpoint: string, error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  emitLog({
    level: 'error',
    endpoint,
    message,
    timestamp: new Date().toISOString(),
    context: { ...context, ...(stack ? { stack } : {}) },
  });
}

export function logApiWarn(endpoint: string, message: string, context?: Record<string, unknown>) {
  emitLog({
    level: 'warn',
    endpoint,
    message,
    timestamp: new Date().toISOString(),
    context,
  });
}

export function logApiInfo(endpoint: string, message: string, context?: Record<string, unknown>) {
  emitLog({
    level: 'info',
    endpoint,
    message,
    timestamp: new Date().toISOString(),
    context,
  });
}
