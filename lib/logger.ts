type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: any;
}

class Logger {
  private isDev = process.env.NODE_ENV === 'development';

  private log(level: LogLevel, message: string, context?: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      data,
    };

    if (this.isDev) {
      console[level](`[${context || 'App'}] ${message}`, data || '');
    }

    // In production, could send to external logging service
    if (!this.isDev) {
      // Example: send to LogRocket, DataDog, etc.
    }
  }

  debug(message: string, context?: string, data?: any) {
    this.log('debug', message, context, data);
  }

  info(message: string, context?: string, data?: any) {
    this.log('info', message, context, data);
  }

  warn(message: string, context?: string, data?: any) {
    this.log('warn', message, context, data);
  }

  error(message: string, context?: string, data?: any) {
    this.log('error', message, context, data);
  }
}

export const logger = new Logger();