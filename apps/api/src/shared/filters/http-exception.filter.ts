import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
        ? (exceptionResponse as { message: string | string[] }).message
        : exception.message;

    // TODO: replace with proper logger (e.g. Winston or Pino)
    console.error(`[${request.method}] ${request.url} — ${statusCode}`, message);

    response.status(statusCode).json({
      success: false,
      error: exception.name,
      message: Array.isArray(message) ? message.join('; ') : message,
      statusCode,
      timestamp: new Date().toISOString(),
    });
  }
}
