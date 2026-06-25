import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggerService implements NestLoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  private format(level: string, message: string, context?: string) {
    return JSON.stringify({
      level,
      message,
      context: context ?? this.context,
      request_id: randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }

  log(message: string, context?: string) {
    console.log(this.format('info', message, context));
  }

  error(message: string, trace?: string, context?: string) {
    console.error(this.format('error', `${message}${trace ? ` | ${trace}` : ''}`, context));
  }

  warn(message: string, context?: string) {
    console.warn(this.format('warn', message, context));
  }

  debug(message: string, context?: string) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(this.format('debug', message, context));
    }
  }

  verbose(message: string, context?: string) {
    this.debug(message, context);
  }
}
