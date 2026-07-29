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
    const errorName = isHttp ? exception.name : 'InternalServerError';

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

function extractMessage(exception: HttpException): string | string[] {
  const res = exception.getResponse();
  if (typeof res === 'object' && res !== null && 'message' in res) {
    return (res as { message: string | string[] }).message;
  }
  return exception.message;
}
