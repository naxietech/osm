# OSES — On-Screen Exam System

National-scale examination platform for Pakistan targeting 1,000,000+ enrolled students,
150+ schools, 7 subjects, and 3 exam cycles per year.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 20 |
| pnpm | >= 9 |
| Python | 3.11 (future worker only) |

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

| Service | Port | Command |
|---------|------|---------|
| API (NestJS) | 3001 | `turbo dev --filter=@oses/api` |
| Web (Vite) | 5173 | `turbo dev --filter=@oses/web` |
| Worker (Python) | — | Not yet implemented |

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

| Target | Convention | Example |
|--------|-----------|---------|
| Files | kebab-case | `school-list.page.tsx`, `schools.service.ts` |
| React components | PascalCase | `SchoolsListPage`, `DataTable` |
| Functions & variables | camelCase | `createSchool`, `isLoading` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `API_BASE_URL` |
| TypeScript interfaces/types | PascalCase, no I-prefix | `School` not `ISchool` |
| TypeScript enums | PascalCase enum, UPPER_SNAKE values | `UserRole.ADMIN` |
| Folders | kebab-case | `design-system/`, `exam-cycles/` |
| API endpoints | kebab-case | `GET /api/v1/schools` |
| Test files | same name + `.test.tsx` / `.test.ts` | `button.test.tsx` |
| Barrel files | `index.ts` in every folder | `atoms/button/index.ts` |

---

## Atomic Design System

The frontend follows Atomic Design. Each layer has strict import rules.

### Layers

| Layer | Directory | Purpose | Example |
|-------|-----------|---------|---------|
| Atoms | `design-system/atoms/` | Single-purpose, zero business logic | `Button`, `Input`, `Badge`, `Spinner`, `Label` |
| Molecules | `design-system/molecules/` | Atom compositions with minor logic | `FormField`, `StatusBadge`, `SearchBar` |
| Organisms | `design-system/organisms/` | Domain-aware compositions | `SchoolForm`, `DataTable` |
| Templates | `design-system/templates/` | Page structure shells | `PageLayout`, `AuthLayout` |

### Import rules (enforced by ESLint)

- **Atoms** must not import from molecules, organisms, or templates.
- **Molecules** must not import from organisms or templates.
- **Organisms** may import atoms and molecules only.
- **Templates** may import atoms, molecules, and organisms.
- **Pages** may import any design-system layer.

---

## packages/types — shared type contract

Both `apps/web` and `apps/api` import from `@oses/types`. This package has **zero runtime
dependencies** — it is types only.

Rules:
- Never duplicate a type. If a type exists in `@oses/types`, import it; do not redefine it.
- Never expose PII fields (`fullName`, `cnicOrBform`, `dateOfBirth`) in evaluator-facing
  API responses. Use `SafeStudentRef` for evaluator contexts.
- Only admins and controllers may receive the full `Student` type.

---

## Module pattern — schools is the reference

Every future module (students, exam-cycles, marking, results) follows the identical
pattern established by the schools module:

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

### Frontend (`apps/web/src/pages/admin/<name>/`)

```
<name>-list.page.tsx    — DataTable with typed columns, mock data, row-click navigation
<name>-detail.page.tsx  — pre-filled form, edit/save flow
index.ts                — barrel export
```

Register the new backend module in `app.module.ts` under the comment
`// Add new modules here...`.

Add new frontend routes in `src/router/index.tsx` under the `/admin` route following
the `/admin/schools` pattern.

---

## apps/worker

Python OpenCV scan processor. **Not yet implemented.**
See `apps/worker/README.md` for the planned pipeline.

When implemented: Python 3.11, opencv-python, pyzbar, boto3, psycopg2, pydantic.
