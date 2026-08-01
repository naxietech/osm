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

> **Known divergence — question types.** The TRD says each question is yes/no. Both `@oses/types`
> (`CategoryQuestionType`) and the built backend accept **five** types — `text`, `radio`,
> `checkbox`, `select`, `file` — because the shared contract and the registration form already
> committed to them before this module was built. Kept deliberately (agreed 2026-08-01), enforced
> in `apps/api/.../dto/institute-category.dto.ts` and by a DB check constraint. **Raise with
> Cantab** rather than treating the implementation as TRD-compliant.

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

### 12. Checker Registration _(built)_

Added by an **institute** (its own staff only) or the **super admin** (who may also add a
`general` checker not tied to any school). Either way the record lands **pending**;
approving it is what creates the Evaluator login, so an unapproved checker cannot sign in.
Approval is the super admin's alone.

### 13. Checker Dashboard _(built)_

The checker's own workspace: **Home** (workload summary, queue, marking pace), **My Work**,
**History** (finished questions) and **Profile** (their own registration record).

**My Work drills down in three steps**, then opens one answer:

`Exams → Subjects in that exam → Answers for that subject → mark one answer`

- Only exams and subjects the checker actually holds work in appear. An exam they have no
  part in reads as "not found" rather than confirming it exists.
- The answers list is a **register in fixed order** — question by question, then running
  order. It deliberately does not float unmarked answers to the top, because re-sorting as
  the checker marks would make "answer 7 of 24" jump around while they are using it.
- Every level checks scope against the signed-in checker's own record, so a URL cannot be
  edited to reach another checker's exam, subject or answer — and an answer reached through
  the wrong subject's path is refused too.

Shape of the data:

- The assignable unit is a **batch** — every candidate's answer to **one question** of one
  paper, given to one checker. A checker holds several questions, but always across many
  candidates, so **no checker ever sees a complete paper** and cannot judge one candidate's
  overall performance. The page number is kept on the batch for traceability back to the
  scan, but it is not what gets assigned.
- Marks are recorded as one of **four bands** — correct / partially correct / partially
  incorrect / incorrect — and each batch carries its own rubric saying what each band is
  worth. There is deliberately no free-form marks field.
- Colours follow the reserved meanings: green correct, red incorrect, amber partial. Both
  partial bands are amber by design.
- A batch with **nothing pending counts as finished** and leaves the queue, even when some
  scripts were flagged to a supervisor — the checker can do no more with those.
- **Anonymity**: scripts carry an opaque `candidateRefId` only. Scope comes from the
  signed-in user's own checker record, never the URL, and opening another checker's batch
  reads as "not found".

### 14. Marking Screen _(built — on a placeholder image)_

Opened by clicking an answer on the subject page. One answer at a time: the cropped answer
on the left with a drawing layer over it, the rubric and comment on the right, and
Previous / Skip / Flag / Submit along the bottom. Submitting moves to the next answer in
the same subject and returns to the list when none is left.

- **Grading is the band, nothing else.** The screen submits a band; the service looks the
  marks up in the batch rubric. No screen can award a mark the rubric does not allow.
- **Keyboard-first**: `1`–`4` pick a band, `Enter` submits and moves on, `F` flags,
  `←`/`→` move. Shortcuts stand down while the checker is typing a comment.
- **Annotation toolset**: pen, highlighter, rectangle, ellipse, arrow, tick, cross, a
  comment pin and an eraser, in four colours, with undo and clear. Annotations are stored
  as **fractions of the image (0–1)**, never burned into it, so they survive resizing and
  a supervisor can review exactly what was marked.
- **The eraser removes a whole mark**, not part of one. Marks are stored as shapes, so
  rubbing out the middle of a stroke would mean splitting it in two — and a supervisor
  reviewing the marking would then see something the checker never drew. It takes the
  topmost mark under the pointer, and a shape is erased by its **edge** so a box drawn
  around some working does not swallow every click inside it.
- **Flagging** sends the script to a supervisor with a reason and clears any mark; marking
  a flagged script clears the flag. A script is never both.
- Moving to the next script **resets the band, comment and drawings** — carrying them over
  would award one candidate's grade to the next.
- Pinned notes are also listed as text, because the drawing layer is `aria-hidden`.

> **The answer image is a placeholder.** Real crops need e-sheet generation → scanning →
> per-question splitting (modules 10, 11 and the worker), none of which exist. The grading,
> keyboard and storage logic are real; only the picture is fake.

**Touch / mobile.** The screen is usable on a tablet and survives a phone:

- The drawing surface sets `touch-none` while a tool is in hand, so a drag draws instead of
  scrolling the page. With the **select** tool it reverts to `touch-auto` — that is how a
  checker scrolls on a phone, since the answer image fills the screen.
- Tool and colour buttons are **44px** targets on small screens, dropping to 36px from `sm`
  up. The toolbar is one horizontally scrollable strip rather than a wrapping block, so it
  cannot push the answer off the screen.
- The action bar is **pinned to the bottom of the viewport** below `lg`, so Submit is always
  reachable without scrolling past the answer on every script.
- The eraser reaches further for a fingertip (18px) than for a mouse or stylus (8px).
- A second finger is ignored, so a pinch cannot start a stray stroke.
- Keyboard hints are hidden below `sm` — there is no keyboard to press.

> **Not covered by tests:** freehand pen, highlighter and shape drawing, and the
> multi-touch guard. jsdom has no layout and its `isPrimary` is read-only, so neither
> pointer-drag drawing nor a second finger can be simulated. The coordinate maths is
> unit-tested exactly and `touch-none` is asserted, but the gestures need a real device.

> **Still missing for mobile:** pinch-zoom / pan of the answer image. On a phone the
> checker cannot magnify handwriting to annotate it precisely. This needs an explicit
> pan-vs-draw mode because both want the same gesture — a tablet with a stylus is the
> realistic target until then.

Still to build: the examiner-side **Marking Assignment** that would create these batches
for real. Until then `marking.service` seeds them.

> **Dependency:** question-wise batches assume scanned pages are cropped **per question**.
> `SESSION-HANDOFF.md` §3 records page-wise splitting for Phase 1, with answer-level
> cropping deferred. The checker dashboard is built to the question-wise target, so the
> splitting step must produce per-question slices before this runs on real scans.

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

**Delivered alongside Phase 4** — 13. Checker registration + approval. 14. Checker dashboard. 15. Marking screen (on a placeholder answer image). The examiner-side Marking Assignment that creates the batches is still to build.

Each phase ends green on the verify gates (tsc / eslint / vitest / build) and can be paused for review.

## Open questions (assumed defaults, confirm as we reach them)

- SLO "one more field" — what is it? (assume a code/reference field for now.)
- Multi-client/tenancy already built — keep as-is; TRD doesn't mention it.
- E-sheet/scanning is a **mock**: uploaded PDFs and splits are placeholder records (no real OCR).
