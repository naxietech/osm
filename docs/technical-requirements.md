# OSES — Technical Requirements Document

**Product:** OSES — On-Screen Exam System
**Scope:** Whole platform (all roles and modules)
**Status:** Draft v0.1
**Last updated:** 2026-07-02
**Confidentiality:** Restricted — national examination data. Do not distribute outside the project.

> This document describes the OSES platform as a whole: what exists today, and the
> requirements to complete it. Sections are tagged **[BUILT]**, **[PARTIAL]**, or
> **[PLANNED]** so the reader can tell current behaviour from target behaviour.
> Requirements for unbuilt modules are proposals and need product sign-off.

---

## 1. Introduction

### 1.1 Purpose

Define the functional and non-functional requirements for OSES, a national-scale,
on-screen examination and marking platform for Pakistan. It is the shared reference
for engineering, QA, and product.

### 1.2 Scale targets

| Dimension              | Target     |
| ---------------------- | ---------- |
| Enrolled students      | 1,000,000+ |
| Schools / institutions | 150+       |
| Subjects               | 7          |
| Exam cycles per year   | 3          |

### 1.3 Audience

Engineering (frontend, backend, worker), QA, product owners, and the examination board
stakeholders who approve business rules.

### 1.4 Glossary

| Term                  | Meaning                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| SSC                   | Secondary School Certificate (Matric) — Grades 9–10                                   |
| HSSC                  | Higher Secondary School Certificate (Intermediate) — Grades 11–12                     |
| Exam (session)        | A grade + cycle a candidate registers into once (e.g. "Grade 10 · Annual 2026")       |
| Paper                 | A subject paper under an exam; compulsory or elective                                 |
| Candidate             | A student registered for a specific exam                                              |
| Registration          | The link between a student and an exam                                                |
| Roll number           | Unique candidate identifier for an exam, assigned after the window closes             |
| Script / answer sheet | A candidate's scanned answer paper                                                    |
| E-Sheet               | The on-screen marking sheet / template a paper is marked against                      |
| `studentRefId`        | Non-PII UUID; the **only** student identifier ever exposed to evaluators              |
| PII                   | Personally Identifiable Information (name, CNIC/B-Form, DOB, contact, address, photo) |

---

## 2. System overview

OSES lets an examination board run the full exam lifecycle on screen:

1. **Onboard** schools and their students.
2. **Create** exams (grade + cycle) with subject papers.
3. **Register** students as candidates (done by their school) and assign roll numbers.
4. **Ingest** scanned answer sheets, split them into per-question segments (worker).
5. **Mark** those segments on screen (evaluators), blind to candidate identity.
6. **Compile and declare** results.

The platform is role-based; each role sees only what it needs, and student PII is
strictly withheld from evaluators.

---

## 3. Roles & permissions

Four roles (`@oses/types` → `UserRole`):

| Role           | Who                          | Summary                                                 |
| -------------- | ---------------------------- | ------------------------------------------------------- |
| `ADMIN`        | Board / system administrator | Full control of schools, students, exams, and oversight |
| `CONTROLLER`   | Examiner / exam controller   | Runs exams, supervises marking, views all results       |
| `EVALUATOR`    | Checker / marker             | Marks answer segments; never sees PII                   |
| `SCHOOL_STAFF` | School staff                 | Manages and registers **their own** school's students   |

### 3.1 Permission matrix **[BUILT — client-side; must be re-enforced server-side]**

Source of truth today: `apps/web/src/hooks/use-permissions.ts`.

| Permission                         | ADMIN | CONTROLLER | EVALUATOR |  SCHOOL_STAFF  |
| ---------------------------------- | :---: | :--------: | :-------: | :------------: |
| View student PII                   |   ✓   |     ✓      |     ✗     | ✓ (own school) |
| Mark scripts                       |   ✗   |     ✗      |     ✓     |       ✗        |
| Supervise marking                  |   ✓   |     ✓      |     ✗     |       ✗        |
| Manage schools                     |   ✓   |     ✗      |     ✗     |       ✗        |
| Manage students                    |   ✓   |     ✗      |     ✗     | ✓ (own school) |
| Manage exams / assign roll numbers |   ✓   |     ✗      |     ✗     |       ✗        |
| Register candidates                |   ✓   |     ✗      |     ✗     | ✓ (own school) |
| View all results                   |   ✓   |     ✓      |     ✗     |       ✗        |
| View own-school results            |   ✗   |     ✗      |     ✗     |       ✓        |

> **Requirement:** the matrix above is currently enforced only in the UI. The backend
> MUST enforce every rule independently (RBAC guards + row-level scoping by `schoolId`).
> UI checks are convenience, never security.

---

## 4. Architecture

### 4.1 Monorepo (Turborepo + pnpm)

```
oses/
├── apps/
│   ├── web/     # Vite + React 18 + TypeScript frontend        [BUILT]
│   ├── api/     # NestJS (Express adapter) backend              [PARTIAL]
│   └── worker/  # Python 3.11 OpenCV scan processor            [PLANNED]
└── packages/
    ├── types/            # Shared TypeScript contract (@oses/types), zero runtime deps
    ├── eslint-config/    # Shared lint rules
    ├── prettier-config/  # Shared formatting
    └── tsconfig/         # Shared TS base configs
```

### 4.2 Services & runtime

| Service                | Tech                                                                                       | Port | Status              |
| ---------------------- | ------------------------------------------------------------------------------------------ | ---- | ------------------- |
| Web                    | Vite, React 18, TypeScript, Tailwind v4, React Router 6, Formik + Yup, TanStack Query, Zod | 5173 | [BUILT] (mock data) |
| API                    | NestJS (Express), Zod DTOs, Swagger at `/api/docs`                                         | 3001 | [PARTIAL]           |
| Worker                 | Python 3.11, opencv-python, pyzbar, boto3, psycopg2, pydantic                              | —    | [PLANNED]           |
| Database               | PostgreSQL                                                                                 | —    | [PLANNED]           |
| Object storage / queue | AWS S3 (scans/crops), AWS SQS (scan jobs)                                                  | —    | [PLANNED]           |

### 4.3 API conventions

- **Base path / versioning:** `/api/v1/...`, endpoints kebab-case (`GET /api/v1/schools`).
- **Response envelopes** (`@oses/types` → `api.types.ts`):
  - Success: `ApiResponse<T>` = `{ success, data, message?, timestamp }`
  - List: `PaginatedResponse<T>` = envelope + `pagination { total, page, limit, totalPages }`
  - Error: `ApiError` = `{ success: false, error, message, statusCode, timestamp }`
- **Auth:** JWT access + refresh (`AuthTokens { accessToken, refreshToken, expiresIn }`);
  `JwtPayload { sub, email, role, schoolId?, iat, exp }`. `schoolId` in the token scopes
  school-staff queries.
- **Shared types:** both web and api import from `@oses/types`; a type is never duplicated.

### 4.4 Frontend design system (Atomic Design, ESLint-enforced imports)

Atoms → Molecules → Organisms → Templates → Pages, with strict one-directional imports.
Global CSS wired through `index.css`; class-based dark mode (`.dark`); design tokens in
`styles/colors.css` (role tokens) and `styles/palette.css` (primitives).

---

## 5. Domain model

Types live in `@oses/types`. **[BUILT]** = defined & used; **[PLANNED]** = required, not yet modelled.

### 5.1 User & auth **[BUILT]**

- `User` / `SafeUser` (`id, email, role, schoolId?, fullName, createdAt`) — `SafeUser` never carries a password.
- Auth DTOs: `LoginRequest`, `LoginResponse`, `AuthTokens`, `JwtPayload`.

### 5.2 School **[BUILT]**

`School` — `id, schoolCode, schoolName, registrationNo, institutionType, schoolLevel,
category, address, city, province, postalCode?, contactPerson*, onboardingStatus, isActive,
timestamps`. Enums: `InstitutionType`, `SchoolLevel` (SSC / HSSC / both), `SchoolCategory`,
`Province`, `OnboardingStatus`. PII-safe list view: `SchoolListItem`.

### 5.3 Student **[BUILT]** — PII-gated

`Student` — identity + documents + contact + address + enrollment
(`gradeId`, `enrollmentStatus`). Key rule: `studentRefId` (UUID) is the **only** identifier
exposed to evaluators.

- `SafeStudentRef` (`studentRefId, gradeId`) — evaluator-facing, zero PII.
- `StudentListItem` — admin/school list view, minimal PII.
- Full `Student` — ADMIN / CONTROLLER / own-school only.

> **Note:** an earlier "section" field was **removed** — the product has no student sections.

### 5.4 Exam & registration **[BUILT — this branch]**

- `Exam` (session) — `id, code, name, session, schoolLevel, gradeId, registrationOpensAt,
registrationClosesAt, status, papers[], createdAt`. `ExamStatus`: `draft →
registration_open → registration_closed → in_progress → completed`.
- `ExamPaper` — `id, examId, subject, totalMarks, paperDate, paperType` (`compulsory` |
  `elective`). Electives are a flat multi-select (no groups); no exam fee.
- `ExamRegistration` — `id, examId, studentRefId, schoolId, rollNumber?, electivePaperIds[],
status` (`pending | confirmed | withdrawn`), `registeredAt`.

### 5.5 Marking domain **[PLANNED]** (from the worker pipeline design)

Proposed PostgreSQL entities to support scanning and on-screen marking:

- `answer_sheet` — a scanned script; `qr_identifier` links a physical page to a candidate.
- `question` — per-paper question with **crop coordinates** (region on the page) and max marks.
- `answer_segment` — a cropped image of one candidate's answer to one question (what an evaluator marks).
- `scan_batch` — an upload batch with status (`pending → processing → complete → failed`).
- `mark` / `evaluation` — an evaluator's score for an `answer_segment` (+ moderation/double-marking metadata).
- `result` — compiled per-candidate outcome (obtained marks, grade, pass/fail, declared date).

> These names/columns are derived from `apps/worker/README.md` and must be finalised in a
> data-model design review before implementation.

---

## 6. Functional requirements by module

### 6.1 Authentication & session **[PARTIAL — mock on web]**

- FR-AUTH-1: Email/password login returns `LoginResponse` (user + access/refresh tokens).
- FR-AUTH-2: Access token carries role + `schoolId`; expiry via refresh token rotation.
- FR-AUTH-3: Route access is role-gated (web: `ProtectedRoute` + `RoleRoute`; api: guards).
- FR-AUTH-4: Logout invalidates the refresh token server-side.
- Current: `authService` is a mock (5 demo users, shared password). Real `/api/v1/auth/*` required.

### 6.2 Schools **[BUILT — web, mock]**

- FR-SCH-1..n: ADMIN creates, lists, edits schools; tracks `onboardingStatus`, `isActive`.
- List is PII-safe (`SchoolListItem`). Backend CRUD + pagination + search required.

### 6.3 Students **[BUILT — web, mock]**

- FR-STU-1: ADMIN and SCHOOL_STAFF (own school) create/edit students; school locked for staff.
- FR-STU-2: PII entered here never appears in list views or evaluator contexts.
- FR-STU-3: Enrollment status lifecycle (`active | inactive | transferred | graduated`).
- Backend CRUD + `studentRefId` generation + PII-scoped responses required.

### 6.4 Exams & candidate registration **[BUILT — web, mock]**

- FR-EX-1: ADMIN creates an exam (grade + cycle) and its papers (compulsory/elective).
- FR-EX-2: ADMIN opens registration; only then can schools register.
- FR-EX-3: SCHOOL_STAFF bulk-registers eligible students (own school, matching grade,
  active, not already registered), optionally choosing any number of elective papers.
- FR-EX-4: A school sees its registered candidates per exam, and can still view them
  **after the window closes** (not only while open).
- FR-EX-5: ADMIN closes registration and assigns sequential roll numbers (candidates → confirmed).
- FR-EX-6: CONTROLLER (and ADMIN) view the full candidate list per exam.
- **Backend requirements to productionise:**
  - Stable primary keys for papers (so editing an exam never orphans elective choices).
  - Server-side lifecycle enforcement: no registration unless `registration_open`; papers
    locked once registration has opened.
  - Roll-number generation is idempotent and unique per exam.

### 6.5 E-Sheet templates & generation **[PLANNED]**

- FR-ES-1: Define a paper's on-screen marking template (question layout, mark scheme, crop regions).
- FR-ES-2: Generate per-candidate e-sheets from confirmed registrations + scanned scripts.
- Routes exist as stubs (`/…/e-sheet/*`). Requirements to be detailed with the board.

### 6.6 Scan ingestion & segmentation (worker) **[PLANNED]**

- FR-SCAN-1: School/board uploads scanned answer sheets → creates a `scan_batch`; API enqueues an SQS job.
- FR-SCAN-2: Worker deskews pages, reads the QR to match `answer_sheet.qr_identifier`,
  crops each question region using `question` coordinates, stores crops in S3, writes
  `answer_segment` rows, and marks the batch complete.
- FR-SCAN-3: Failures are retryable and observable; partial batches are reported.

### 6.7 Question assignment **[PLANNED]**

- FR-QA-1: CONTROLLER/ADMIN assign question segments to evaluators (balanced workload).
- FR-QA-2: Support double-marking / moderation where required.

### 6.8 Marking / evaluation **[PLANNED]**

- FR-MK-1: EVALUATOR sees a queue of `answer_segment`s identified only by `studentRefId` — **never PII**.
- FR-MK-2: Enter a score per segment against the mark scheme; support flagging/escalation.
- FR-MK-3: Track history and throughput per evaluator.

### 6.9 Results compilation & declaration **[PLANNED / minimal]**

- FR-RES-1: Aggregate marks per candidate across a paper's segments and across papers.
- FR-RES-2: Compute grade + pass/fail per the board's rules; controller approves declaration.
- FR-RES-3: Schools see their own results; ADMIN/CONTROLLER see all. A student profile shows
  their exam/registration history (service exists; UI wiring pending).

### 6.10 Dashboards & reporting **[PARTIAL — mock visuals]**

- Per-role landing dashboards exist with placeholder charts; must be wired to live aggregates
  (e.g. school "Registered for Exam" count is currently hard-coded).

---

## 7. Non-functional requirements

### 7.1 Security & privacy (highest priority)

- NFR-SEC-1: **PII isolation** — evaluator-facing APIs return only `SafeStudentRef`; PII is
  filtered server-side, not just hidden in the UI.
- NFR-SEC-2: RBAC enforced on every endpoint; school-staff queries row-scoped to their `schoolId`.
- NFR-SEC-3: JWT access/refresh with rotation; secrets never in the client; HTTPS only.
- NFR-SEC-4: Audit log for sensitive actions (mark entry, result declaration, roll-number
  assignment, PII access).
- NFR-SEC-5: No PII in URLs, logs, query strings, or analytics.
- NFR-SEC-6: Confidential handling — no examination data leaves controlled infrastructure.

### 7.2 Scale & performance

- NFR-PERF-1: All list endpoints paginated (`PaginatedResponse`) and indexed for 1M+ students.
- NFR-PERF-2: Bulk operations (class registration, roll-number assignment, scan batches)
  handled in batches / background jobs, not synchronous request cycles.
- NFR-PERF-3: Marking UI responsive under concurrent evaluator load during peak cycles.

### 7.3 Reliability & data integrity

- NFR-REL-1: Stable database primary keys; edits never orphan child references.
- NFR-REL-2: State machines enforced server-side (exam lifecycle, scan batch, marking).
- NFR-REL-3: Idempotent, retryable worker jobs; at-least-once SQS handling with dedupe.
- NFR-REL-4: Backups + point-in-time recovery for PostgreSQL; S3 versioning for scans.

### 7.4 Availability

- NFR-AV-1: Target high availability during exam cycles (3× per year); graceful degradation
  of non-critical dashboards.

### 7.5 Usability & accessibility

- NFR-UX-1: Design-system consistency (Atomic Design); WCAG-minded (keyboard, labels, contrast).
- NFR-UX-2: Reduced-motion respected; light/dark themes both legible (native controls follow app theme).
- NFR-UX-3: Localisation-ready (English now; Urdu a likely future requirement — to confirm).

### 7.6 Maintainability & quality

- NFR-MNT-1: Shared `@oses/types` is the single contract; no duplicate types across web/api.
- NFR-MNT-2: Lint + format gates (ESLint, Prettier) via pre-commit; typed end-to-end.
- NFR-MNT-3: Tests: unit (services), component (design system), and integration for API modules.

### 7.7 Observability

- NFR-OBS-1: Structured logs, request tracing, worker job metrics, error reporting.

### 7.8 Browser support

- NFR-BR-1: Latest Chrome/Edge/Firefox/Safari; the marking UI targets desktop.

---

## 8. Representative API surface (proposed)

All under `/api/v1`, envelope + pagination as in §4.3, RBAC per §3.

| Area         | Endpoints (illustrative)                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Auth         | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`                                                                     |
| Schools      | `GET/POST /schools`, `GET/PATCH /schools/:id`                                                                                     |
| Students     | `GET/POST /students`, `GET/PATCH /students/:id` (PII-scoped)                                                                      |
| Exams        | `GET/POST /exams`, `GET/PATCH /exams/:id`, `POST /exams/:id/open`, `POST /exams/:id/close-and-assign-rolls`                       |
| Registration | `GET /exams/:id/eligible-students`, `POST /exams/:id/registrations` (bulk), `GET /exams/:id/candidates`, `GET /schools/:id/exams` |
| Scans        | `POST /scan-batches`, `GET /scan-batches/:id`                                                                                     |
| Marking      | `GET /marking/queue`, `POST /answer-segments/:id/mark`                                                                            |
| Results      | `GET /exams/:id/results`, `POST /exams/:id/declare`, `GET /students/:refId/history`                                               |

> Exact contracts to be finalised per module using the schools module as the reference pattern.

---

## 9. Current implementation status (honest snapshot)

| Module                  | Web UI                        | Backend | Data                                     |
| ----------------------- | ----------------------------- | ------- | ---------------------------------------- |
| Auth                    | ✓ (mock login)                | ✗       | Mock users                               |
| Schools                 | ✓ CRUD                        | ✗       | Mock                                     |
| Students                | ✓ CRUD (PII-gated)            | ✗       | Mock                                     |
| Exams & registration    | ✓ full flow                   | ✗       | In-memory mock store (resets on refresh) |
| E-Sheet / templates     | Stub pages                    | ✗       | —                                        |
| Scan ingestion (worker) | —                             | ✗       | —                                        |
| Question assignment     | Stub                          | ✗       | —                                        |
| Marking / evaluation    | Stub                          | ✗       | —                                        |
| Results                 | Minimal (profile placeholder) | ✗       | Mock                                     |
| Dashboards              | ✓ (mock visuals)              | ✗       | Hard-coded                               |

**Overall:** the frontend is a working prototype against mocks; the API is scaffolded but
the modules, PostgreSQL schema, and the Python worker are not yet implemented.

---

## 10. Delivery roadmap (proposed phases)

1. **Foundation** — PostgreSQL schema, auth (real JWT), `@oses/types` finalised, api-client + React Query wiring.
2. **Core records** — Schools + Students modules (backend + web → live data).
3. **Exams & registration** — productionise the built flow (stable paper IDs, lifecycle locks, roll numbers).
4. **Scan pipeline** — worker + S3/SQS + `scan_batch`/`answer_segment`.
5. **Marking** — question assignment + evaluator UI (PII-blind) + moderation.
6. **Results** — compilation, declaration, student history, school/board reporting.
7. **Hardening** — audit, observability, performance for 1M+ scale, DR.

---

## 11. Assumptions, open questions & risks

**Open questions**

- Grading scheme and pass/fail rules per board — needs the examination board's authoritative spec.
- Double-marking / moderation policy (single vs. multi-marker; tie-breaking).
- Elective rules — are there minimum/maximum elective counts, or fully free choice? (Currently free multi-select.)
- Withdraw / amend a registration — is this required, and who may do it?
- Localisation — is Urdu required at launch?
- Fee handling — confirmed **out of scope** for now (no exam fee in the model).

**Risks**

- PII leakage if the backend does not independently enforce the evaluator gate — treat as critical.
- Scale: naïve queries over 1M students will not hold; indexing/pagination/batching are mandatory.
- Scan accuracy (deskew/QR/crop) directly affects marking integrity.

---

## 12. Out of scope (this version)

- Exam fees / payments.
- Student self-service accounts (students are not system users; schools act for them).
- Automated/AI marking (marking is human via the evaluator UI).
- Native mobile apps.

---

_End of document. This is a living draft; update the status tags as modules land._
