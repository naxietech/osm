# API Conventions (`apps/api`)

NestJS 10 on the Express adapter, **PostgreSQL via Kysely**. The schema covers **auth only**
(`persistence/kysely/migrations/001-initial-auth-schema.ts`): users, roles, permissions,
role_grants, sessions, auth_audit_log, invitations, password reset tokens, MFA recovery codes.
There is no table for institutes, students, exams, checkers, or marking — don't add one unless
the task explicitly says so.

Repositories are hand-written adapters behind the port interfaces in `auth/ports.ts`, injected
by token (`USER_REPOSITORY`, `SESSION_REPOSITORY`, …). Follow that pattern rather than reaching
for the Kysely instance from a service.

## Auth model

Sessions are **HttpOnly cookies**, not bearer tokens: a short-lived RS256 access cookie plus a
rotating opaque refresh cookie. Replaying a retired refresh token revokes the whole rotation
family (theft detection), so anything that renews a session must send exactly one refresh at a
time. `JwtStrategy` reads the access cookie first and falls back to a Bearer header for tooling.

## Module pattern (when a real module is added)

```
src/modules/<name>/
  <name>.module.ts       — @Module, wires controller + service
  <name>.controller.ts   — route handlers, guards, Swagger decorators
  <name>.service.ts       — logic, typed return promises
  dto/
    create-<name>.dto.ts — Zod schema + inferred type
    update-<name>.dto.ts — .partial() of the create schema
    index.ts             — barrel
  index.ts               — barrel
```

Register new modules in `app.module.ts` under `// Add new modules here...`.

## Rules

- **DTOs are Zod schemas**, validated by the `ZodValidationPipe` (`src/shared/pipes`). Infer the
  type from the schema (`z.infer<typeof schema>`); don't declare the shape twice. Share request/
  response shapes with the web app via `@oses/types` where they overlap.
- **Responses are wrapped by `TransformInterceptor`** into the `ApiResponse<T>` envelope
  (`{ success, data, message, timestamp }`) from `@oses/types`. Controllers return the raw
  `data`; do not build the envelope by hand.
- **Auth**: JWT via `@nestjs/passport` + `jwt.strategy.ts`. Protect routes with `JwtAuthGuard`
  and role checks with `RolesGuard` + the `@Roles()` decorator. Read the caller with
  `@CurrentUser()`. Never trust a client-supplied role/id — derive it from the token.
- **Errors** surface through the `HttpExceptionFilter`. Throw Nest `HttpException` subclasses;
  don't return ad-hoc error envelopes.
- **Swagger**: decorate new endpoints so `/api/docs` stays accurate.
- Tests are **Jest** (`*.spec.ts` unit, `test/*.e2e-spec.ts` e2e with supertest).
