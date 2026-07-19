# OSES — Flow Decisions Log

**Purpose:** A running record of the product/flow decisions we lock during planning, so they
aren't lost between sessions. Grouped by area. "Confirmed" = decided by the client;
"Recommended" = proposed default, awaiting confirmation.

**Started:** 2026-07-03

---

## School registration & login

> **⚠️ SUPERSEDED (2026-07-17) — see `oses-006-rearchitecture-plan.md`.** "School" is renamed
> **Institute** across the product. The **one-shared-login** rule below is reversed: an institute
> now has **many named users, one role each**, all **created by the super admin** (institutes
> can't self-manage logins). Login is no longer tied to the contact email. The password/reset
> mechanics below still apply per-user. Roles are now dynamic (super admin, institute, checker +
> custom) rather than the fixed 4-role enum.

**Confirmed (original — mostly superseded by the note above)**

- Registering a school also creates **one shared School Staff login** for that school (one
  account per school, used by all its staff).
- **Login username = the school's Contact Email** (so contact email must be unique; if it
  changes, the login changes with it).
- **The Admin sets the initial password** when registering the school — a **Password** +
  **Confirm Password** section is added to the Add School form. The Admin shares the
  credentials with the school.
- Password rules: **minimum 8 characters**, stored hashed. After creation the Admin can
  **reset** it (set a new one) but not **view** it.
- **Forgot password → Admin resets** it (no email-based self-service in the MVP).
- **School marked inactive → its login is disabled.**
- The school can **change its password** from its portal. Forcing a change on first login is
  **optional** (off for MVP).
- Each school is also given a **numeric school code** (auto-assigned, e.g. 4 digits) alongside
  its existing school code — used to build student registration numbers and to block roll
  numbers by school.

---

## Students — adding & managing

**Confirmed**

- Schools add students **two ways**: the **single-student form** (built) **and a bulk upload**.
- Bulk upload: **download a template** → fill the spreadsheet → upload → **per-row validation**
  (same rules as the form) → **valid rows import, invalid rows are skipped and listed with a
  reason per row** → school fixes those and re-uploads.
- The **school is locked** to the logged-in school (not a column in the sheet).
- **Photos are not in the bulk sheet** — students import without a photo; a photo can be added
  later per student. Photo stays optional.
- **Duplicate check:** block a repeat **CNIC/B-Form** (when present); flag a likely duplicate on
  **Full Name + Father Name + Date of Birth**.
- Each student gets a **permanent Student Registration Number** — number-only, board-style,
  assigned when the student is first registered. Proposed layout: \*\*registration year (2 digits)
  - numeric school code (4) + serial within the school (5)** → e.g. `26 0042 00012` (exact digit
    split finalised at build). This is the human-friendly student ID shown to people; the internal
    UUID reference stays for system use only. Roll numbers remain **per-exam\*\* (assigned later),
    separate from this permanent ID.
- **"Remove student" = deactivate (soft)**, keeping history; a true hard delete is allowed only
  for a student with **no exam data**.
- **Student transfers between schools are out of Phase 1 core** — handled by the Admin manually
  in the interim; a proper transfer flow is deferred to post-MVP.

---

## Institution types, levels, groups & subjects

**Confirmed** — a flexible model for schools, colleges & universities (supersedes the earlier
"classes are a fixed 9–12 set" decision).

- **Customers = schools, colleges and universities.** Each institution has a **kind**:
  `school | college | university` (added to the institution/"school" record).
- **The academic structure is configurable, not hardcoded:**
  - **Levels** (generalises "class"): an **Admin-managed** list — Class 1–12 (schools),
    1st/2nd Year (colleges), Semester 1–8 (universities). Ordered for progression.
  - **Groups / Programs** (generalises "group/stream"): Admin-managed — Science/General
    (school), Pre-Medical/Pre-Engineering/ICS/Commerce/Arts (college), degree programs like
    BS CS (university). Non-streamed levels use a **"General"** group.
  - **Subjects / Courses:** an Admin-managed global list. `credit_hours` is captured but
    **unused until the university phase**.
  - **Curriculum:** maps subjects to a **level + group**, each **compulsory or elective** with
    a default total marks. The source of truth for what a level+group sits.
- **A student belongs to institution + level + group**; **an exam is for a level + group**;
  papers are drawn from the curriculum (examiner sets dates/marks; subjects are not free-typed).
- **Enrollment eligibility** requires the student's **level + group** to match the exam;
  **electives come from the group's elective subjects** in the curriculum.
- **Results are marks/grade-based for everyone in Phase 1.** **GPA / CGPA + credit-hour
  weighting = a later (university) phase.**
- **Delivery:** the model supports all three kinds now, but **Phase 1 is delivered/piloted with
  schools & colleges**; universities are onboarded once the core flow is proven.
- **Promotion** (moving up a level each year/term) is **manual** for the MVP (bulk "promote"
  action later).

**Impact on the current prototype (updates needed)**

- Institution/"school" record: add **kind** (school/college/university).
- Student form/import: **grade/class → Level** (+ **Group**), both chosen from the managed lists.
- Exam form: **class → Level** (+ **Group**); papers come from the **curriculum** instead of
  free text.
- Enrollment: add the **level + group match**; electives come from the curriculum.
- New Admin setup screens: **Levels**, **Groups/Programs**, **Subjects/Courses**, **Curriculum**.

**Open (to confirm)**

- Exam model: **one exam per level + group** (recommended, keeps the built flow simple) vs one
  exam per level that covers all groups.

---

## Roll numbers

**Confirmed**

- Roll number is **8 digits, numbers only** (matches the Pakistani board norm).
- Format: **2-digit exam year + 6-digit serial** — e.g. `26000123` for a 2026 exam.
- The year prefix makes every roll number **unique across years** — **roll numbers do NOT
  repeat** year to year. (A digital system searches/stores results by roll number, so we avoid
  the same number ever meaning two different candidates.)
- The 6-digit serial is assigned **per exam**, with each **school's candidates blocked
  together** (consecutive serials), mirroring how boards block by examination centre.
- **When roll numbers are assigned:** after the exam's **registration window closes**, in
  **one batch**, by the **Examiner** (the "Close & Assign Roll Numbers" action). Before that,
  candidates are **Pending** with no roll number; after, they become **Confirmed** with their
  roll number assigned.

**Withdraw (confirmed)**

- A registered candidate **can be withdrawn while registration is open** (before roll numbers
  are assigned), by the **school** (its own candidates) or the **Admin**. Withdrawing frees the
  student to register again. **Once roll numbers are assigned, withdraw is not allowed** in
  Phase 1.

---

## Next up (not yet decided)

- Confirm remaining **exam enrollment** rules (eligibility, elective selection).
- E-sheet template, PDF generation, scan upload, page assignment, marking, result compilation.

---

_Update this log as each decision is locked._
