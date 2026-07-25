# Testing & Verify Gates

## Runners

- **`apps/web` → Vitest** + Testing Library (`@testing-library/react`, `user-event`,
  `jest-dom`), jsdom environment. Test files sit next to the code as `<name>.test.ts(x)`.
- **`apps/api` → Jest** + supertest. `*.spec.ts` for unit, `test/*.e2e-spec.ts` for e2e.

## What to test

- Any change that adds or alters behaviour worth protecting — services/logic, validation, state
  transitions, permission/PII gating, bug fixes — ships with tests. A bug fix starts with a test
  that reproduces the bug.
- Test **behaviour through the public surface**, not implementation details. For components, assert
  what the user sees/does (Testing Library), not internal state.
- Skip tests only for genuinely untestable changes (pure copy, comments, formatting) — and say so.
- Never edit app code just to make a test pass, and never delete/skip a test to force green — if a
  test exposes a real bug, surface it.

## Verify gates — run before claiming done

```bash
# web
cd apps/web && npx tsc --noEmit && npx eslint src --ext .ts,.tsx && npx vitest run && npx vite build
# api
cd apps/api && npx tsc --noEmit && npx eslint src --ext .ts && npx jest
# whole monorepo
turbo lint && turbo test && turbo build
```

Run the gate relevant to what you touched after each significant change, not only at the end —
catch regressions where they happen. Report actual results: if something fails, say so with the
output; don't claim done on unverified work.
