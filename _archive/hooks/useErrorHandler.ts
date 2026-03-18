import { useCallback } from 'react';
import { logError } from '@/lib/errorHandler';

export function useErrorHandler() {
  const handleError = useCallback((error: unknown, context?: string, extra?: any) => {
    logError(error, { context, ...extra });
  }, []);

  const handleAsyncError = useCallback(async <T>(
    promise: Promise<T>,
    context?: string,
    extra?: any
  ): Promise<T | null> => {
    try {
      return await promise;
    } catch (error) {
      handleError(error, context, extra);
      return null;
    }
  }, [handleError]);

  return { handleError, handleAsyncError };
}