# OSES — On-Screen Exam System

National-scale examination + on-screen marking platform for Pakistan. Targets 1,000,000+
enrolled students, 150+ institutes, 7 subjects, 3 exam cycles per year. The authoritative
spec is the **OSMS Technical Requirement Document** (Naxie ↔ Cantab); our internal docs live
in `docs/`.

This file is the map. Detailed conventions live in `.claude/rules/` (all auto-loaded).
Read it before writing code.

---

## Stack at a glance

| Part             | Tech                                                                                            | Tests                                 |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------- |
| `apps/web`       | Vite + React 18 + TypeScript + Tailwind v4 + Formik/Yup + React Query + react-router + recharts | **Vitest** + Testing Library          |
| `apps/api`       | NestJS 10 (Express), JWT auth, Zod validation, Swagger                                          | **Jest** (unit + e2e)                 |
| `apps/worker`    | Python OpenCV scan processor                                                                    | **not yet implemented** — placeholder |
| `packages/types` | `@oses/types` — shared type + enum contract, zero deps                                          | —                                     |
| `packages/*`     | shared `eslint-config`, `prettier-config`, `tsconfig`                                           | —                                     |

Turborepo + **pnpm 9** (Node ≥ 20). Run everything through `pnpm` / `turbo`, never `npm`.

---

## The reality you must not forget

- **`apps/api` covers auth only.** Three controllers (`auth`, `users`, `roles`), 11 routes, and
  PostgreSQL + Kysely for the auth schema (users, roles, permissions, role_grants, sessions,
  audit log, invitations, reset tokens, MFA codes). Sessions are **HttpOnly cookies** with
  rotating refresh tokens. There is **no table and no endpoint** for institutes, students,
  exams, checkers, e-sheet templates, or marking.
- **`apps/web` is live for auth and mocked for everything else.** `auth.service.ts` calls the
  real API through `api-client.ts`; `use-auth` and `use-permissions` read the session and grants
  from the server. Every other module still runs on `services/*.service.ts` + `mock-store.ts`.
  Do not add `fetch`/axios calls for a module the API doesn't have yet.
- **The Users and Roles screens are still on mocks** even though `/users` and `/roles` exist —
  wiring them up is its own branch.
- **`apps/worker` is a placeholder.** Don't implement scan processing unless asked.

If a task seems to need a table or endpoint outside the auth schema, stop and confirm scope —
you're probably about to build the deferred backend by accident.

---

## Monorepo map

```
oses/
├── apps/
│   ├── web/    # React frontend (atomic design) — the bulk of the product, on mocks
│   ├── api/    # NestJS scaffold (auth, guards, Zod) — no DB yet
│   └── worker/ # Python placeholder
├── packages/
│   ├── types/         # @oses/types — import types from here, never redefine
│   ├── eslint-config/ # base + react variants
│   ├── prettier-config/
│   └── tsconfig/      # base, react, node
└── docs/       # delivery plan, TRD alignment, module details
```

Web pages are grouped **by feature, not by role** — there is no `admin/` folder. `admin` is a
URL prefix composed in the router; one page module mounts under several role shells. Keep pages
thin (list + service wiring); real logic lives in `design-system/organisms/`. The **institutes**
module is the reference pattern for every other module.

---

## Verify gates — a change is not done until these pass

Run from `apps/web` (or `apps/api` for backend changes):

```bash
# web
cd apps/web && npx tsc --noEmit && npx eslint src --ext .ts,.tsx && npx vitest run && npx vite build
# api
cd apps/api && npx tsc --noEmit && npx eslint src --ext .ts && npx jest
# or the whole monorepo
turbo lint && turbo test && turbo build
```

"It should work" is not done. Show what passed.

---

## Golden rules (non-negotiable)

1. **Confidential system.** Never paste source, data, or docs into external services, web
   forms, or third-party tools. This is a private client project.
2. **Never bypass safety.** No `--no-verify`, no `--force` on shared branches. The pre-commit
   hooks (eslint + prettier + tests) exist for a reason. A hook already blocks `--no-verify`.
3. **Branch first.** Never edit on `main`. Feature branches are `osm-NNN-kebab-description`.
   Commit author is **Abdul0Mateen**.
4. **Don't push or open PRs without an explicit ask.** Editing is fine; pushing, PRs, and
   account switches need the user to say so each time.
5. **Reuse before building.** Inventory the design system first. Reuse an atom/molecule, or
   build into the right layer — never inline a new primitive in a page.
6. **Respect the atomic-design layer boundaries.** ESLint enforces them; a violation fails
   `pnpm lint`. See `.claude/rules/atomic-design.md`.
7. **Protect PII / anonymity.** Evaluators must never see candidate PII. Gate PII rendering on
   `canViewPII`, use `SafeStudentRef` in evaluator contexts. See
   `.claude/rules/shared-types-and-pii.md`.
8. **`SESSION-HANDOFF.md` is git-ignored on purpose** (confidential notes). Never commit it.

---

## Detailed conventions (in `.claude/rules/`)

| File                        | Covers                                                         |
| --------------------------- | -------------------------------------------------------------- |
| `atomic-design.md`          | Layer boundaries, reuse-first, keep-pages-thin                 |
| `typescript-conventions.md` | Naming, strictness, barrels, `@oses/types`                     |
| `web-conventions.md`        | React, Formik/Yup, React Query, Tailwind tokens, mock services |
| `api-conventions.md`        | NestJS module pattern, DTOs, guards, Swagger                   |
| `shared-types-and-pii.md`   | `@oses/types` contract, PII/anonymity                          |
| `domain-rules.md`           | Roles, anonymity, marking model, TRD divergences               |
| `testing-and-gates.md`      | Vitest/Jest, what to test, the verify gates                    |
| `git-and-safety.md`         | Branching, commits, PRs, confidentiality                       |

## Skills (in `.claude/skills/`)

`/developer` is the main build companion (triage → discover → design → build → review →
verify → hand off). `/pre-pr-review`, `/review-pr`, `/pr-resolver` for review.
`/commit-push`, `/create-pr`, `/ship` for git. `/handoff` to save/resume session state,
`/sync-docs` to keep docs in sync. See `.claude/README.md`.
