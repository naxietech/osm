# Web Conventions (`apps/web`)

React 18 + TypeScript + Vite. **Auth, users and roles are live; everything else is still mocks.**

## Data layer — three live modules, the rest mocked

- **Live:** `auth.service.ts` (`/auth/login`, `/auth/me`, `/auth/permissions`, `/auth/refresh`,
  `/auth/logout`, `/auth/password/change`), `users.service.ts` (`/users` list + create,
  `/users/:id/reset-password`, `/users/:id/status`) and `roles.service.ts` (`/roles`).
  `use-auth` and `use-permissions` read from the first. Every request goes through
  `api-client.ts`.
- **`VITE_API_BASE_URL`** is read once, in `lib/constants.ts`. `apps/web/.env` is git-ignored, so
  it falls back to the dev address there and throws on a production build with no value — never
  read `import.meta.env` for it at a call site.
- **Mocked:** every other `src/services/*.service.ts`. Two patterns coexist:
  - Per-page `MOCK_*` constants for read-only screens.
  - A shared, mutable `src/services/mock-store.ts` for flows where a record created on one screen
    must be visible on another within a session (resets on refresh).
- **Do not add `fetch`/axios calls for a module the API doesn't have yet** — the backend today is
  auth + users + roles only (`apps/api/src/auth`). Wire new screens against the mock service and
  say so. When a module's API does land, route it through `apiRequest` from `api-client.ts`; never
  call `fetch` directly from a service or page.
- `api-client.ts` is the interceptor: it owns cookies, envelope unwrapping, error mapping, and the
  401 renewal. It sends HttpOnly cookies (`credentials: 'include'`) — there is no token to read or
  attach, and nothing auth-related belongs in `localStorage`.
- **Endpoint paths live in `services/api-endpoints.ts`**, never inline at a call site — the
  request-side counterpart to `router/routes.ts`. `api-client` matches on those same constants to
  decide which requests may trigger a renewal.
- **Don't restate an API error message in the UI.** `apiErrorMessage()` in `api-client.ts` passes
  the server's wording through and only substitutes where there is nothing usable (429, 5xx, no
  response). Policy detail — lockout thresholds, password rules — belongs in the API's message;
  duplicating a backend constant in UI copy is how the copy goes stale.
- **`BrowserRouter` sits above `AuthProvider`** so the provider can read the current route and skip
  the `GET /auth/me` session check on public pages. **Any new public route must be added to
  `PUBLIC_ROUTES` in `router/routes.ts`**, or opening it costs two wasted auth requests (the failed
  check plus the renewal attempt behind it). Test wrappers must mirror this nesting.
- Server-state fetching/caching uses **React Query** (`@tanstack/react-query`). Use it for async
  reads/mutations; don't hand-roll `useEffect` fetch-and-setState.

## Forms — Formik + Yup

- All forms use **Formik** for state and **Yup** for the validation schema. Do not hand-roll
  controlled-input state or ad-hoc validation. Dynamic/conditional fields fold into the Formik
  values + Yup schema (see the exam form for the reference).

## Confirming an action — always a modal

- **Any action worth pausing on is confirmed through `ConfirmDialog`** — never an inline banner,
  an `Alert` with buttons, a second click on the same control, or `window.confirm`. It lives in
  `design-system/molecules/modal`. One component means one look, one focus trap, one busy
  state, and one place to fix a bug in all of them.
- Confirm the **destructive direction only**. Deactivating, suspending, deleting, revoking,
  de-anonymising and overwriting all ask first; activating, restoring and re-enabling just
  happen — a dialog on a harmless action trains people to click through the dangerous one.
- Pass `tone="danger"` when the action takes something away, and `busy` while the request is in
  flight so the dialog cannot be double-submitted or dismissed mid-write.
- Say what will actually happen, including anything the user cannot undo, in `description` —
  not just "Are you sure?". Reference: `users-list.page.tsx` (suspend) and
  `setup/classes.page.tsx` (deactivate).

## Styling — Tailwind v4 tokens

- Tailwind **v4** with CSS-variable design tokens (defined in `src/index.css` / the theme). Style
  with token-based utility classes; use `clsx` + `tailwind-merge` for conditional classes.
- **Reserved marking colours — do not repurpose:** green = correct, red = incorrect, amber =
  partial (both partial bands are amber). Never use these three for unrelated UI states.
- Icons come from the `Icon` atom (wraps `lucide-react`) — no inline `<svg>`.

## Routing

- `router/routes.ts` — `ROUTES`: the single source of every path.
- `router/modules/<name>.routes.tsx` — a per-module route factory taking the role's home path.
- `router/router.tsx` — the role shells composing those factories.
- A module shared by several roles is declared **once** and composed per role, so it can't be
  updated for one role and missed on another. Pages are grouped **by feature, not by role**.

## Charts

Dashboards use **recharts**. Reuse existing chart wrappers before adding new chart code.
