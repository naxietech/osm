# Web Conventions (`apps/web`)

React 18 + TypeScript + Vite. The app **runs entirely on mocks** — there is no live backend.

## Data layer — mock services

- Data comes from `src/services/*.service.ts`. Two patterns coexist:
  - Per-page `MOCK_*` constants for read-only screens.
  - A shared, mutable `src/services/mock-store.ts` for flows where a record created on one screen
    must be visible on another within a session (resets on refresh).
- Services return typed promises shaped like the real API will be. **Do not add `fetch`/axios to
  a live backend** — wire against the mock service. `api-client.ts` exists for when the backend
  lands; don't invent new HTTP calls now.
- Server-state fetching/caching uses **React Query** (`@tanstack/react-query`). Use it for async
  reads/mutations; don't hand-roll `useEffect` fetch-and-setState.

## Forms — Formik + Yup

- All forms use **Formik** for state and **Yup** for the validation schema. Do not hand-roll
  controlled-input state or ad-hoc validation. Dynamic/conditional fields fold into the Formik
  values + Yup schema (see the exam form for the reference).

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
