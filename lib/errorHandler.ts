import * as Sentry from '@sentry/react';

interface ErrorContext {
  [key: string]: any;
}

interface LogErrorOptions {
  context?: string;
  level?: 'error' | 'warning' | 'info';
  userId?: string;
  [key: string]: any;
}

export function initializeErrorHandling() {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }
}

export function logError(error: unknown, options: LogErrorOptions = {}) {
  const { context, level = 'error', userId, ...extra } = options;
  
  const errorData = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    userId,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  const consoleMethod = level === 'warning' ? 'warn' : level;
  if (process.env.NODE_ENV === 'development') {
    console[consoleMethod](`[${context || 'Error'}]`, errorData);
  } else {
    Sentry.withScope((scope) => {
      if (context) scope.setTag('context', context);
      if (userId) scope.setUser({ id: userId });
      scope.setExtras(extra);

      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(String(error), level);
      }
    });
  }
}

export function handleApiError(error: unknown, message: string) {
  const isDev = process.env.NODE_ENV === 'development';
  
  const response = {
    error: message,
    ...(isDev && error instanceof Error && { details: error.message }),
  };

  return Response.json(response, { 
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}