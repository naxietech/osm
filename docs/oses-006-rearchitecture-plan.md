# OSES — Re-architecture Plan (osm-006 expansion)

**Status:** Draft for approval — planning only, no code yet
**Date:** 2026-07-17
**Scope:** Frontend on mocks (same as current branch). Every change below is web + `@oses/types` + mock services.
**Companion to:** `flow-decisions.md`, `technical-requirements.md`, `oses-module-details.md`

---

## 0. What triggered this

Five changes requested, now locked into decisions:

1. **Dynamic roles & permissions** — replace the hardcoded 4-role model with data-driven roles the super admin creates and grants permissions to.
2. **New super-admin reference modules** — Institute Category, Subjects, Classes (and the Groups/Curriculum we already have).
3. **Multi-client (white-label)** — one app, per-client config: enabled modules + theme resolved per client at login.
4. **Exam scope change** — an exam can target one / several / all institutes, and cover one or several subjects (still one class per exam).
5. **Terminology** — "School" becomes "Institute" across the product.

### Locked decisions (from planning Q&A, 2026-07-17)

| Topic                       | Decision                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-client model          | **One app, per-client config** (multi-tenant). Build the `Client` concept now; one client active.                                              |
| RBAC depth                  | **Full**: permission catalog + super-admin management UI + per-institute **scope** (`all` \| `own-institute`).                                 |
| Exam scope                  | **One class (level+group) per exam**, plus institute scope (one/many/all) + subject scope (one/many) on top.                                   |
| Super Admin                 | **New** top role (replaces `ADMIN`), full access.                                                                                              |
| Institute                   | `SCHOOL_STAFF` renamed.                                                                                                                        |
| Checker                     | `EVALUATOR` renamed.                                                                                                                           |
| Controller                  | **Removed** from defaults; super admin can recreate it later as a custom role.                                                                 |
| Extra default roles         | None.                                                                                                                                          |
| Users per institute         | **Many users, one role each** (`user.roleId` single). Reverses the old "one shared login per institute".                                       |
| Who manages institute users | **Super admin only** — institutes don't create their own logins. Adds a super-admin **Users** module.                                          |
| Role source                 | **Global + per-institute custom** — super admin seeds default institute roles; institute-owned custom roles also allowed (`Role.instituteId`). |

---

## 1. Workstream A — Terminology: School → Institute

Pervasive rename. Kept as its own step so it doesn't tangle with logic changes.

- **Types:** `School`→`Institute`, `SchoolListItem`→`InstituteListItem`, `CreateSchoolDto`/`UpdateSchoolDto`→`Institute…`, `schoolId`→`instituteId` (on `SafeUser`, `JwtPayload`, `ExamRegistration`, etc.), `SchoolLevel`/`SchoolCategory` reviewed (keep enum values, rename symbols).
- **Code:** services (`school.service`→`institute.service`, mock store keys), pages/routes (`/schools`→`/institutes`), design-system organisms (`school-form`, etc.), nav labels.
- **Approach:** mechanical, one commit, tsc + eslint + tests green after. `institutionType` (govt/private) and `InstitutionKind` (school/college/university) already exist and stay.

> **Open Q1:** "Institute Category" (new module, §3) vs the existing `institutionType` (Government/Private/Federal/Other) and `InstitutionKind` (school/college/university) — is Category a _third_, super-admin-managed taxonomy, or does it replace one of these? Assumed: **new taxonomy** (`InstituteCategory` reference table) that sits alongside both.

---

## 2. Workstream B — Dynamic RBAC (roles, permissions, scope)

The biggest change. Replaces the `UserRole` enum + hardcoded `usePermissions` matrix with data.

### New types (`@oses/types`)

```ts
// A capability, namespaced module.action
type PermissionAction =
  | 'clients.manage'
  | 'roles.manage'
  | 'users.manage'
  | 'institutes.manage'
  | 'institute-categories.manage'
  | 'subjects.manage'
  | 'levels.manage'
  | 'groups.manage'
  | 'curriculum.manage'
  | 'students.manage'
  | 'students.viewPII'
  | 'exams.manage'
  | 'exams.assignRolls'
  | 'registrations.manage'
  | 'marking.mark'
  | 'marking.supervise'
  | 'results.viewAll'
  | 'results.viewOwn'
  | 'dashboard.view';

type PermissionScope = 'all' | 'own-institute';

interface PermissionGrant {
  action: PermissionAction;
  scope: PermissionScope;
}

interface Role {
  id: string;
  name: string; // 'Super Admin', 'Institute', 'Checker', or custom
  isSystem: boolean; // system roles can't be deleted; grants editable per policy
  instituteId?: string; // set = custom role OWNED BY one institute; unset = global/system
  grants: PermissionGrant[];
  createdAt: string;
}
```

- `SafeUser` gains `roleId` (**single** — one role per user) and keeps `instituteId`; the `UserRole` enum is retired (or kept only as seed ids for a transition).
- **Many users per institute:** several `SafeUser`s share one `instituteId`, each with its own `roleId`. This **reverses** the old "one shared School Staff login" decision in `flow-decisions.md` (login was the institute's contact email) — now each institute user is a distinct named login.
- **Role ownership:** a `Role` with no `instituteId` is global (system defaults + super-admin globals). A `Role` with an `instituteId` is a **custom role owned by that institute** and only assignable to that institute's users.

### Seed system roles

| Role            | Grants (action · scope)                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Super Admin** | every action · `all`                                                                                                   |
| **Institute**   | `students.manage`·own, `students.viewPII`·own, `registrations.manage`·own, `results.viewOwn`·own, `dashboard.view`·own |
| **Checker**     | `marking.mark`·all, `dashboard.view`·all — **no PII**                                                                  |

### Refactor `usePermissions`

- New API: `can(action)` and `scopeFor(action): PermissionScope | null`, both reading the current user's role grants. Keep the existing boolean getters as thin wrappers over `can(...)` so callers don't all change at once.
- Route gating (`RoleRoute`/`ProtectedRoute`, `router.tsx`): switch from `allowedRoles={[UserRole.X]}` to `requirePermission="students.manage"`. `role-layout` nav items filter by `can(...)`.
- **Scope enforcement (UI-level, mock):** where scope is `own-institute`, list/detail queries filter to `user.instituteId`. (Server must re-enforce later — already noted in technical-requirements NFR-SEC-2.)

### Super-admin management UI (new modules)

- **Users** (new) — super admin creates/edits every user: email, name, **institute** (for institute users), and **role**. This is the only place logins are created (institutes cannot add users). Many users can share one institute.
- **Roles** — list → create / edit / (delete custom only). Global roles + institute-owned custom roles (filterable by institute).
- **Permission matrix editor:** module × action grid with a per-row scope toggle (`all` / `own-institute`) where scope is meaningful.

> **Open Q2:** For **custom** roles, can grants use `all` scope on institute-scoped actions (i.e. a custom "regional" role that sees many institutes)? Assumed **yes** — scope is per-grant.

> **Open Q6 (nuance from "global + per-institute custom"):** Since **super admin manages all users** but institutes may have **custom roles**, who physically _creates_ an institute's custom role? Assumed: **super admin creates it and tags it to the institute** (`Role.instituteId`), OR — if institutes get a read-only-ish "Roles" screen — an institute user holding `roles.manage · own-institute` defines it and super admin assigns it. Defaulting to **super-admin-created, institute-tagged** for the mock; confirm if institutes should self-author roles.

---

## 3. Workstream C — Super-admin reference modules

Reference data the rest of the system points at. Types mostly exist; what's missing is **CRUD UI + writable mock services** (today `academic.service.ts` is read-only seed).

| Module                 | Type                | Status         | Work                                    |
| ---------------------- | ------------------- | -------------- | --------------------------------------- |
| **Classes** (Levels)   | `Level`             | type ✓, seed ✓ | CRUD screens + writable service         |
| **Subjects**           | `Subject`           | type ✓, seed ✓ | CRUD screens + writable service         |
| **Groups/Programs**    | `Group`             | type ✓, seed ✓ | CRUD screens (may fold into Classes UI) |
| **Curriculum**         | `CurriculumEntry`   | type ✓, seed ✓ | CRUD screens (level+group → subjects)   |
| **Institute Category** | `InstituteCategory` | **new**        | type + seed + CRUD screens              |

- Promote `academic.service.ts` from read-only seed to a mutable mock store (add/edit/deactivate), same pattern as the other mock services.
- All gated behind `subjects.manage`, `levels.manage`, `institute-categories.manage`, etc.

---

## 4. Workstream D — Multi-client (tenancy)

One app; a client/tenant decides enabled modules + branding.

### New types

```ts
interface Client {
  id: string;
  name: string;
  theme?: ClientTheme;          // brand color(s), logo, etc.
  enabledModules: ModuleKey[];  // which nav/routes are on
  // customUI?: future extension point (client-specific component overrides)
}
type ModuleKey = 'institutes' | 'students' | 'exams' | 'marking' | 'results' | 'roles' | 'reference-data' | ...;
```

- **Resolution:** mock — client resolved at/after login (e.g. from the user or a picker); `ClientProvider` context exposes `useClient()`.
- **Module gating:** nav + routes check `enabledModules` (in addition to RBAC `can(...)`). A module shows only if the client enables it **and** the role permits it.
- **Theming:** per-client theme applied as CSS-variable overrides on a root wrapper, layered over the existing `colors.css` token system (no fork of the token layer). Brand color/logo swap first; deeper theming later.
- **Custom UI per client:** keep light for now — `enabledModules` + theme cover most needs. Record `customUI` as a named extension point (feature flags / component override registry) to design when a real divergent client appears.

> **Open Q3:** How is the active client chosen in the mock — fixed single client, a dev switcher, or derived from the logged-in user? Assumed: **derived from user**, with a dev-only switcher for demos.

---

## 5. Workstream E — Exam scope (institute + subject targeting)

Keep **one class (level+group) per exam**; add targeting.

### Type change (`exam.types.ts`)

```ts
interface Exam {
  // ...existing (code, name, session, levelId, groupId, window, status, papers)
  instituteScope: 'all' | 'selected';
  instituteIds?: string[]; // required when scope = 'selected'
}
```

- **Subjects:** already modelled — `papers[]` can hold one or many, drawn from the class's curriculum. "One subject vs multiple" is satisfied by how many papers are added; no new type needed. (Confirm we don't want a subject-count constraint.)
- **Registration eligibility:** today implicitly all institutes. New rule: an institute may register only if `instituteScope === 'all'` **or** its id ∈ `instituteIds`. Applies in the enrollment UI (institute side) and the candidate list (super-admin side).
- **UI:** exam create/edit gains an institute-scope control (All institutes / pick institutes). Roll-number blocking stays per-institute.

> **Open Q4:** When scope = `selected`, can the institute set change **after** registration opens? Assumed **no** — locked once `registration_open` (mirrors the existing "papers locked once open" rule).

---

## 6. Sequencing

Dependencies: RBAC and the rename underpin everything; tenancy layers onto the same nav/routes RBAC touches; exam scope is fairly self-contained.

1. **A — Rename** School→Institute (mechanical, unblocks clean naming everywhere).
2. **B — RBAC** model + `usePermissions` refactor + route/nav gating + super-admin role management UI.
3. **C — Reference modules** (Institute Category new; writable services + CRUD for Subjects/Classes/Groups/Curriculum), gated by B.
4. **D — Tenancy** (Client model, module gating, theming) — layered on B's nav/routes.
5. **E — Exam scope** (institute + subject targeting, eligibility) — can run in parallel with C/D.

Each step ends green on tsc + eslint + tests + build, same gate discipline as before.

---

## 7. Reconciliation with current osm-006 tasks

- **#41 School module (kind + code + login)** → becomes **Institute module** under Workstream A + C. Its "kind + login" work still applies, just renamed.
- **#44 Enrollment withdraw**, **#45 Bulk upload**, **#46 Verify** — still valid; #44/#45 should land on the _renamed_ Institute/enrollment code, so ideally after Workstream A.
- On approval I'll restructure the task list to match the five workstreams above.

---

## 8. Open questions (consolidated — need your call)

1. **Institute Category** — new third taxonomy, or replaces `institutionType` / `InstitutionKind`? _(assumed: new)_
2. **Custom roles** — may super admin grant `all` scope on institute-scoped actions? _(assumed: yes)_
3. **Active client selection** in the mock — from user, fixed, or dev switcher? _(assumed: from user + dev switcher)_
4. **Exam institute set** — editable after registration opens? _(assumed: no, locked)_
5. **Subject count** — any min/max subjects per exam, or free? _(assumed: free)_
6. **Institute custom roles** — created by super admin (tagged to the institute), or self-authored by an institute user with `roles.manage · own-institute`? _(assumed: super-admin-created, institute-tagged)_

> **Note:** this plan reverses the `flow-decisions.md` "one shared School Staff login per institute" decision. On approval that log gets updated to "many named users per institute, one role each, created by super admin."

---

_Draft for discussion. Nothing built until this is approved; assumptions above become decisions once you confirm._
