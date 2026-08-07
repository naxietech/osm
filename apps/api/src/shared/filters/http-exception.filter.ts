import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global exception filter. Catches EVERYTHING (`@Catch()` with no argument), so unexpected
 * non-HttpException errors (DB failures, argon2 errors, bugs) still come back in the
 * `ApiResponse` envelope as a 500 and are logged with request context — instead of falling
 * through to Nest's default handler, which uses a different shape and skips our logging.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : 500;
    // A thrower may supply its own `error` code to tell two failures with the same status apart.
    // Two different 409s on one route — "someone else saved first" and "that option is already
    // answered" — need opposite advice, and a client that sees only `ConflictException` for both
    // has to guess. Falls back to the exception class name, which is what every other route uses.
    const errorName = isHttp ? (extractError(exception) ?? exception.name) : 'InternalServerError';

    // For expected HttpExceptions, surface their message; for anything unexpected, keep the
    // client message generic (don't leak internals) but log the real error + stack.
    const rawMessage = isHttp ? extractMessage(exception) : 'Internal server error';
    const message = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage;

    if (isHttp) {
      this.logger.warn(`[${request.method}] ${request.url} — ${statusCode} ${message}`);
    } else {
      this.logger.error(
        `[${request.method}] ${request.url} — 500 (unhandled)`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      success: false,
      error: errorName,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    });
  }
}

function extractError(exception: HttpException): string | undefined {
  const res = exception.getResponse();
  if (typeof res === 'object' && res !== null && 'error' in res) {
    const error = (res as { error?: unknown }).error;
    if (typeof error === 'string') return error;
  }
  return undefined;
}

function extractMessage(exception: HttpException): string | string[] {
  const res = exception.getResponse();
  if (typeof res === 'object' && res !== null && 'message' in res) {
    return (res as { message: string | string[] }).message;
  }
  return exception.message;
}
