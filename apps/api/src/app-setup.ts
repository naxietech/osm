import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';

/**
 * Apply the shared runtime configuration — security headers, cookie parsing, the global
 * prefix, and the response envelope/error filter. Used by both `main.ts` and the e2e
 * bootstrap so the test app is configured identically to production.
 *
 * CSP is disabled: this is a JSON API (no HTML it must lock down) and it keeps the
 * Swagger UI at /api/docs working. HSTS, nosniff, frameguard, and hidePoweredBy stay on.
 */
export function configureApp(app: INestApplication): void {
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
}
