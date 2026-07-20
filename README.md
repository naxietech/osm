# OSES — On-Screen Exam System

National-scale examination platform for Pakistan targeting 1,000,000+ enrolled students,
150+ schools, 7 subjects, and 3 exam cycles per year.

---

## Prerequisites

| Tool    | Version                   |
| ------- | ------------------------- |
| Node.js | >= 20                     |
| pnpm    | >= 9                      |
| Python  | 3.11 (future worker only) |

---

## Setup

```bash
git clone <repo-url>
cd oses
pnpm install
pnpm husky install
turbo dev
```

---

## What runs where

| Service         | Port | Command                        |
| --------------- | ---- | ------------------------------ |
| API (NestJS)    | 3001 | `turbo dev --filter=@oses/api` |
| Web (Vite)      | 5173 | `turbo dev --filter=@oses/web` |
| Worker (Python) | —    | Not yet implemented            |

Swagger docs: http://localhost:3001/api/docs

---

## Monorepo structure

```
oses/
├── apps/
│   ├── web/          # Vite + React 18 + TypeScript frontend
│   ├── api/          # NestJS backend (Express adapter)
│   └── worker/       # Python OpenCV scan processor (placeholder)
├── packages/
│   ├── types/        # Shared TypeScript types — imported by both web and api
│   ├── eslint-config/ # Shared ESLint rules (base + react variants)
│   ├── prettier-config/ # Shared Prettier configuration
│   └── tsconfig/     # Shared TypeScript base configs (base, react, node)
├── turbo.json        # Turborepo pipeline config
├── pnpm-workspace.yaml
└── package.json      # Workspace root — no app code here
```

---

## Naming conventions

| Target                      | Convention                           | Example                                            |
| --------------------------- | ------------------------------------ | -------------------------------------------------- |
| Files                       | kebab-case                           | `institutes-list.page.tsx`, `institute.service.ts` |
| React components            | PascalCase                           | `SchoolsListPage`, `DataTable`                     |
| Functions & variables       | camelCase                            | `createSchool`, `isLoading`                        |
| Constants                   | UPPER_SNAKE_CASE                     | `MAX_FILE_SIZE`, `API_BASE_URL`                    |
| TypeScript interfaces/types | PascalCase, no I-prefix              | `School` not `ISchool`                             |
| TypeScript enums            | PascalCase enum, UPPER_SNAKE values  | `UserRole.ADMIN`                                   |
| Folders                     | kebab-case                           | `design-system/`, `exam-cycles/`                   |
| API endpoints               | kebab-case                           | `GET /api/v1/schools`                              |
| Test files                  | same name + `.test.tsx` / `.test.ts` | `button.test.tsx`                                  |
| Barrel files                | `index.ts` in every folder           | `atoms/button/index.ts`                            |

---

## Atomic Design System

The frontend follows Atomic Design. Each layer has strict import rules.

### Layers

| Layer     | Directory                  | Purpose                             | Example                                        |
| --------- | -------------------------- | ----------------------------------- | ---------------------------------------------- |
| Atoms     | `design-system/atoms/`     | Single-purpose, zero business logic | `Button`, `Input`, `Badge`, `Spinner`, `Label` |
| Molecules | `design-system/molecules/` | Atom compositions with minor logic  | `FormField`, `StatusBadge`, `SearchBar`        |
| Organisms | `design-system/organisms/` | Domain-aware compositions           | `SchoolForm`, `DataTable`                      |
| Templates | `design-system/templates/` | Page structure shells               | `PageLayout`, `AuthLayout`                     |

### Import rules (enforced by ESLint)

- **Atoms** must not import from molecules, organisms, or templates.
- **Molecules** must not import from organisms or templates.
- **Organisms** may import atoms and molecules only — _including no other organism_.
- **Templates** may import atoms, molecules, and organisms.
- **Pages** may import any design-system layer.
- **No design-system file may import `@/pages`, `@/services` or `@/router`.** Organisms
  stay presentational: they take data and predicates as props and emit values through
  callbacks, and the page owns the service calls.

These are enforced by `no-restricted-imports` overrides in `apps/web/.eslintrc.cjs`, one
override per layer, matched on the `@/` import specifier. A violation fails `pnpm lint`.

---

## packages/types — shared type contract

Both `apps/web` and `apps/api` import from `@oses/types`. It has **no third-party
dependencies**. It is _almost_ type-only: the enums (`UserRole`, `ExamStatus`, `Province`,
`OnboardingStatus`, `InstituteLevel`, `InstitutionType`, `GenderCategory`,
`InstitutionKind`, `HttpStatus`) and the `questionTypeHasOptions()` helper do emit
runtime JavaScript and are imported as values. Everything else is erased at compile time.

Rules:

- Never duplicate a type. If a type exists in `@oses/types`, import it; do not redefine it.
- Never expose PII fields (`fullName`, `cnicOrBform`, `dateOfBirth`) in evaluator-facing
  API responses. Use `SafeStudentRef` for evaluator contexts, and
  `examRegistrationService.listCandidatesForEvaluator` rather than filtering names out
  client-side.
- Only admins and controllers may receive the full `Student` type.
- Gate PII **rendering** on the `students.viewPII` grant via `usePermissions().canViewPII`,
  not on the user's role. Route guards key off the legacy `UserRole` enum, so a custom
  role without the grant would otherwise still see everything. Components that render PII
  (e.g. `StudentProfile`) take `canViewPII` as a prop and default to withholding it.

---

## Module pattern — institutes is the reference

Every future module (students, exams, marking, results) follows the identical pattern
established by the institutes module.

### Backend (`apps/api/src/modules/<name>/`)

```
<name>.module.ts        — @Module decorator, wires controller + service
<name>.controller.ts    — route handlers, guards, Swagger decorators
<name>.service.ts       — business logic, typed return promises
dto/
  create-<name>.dto.ts  — Zod schema + inferred type
  update-<name>.dto.ts  — .partial() of create schema
  index.ts              — barrel export
index.ts                — barrel export
```

Register the new backend module in `app.module.ts` under the comment
`// Add new modules here...`.

### Frontend (`apps/web/src/pages/<name>/`)

```
<name>s-list.page.tsx   — DataTable with typed columns, row-click navigation
<name>-detail.page.tsx  — pre-filled form, edit/save flow
index.ts                — barrel export
```

Pages are grouped by **feature, not by role** — there is no `admin/` folder. `admin` is
a URL prefix only, composed in the router; the same page module is mounted under several
role shells (e.g. the students pages serve both ADMIN and INSTITUTE), so filing them
under a role folder would misdescribe them.

Keep pages thin: a list plus service wiring. Any form or builder with real logic belongs
in `design-system/organisms/<name>/` — see `organisms/institute-form` for the reference,
and `pages/setup/subjects.page.tsx` for how small a page should stay.

### Routing

```
router/routes.ts               — ROUTES: the single source of every path
router/modules/<name>.routes.tsx — per-module route factory, taking the role's home path
router/router.tsx              — the four role shells, composing those factories
```

Add a new module's paths to `routes.ts`, then a `<name>.routes.tsx` factory, then compose
it into whichever role shells expose it. A module shared by several roles is declared
**once** and composed per role, so it can never be updated for one role and missed on
another.

---

## apps/worker

Python OpenCV scan processor. **Not yet implemented.**
See `apps/worker/README.md` for the planned pipeline.

When implemented: Python 3.11, opencv-python, pyzbar, boto3, psycopg2, pydantic.
