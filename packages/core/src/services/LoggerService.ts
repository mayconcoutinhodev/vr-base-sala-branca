import type { Logger } from '@vr/module-sdk';

/**
 * Structured logger. In production replace console with a real sink.
 */
export class LoggerService implements Logger {
  private prefix: string;

  constructor(prefix = '[VR]') {
    this.prefix = prefix;
  }

  info(msg: string, meta?: Record<string, unknown>): void {
    console.info(`${this.prefix} INFO  ${msg}`, meta ?? '');
  }

  warn(msg: string, meta?: Record<string, unknown>): void {
    console.warn(`${this.prefix} WARN  ${msg}`, meta ?? '');
  }

  error(msg: string, meta?: Record<string, unknown>): void {
    console.error(`${this.prefix} ERROR ${msg}`, meta ?? '');
  }
}
