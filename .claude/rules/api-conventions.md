# API Conventions (`apps/api`)

NestJS 10 on the Express adapter. **There is no database yet** — no TypeORM/Prisma, no ORM
entities, no migrations. The API today is auth + guards + a Zod validation pipe + a response
interceptor, with one e2e test. Do not build a data layer unless the task explicitly says so.

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
