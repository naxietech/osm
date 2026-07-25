# Stack Detection — Apply Before Any Analysis

You are about to reason about a codebase. Generic assumptions produce wrong recommendations. This skill is retargeted for **OSES (On-Screen Exam System)** — the stack below is the known reality, not something to re-derive. Still read the files that ground each finding (which app, which module, which rule), and confirm the reality below still holds before you rely on it.

## OSES — the known stack

Monorepo: **Turborepo + pnpm 9**, Node >= 20. Windows dev (Git Bash available; `jq` is NOT installed — never rely on `jq`). Layout:

- **`apps/web`** — Vite + React 18 + TypeScript + Tailwind v4 (CSS-variable tokens) + Formik/Yup + React Query (`@tanstack/react-query`) + `react-router-dom` + recharts. Follows **atomic design** (atoms / molecules / organisms / templates) with **ESLint-enforced layer boundaries**. Runs **entirely on mocks** (`src/services/*.service.ts` + `src/services/mock-store.ts`) — there is no live backend wiring. Tested with **Vitest + Testing Library**.
- **`apps/api`** — **NestJS 10 (Express)** scaffold: JWT auth, `RolesGuard` + `@Roles()`, Zod DTOs validated by a `ZodValidationPipe`, a `TransformInterceptor` that wraps responses in an `ApiResponse<T>` envelope, Swagger. **There is no database** — no TypeORM/Prisma, no ORM entities, no migrations, no `modules/` dir yet. Tested with **Jest + supertest**.
- **`apps/worker`** — Python OpenCV scan processor, **not implemented** (placeholder).
- **`packages/types`** — `@oses/types`: shared TypeScript types + enums, **zero third-party deps**. Single source of truth — never redefine a type that lives there.

Rules live in **`.claude/rules/*.md`** (atomic-design, typescript-conventions, web-conventions, api-conventions, shared-types-and-pii, domain-rules, testing-and-gates, git-and-safety); root **`CLAUDE.md`** is the map. Prefer these over guessing.

Domain vocabulary: institutes, students (candidates), exams, marking / checkers (evaluators), SLOs, roles / RBAC, candidate anonymity / PII. Reserved marking colours: **green = correct, red = incorrect, amber = partial** — never repurpose them.

## What to read (to confirm and ground findings)

**Manifests** (read the ones relevant to the app you are touching):

- Root — `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json` (base)
- `apps/web` — `apps/web/package.json`, `tsconfig.json`, `vite.config.*`, `vitest.config.*`, `eslint.config.*` / `.eslintrc*` (the layer-boundary rules), `tailwind`/CSS token files
- `apps/api` — `apps/api/package.json`, `tsconfig.json`, `nest-cli.json`, `jest` config
- `packages/types` — `packages/types/package.json`, exported `index.ts`

**Project rules** (read whichever apply):

`CLAUDE.md` (root — the map), `.claude/rules/*.md` (atomic-design, typescript-conventions, web-conventions, api-conventions, shared-types-and-pii, domain-rules, testing-and-gates, git-and-safety), `README.md`.

If you find a project-rules-discoverer report in your context, prefer it over re-scanning.

**Code structure** — `apps/` (web, api, worker) and `packages/` (types). Within `apps/web/src`: atomic-design layers (`atoms/`, `molecules/`, `organisms/`, `templates/`), plus `pages/`, `services/`, `router/`, `hooks/`.

## What to confirm (not re-derive)

- Which app the change lives in (`apps/web`, `apps/api`, `apps/worker`, `packages/types`)
- Which atomic-design layer a web file sits in, and what that layer may import
- Which `.claude/rules/*.md` govern the change
- Test placement — co-located `*.test.ts(x)` (web, Vitest) / `*.spec.ts` (api, Jest)
- Whether a type already lives in `@oses/types` before defining a new one
- Whether web work stays on the mock layer (`src/services/*.service.ts`, `mock-store.ts`)

## Hard rules

1. **Never recommend a tool, pattern, or library the project does not use.** No ORM/TypeORM/Prisma (the API has no DB), no Redux/Zustand (state is React Query + local), no CSS-in-JS (styling is Tailwind v4 tokens). If unsure, ask.
2. **Use the project's own vocabulary.** NestJS controllers/providers/guards/DTOs on the api side; atoms/molecules/organisms/templates on the web side; `@oses/types` for shared contracts. Domain terms: institutes, students, exams, checkers/evaluators, SLOs, roles.
3. **Do not invent infrastructure the project lacks.** No migrations, no ORM/N+1 fixes, no queues, no server observability stack — none of these exist yet. Web runs on mocks; the API has no database.
4. **Carry the stack into every finding.** File paths, framework names, and the test command must match the project.

## When something is genuinely ambiguous

If a feature could target web or api (or "both"), or the platform scope is unclear, state what you found and ask the user. Do not pick silently.
