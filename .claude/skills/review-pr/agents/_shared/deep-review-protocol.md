# Deep Review Protocol

This protocol applies to every review agent and **overrides any "Review Scope" default in the agent prompt below it**. Review like an engineer who understands the system — not like a linter that only reads changed lines.

## 1. Review the real code, not the diff text

The PR branch is checked out in the local working tree. The diff tells you _what_ changed; the working tree tells you what the code actually does now.

- Read every changed file **in full** from the working tree.
- Read the code around the change: callers of changed components/hooks/services, the modules the changed code imports, related routes, atomic-design layers (atoms/molecules/organisms/templates), `@oses/types` shapes, mock services, and mock-store.
- Grep for every usage of any symbol whose name, signature, return shape, or behavior changed. A change is only safe when its consumers still hold.

## 2. Trace the data flow end to end

For the main flow the PR touches, walk the full path before judging any single line. The two app flows:

```
apps/web:  route / page (react-router)
  → template → organism → molecule → atom
  → service (mock) in src/services/*.service.ts → mock-store
  → React Query cache → rendered UI

apps/api:  controller
  → ZodValidationPipe (Zod DTO) → service
  → TransformInterceptor → ApiResponse<T> envelope
```

Understand how the changed code behaves inside that wider flow. A line that looks fine in isolation can still break the flow around it. Remember: the web app runs **entirely on mocks** — there is no live backend, no database, no ORM, no migrations, no queues.

## 3. Compare new behavior vs previous behavior

You are reviewing a **change**, not a snapshot. Establish the exact before/after delta:

- `git diff origin/<base>...HEAD -- <file>` for the change itself
- `git show origin/<base>:<path>` to read the previous version when the diff hunks alone are not enough
- If your tools do not include Bash, rely on the diff and the behavior-delta note in the Context Pack provided in your prompt — they carry the before/after picture for you.
- State precisely: what did this code do before, what does it do now, and which inputs or state hit the difference. A regression risk you cannot describe as a before/after delta is probably not one.

## 4. Impact checklist

For each meaningful change, check its impact on:

- **Related features** that share the touched code paths
- **Atomic-design layer boundaries** — lower layers (atoms/molecules) must not import higher ones (organisms/templates/pages); ESLint enforces this, so a violation is a real break
- **`@oses/types` single source of truth** — a shape shared across web+api or across modules belongs in `@oses/types`, not duplicated locally; enums/helpers are imported as values
- **Mock-store & mock-service consistency** — what a mock service returns must match its declared `@oses/types` type and stay consistent across services
- **Zod DTO / type inference (api)** — DTO types should be `z.infer`red, not hand-declared parallel interfaces that can drift
- **Edge cases** — null/empty/zero, boundaries, first/last page, empty lists, very large lists
- **Error handling** — silent failures, swallowed promise rejections, missing error/empty/loading states in React Query
- **Validation and authorization** — RBAC: route guards key off the legacy `UserRole` enum, but fine-grained capability (e.g. viewing PII) is a **grant** via `usePermissions()`; prefer grant checks over role checks
- **PII / candidate anonymity** — evaluators must never receive or render candidate PII (`fullName`, `cnicOrBform`, `dateOfBirth`); evaluator contexts use `SafeStudentRef`, and PII rendering is gated on the `students.viewPII` grant
- **Performance & scale** — the platform targets 1,000,000+ students: unvirtualized long lists, unbounded `.map` over huge arrays, unnecessary re-renders, unstable keys/props, heavy work on every render
- **React Query caching** — stale keys, missing/duplicated query keys, refetch storms, missing invalidation after a mutation
- **No accidental live-backend calls** — web data must go through the mock service layer, not raw `fetch`/`axios` to a real backend
- **API/response contracts** — the `ApiResponse<T>` envelope (`{ success, data, message?, timestamp }`) consumed by typed clients / React Query
- **Tests** — does the changed behavior have a test (Vitest on web, Jest on api) that would catch a regression?

## 5. Report only what matters

Add a finding **only** when it is one of:

- a real bug or correctness issue
- a regression risk against previous behavior
- a security or authorization gap
- a PII / candidate-anonymity leak
- a production reliability risk (render performance, large lists, cache correctness, mock/live-call boundary)
- a missing test for changed behavior worth protecting
- genuinely unclear behavior that will mislead the next engineer
- an improvement with concrete correctness, security, or maintainability impact

Do **not** report: formatting, naming preferences, style opinions, hypothetical issues with no realistic trigger, or pre-existing problems this PR did not touch or worsen. If ESLint, Prettier, and the project rules don't complain, you don't either. Fewer, deeper findings beat many shallow ones.

## 6. Finding anatomy — all four parts required

Every finding must contain:

1. **What's wrong or risky** — the defect, precisely, with file:line
2. **Why it matters in this codebase** — tied to a real rule, flow, or constraint of _this_ project (candidate anonymity, atomic-design boundaries, the `@oses/types` single source, RBAC grant-vs-role, the TRD marking divergence…), not a generic best practice
3. **Which behavior or flow is affected** — the user-visible or system flow that breaks or degrades, e.g. "evaluator marking flow" or "candidate enrollment: soft-register → print → confirm"
4. **A practical fix** — what to change, concretely

A finding you cannot fill all four parts for is a finding you should drop.
