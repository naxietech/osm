# API Conventions (`apps/api`)

NestJS 10 on the Express adapter, **PostgreSQL via TypeORM**. The schema covers **auth only**
(`persistence/typeorm/migrations/1730000000000-initial-auth-schema.ts`) — six tables:

| Table            | Holds                                                    |
| ---------------- | -------------------------------------------------------- |
| `users`          | accounts, status, lockout counters                       |
| `roles`          | system + custom roles, optionally scoped to an institute |
| `permissions`    | the grantable action catalogue                           |
| `role_grants`    | which actions a role holds, and at what scope            |
| `sessions`       | refresh-token families (rotation + theft detection)      |
| `auth_audit_log` | every login, refresh, lockout and account-status change  |

There is **no table** for institutes, students, exams, checkers, subjects, classes or marking —
don't add one unless the task explicitly says so. (Invitations, password-reset tokens and MFA
recovery codes were dropped in PR #13; if a task needs them, it is reintroducing a table, not
using an existing one.)

Migrations are timestamped files run through `pnpm db:migrate` (`db:migrate:revert` to roll
back, `db:seed` to seed). **`synchronize` is off** — schema changes are migrations, never
inferred from entities.

Entities live in `persistence/typeorm/entities/` and map snake_case columns to camelCase
fields explicitly. Repositories are hand-written adapters in `persistence/typeorm/
repositories.ts`, sitting behind the port interfaces in `auth/ports.ts` and injected by token
(`USER_REPOSITORY`, `SESSION_REPOSITORY`, …). Follow that pattern rather than injecting a
TypeORM `Repository` or the `DataSource` straight into a service.

## Auth model

Sessions are **HttpOnly cookies**, not bearer tokens: a short-lived RS256 access cookie plus a
rotating opaque refresh cookie. Replaying a retired refresh token revokes the whole rotation
family (theft detection), so anything that renews a session must send exactly one refresh at a
time. `JwtStrategy` reads the access cookie first and falls back to a Bearer header for tooling.

There is no shape in `@oses/types` describing tokens in a response body, and there should not
be — the client is never given a readable token.

## Module pattern (when a real module is added)

```
src/modules/<name>/
  <name>.module.ts       — @Module, wires controller + service
  <name>.controller.ts   — route handlers, guards, Swagger decorators
  <name>.service.ts      — logic, typed return promises
  ports.ts               — repository interface + injection token
  dto/
    create-<name>.dto.ts — Zod schema + inferred type
    update-<name>.dto.ts — .partial() of the create schema
    index.ts             — barrel
  index.ts               — barrel
```

The persistence half goes in `persistence/typeorm/` — entity, repository adapter, migration —
not inside the module folder. Register new modules in `app.module.ts` under
`// Add new modules here...`.

## Rules

- **DTOs are Zod schemas**, validated by the `ZodValidationPipe` (`src/shared/pipes`). Infer the
  type from the schema (`z.infer<typeof schema>`); don't declare the shape twice. Where a body
  is also known to the web app, put the shape in `@oses/types` and tie the schema to it with
  `satisfies z.ZodType<Shape>` — see `auth/dto/create-user.dto.ts`. Two independent
  declarations of one request body will drift, and did.
- **Responses are wrapped by `TransformInterceptor`** into the `ApiResponse<T>` envelope
  (`{ success, data, message, timestamp }`) from `@oses/types`. Controllers return the raw
  `data`; do not build the envelope by hand.
- **Guards**: `JwtAuthGuard` (signed in) → `ActiveUserGuard` (not suspended/locked) →
  `PermissionsGuard` with `@RequirePermissions('<action>')`. Prefer a permission check over
  `RolesGuard` + `@Roles()`: role guards can't express a custom role that holds one capability.
  Read the caller with `@CurrentUser()`. Never trust a client-supplied role/id — derive it from
  the token.
- **Errors** surface through the `HttpExceptionFilter`. Throw Nest `HttpException` subclasses;
  don't return ad-hoc error envelopes. A unique-constraint violation should become a 409, not a
  500 — translate the PG error code rather than letting it escape.
- **Swagger**: decorate new endpoints so `/api/docs` stays accurate.
- Tests are **Jest** (`*.spec.ts` unit, `test/*.e2e-spec.ts` e2e with supertest).
