# OSES — TRD Alignment Plan (osm-007)

**Status:** Approved direction — building in phases
**Date:** 2026-07-19
**Source of truth:** the client's Technical Requirement Document (pasted 2026-07-19). This supersedes anything in `oses-006-rearchitecture-plan.md` where they conflict.
**Scope:** Frontend on mocks. Every change = web + `@oses/types` + mock services.

---

## Roles (5)

| Role                          | Who / what they do                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Super Admin**               | Creates all reference data (categories, SLOs, subjects, classes), approves institutes, manages roles/permissions/clients. Full access.        |
| **Admin**                     | **Limited back-office.** Manages operational data (institutes, students, exams). **No** access to roles, permissions, clients, or categories. |
| **Controller Examiner**       | Creates exams.                                                                                                                                |
| **Evaluator** (Paper checker) | Marks e-sheets. (= our existing "Checker".)                                                                                                   |
| **Institute**                 | Registers/verifies its own students; does student enrollment into exams.                                                                      |

## Locked decisions (2026-07-19 Q&A)

| Topic           | Decision                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template style  | **Simple now** (name + #questions + per-question: Q no, Q type, count). Region-mapping deferred to a later phase.                                         |
| Exam papers     | **Subjects only** — exam holds multiple subjects; question detail lives in Templates/e-sheets. Dropped the "multiple papers per subject + duration" idea. |
| Admin role      | **Limited back-office** (see table).                                                                                                                      |
| Class hierarchy | **Direct 3-level on the class**: Class → Group → Subgroup (e.g. Class 9 → Science → Biology). Replaces the curriculum-join model for this flow.           |

---

## Modules (from the TRD)

### 1. Institute Category _(enhance existing)_

Added by super admin. Fields: **Name**, **Description**, **dynamic questions** (a builder — each question is yes/no, e.g. "Are you ed-tech?", "Are you NSSOE?"). Categories: School, College, Board, University, Academy, PECTA.

### 2. Institute Registration _(new: public link + approval)_

Open public link → **Super Admin approves**. Fields: Institute Name **with branch** (e.g. "NSSOE, Shakargarh Campus"), **Institute Code** (govt-provided, e.g. S01), **Category** (from module 1), the category's **dynamic questions** shown with answers, **Type** (Govt / Semi-govt / Private / Other), Address, Province, City, Postal code, Contact Name, Designation, Contact email, Contact no.

### 3. SLO Creation _(new)_

Added by super admin. An SLO (Student Learning Outcome) is **class-specific + subject-specific**.
**Manage by picking Class + Subject first, then editing that combination's flat list.**
Fields per SLO: **Class**, **Subject**, **Code** (e.g. 9-BIO-1.1), **Name**, **Description**, active on/off.
Grouping: **flat** (no topics/chapters for now).
Scope now: **SLO module only** — question→SLO tagging and per-SLO reporting come later (Templates/Results phases).

### 4. Subject Creation _(exists)_

Added by super admin. Field: **Name** (e.g. Bio, Math).

### 5. Class Creation _(rework)_

Added by super admin. Fields: **Name** (e.g. Class 9), **Description**, **Has group?** → add Group (e.g. Science), **Has subgroup?** → add Subgroup (e.g. Biology). Groups/subgroups defined inline on the class.

### 6. Student Registration _(enhance existing + CSV)_

Added by institute (self-verify) or admin. Fields: Institute Name (disabled for institute login; editable for admin), **Class**, **Group** (by class), **Subgroup** (by class group), Student Name, Father/Guardian Name, Gender, DOB, **Student Photo**, **Student CNIC**, **Father CNIC**, Student Mobile, Father Mobile, Address, City, Province, District, Postal. Admin login also gets **Upload CSV**.

### 7. Exam Creation _(rework — owned by Controller Examiner)_

Fields: **Name** (standard, e.g. SSC-9th-science-bio), **Institute** (existing), **Class**, **Group** (by class), **Subgroup** (by group), **Subject** (existing, **multi-select** e.g. Bio, Math), **Shift** (static, e.g. Morning), **Registration Start**, **Registration Close**, **Exam Completed Date** (result-announcement day).

### 8. Student Enrollment _(new / #44)_

Added by school. Pick an exam → list students matching class/group/subgroup with a **register button (soft registration)** → school **prints** soft-reg data to verify → **confirm/complete** registration.

### 9. Template Creation _(new — simple)_

Added by examiner. Fields: **Name**, **How many questions**, then generated per-question rows: **Q no**, **Q type**, **No of questions**.

### 10. E-sheet Generation / PDF _(new)_

Fields: **Name**, **Select Template**, **Select Exam**, **Select Subject**, **Upload question paper** → **Generate**.

### 11. Scanned PDF Upload + Splitting _(new)_

All generated e-sheets listed. **Upload scanned PDF** (bulk or single) → split.

---

## Build order (phases)

**Phase 1 — Super-admin reference data**

1. Roles: seed the 5-role model (add Admin = limited back-office, Controller Examiner; Evaluator label; Institute).
2. Institute Category + dynamic-question builder.
3. SLO module.
4. Classes → Group → Subgroup rework.
5. Subjects (verify only).

**Phase 2 — Institutes & students** 6. Institute registration (public link + approval + full fields). 7. Student registration fields + CSV upload.

**Phase 3 — Exams & enrollment** 8. Exam creation rework (Controller Examiner; subgroup, multi-subject, shift, dates). 9. Student enrollment (soft-register → print → confirm).

**Phase 4 — Marking pipeline** 10. Template creation (simple). 11. E-sheet generation. 12. Scanned PDF upload + splitting.

Each phase ends green on the verify gates (tsc / eslint / vitest / build) and can be paused for review.

## Open questions (assumed defaults, confirm as we reach them)

- SLO "one more field" — what is it? (assume a code/reference field for now.)
- Multi-client/tenancy already built — keep as-is; TRD doesn't mention it.
- E-sheet/scanning is a **mock**: uploaded PDFs and splits are placeholder records (no real OCR).
