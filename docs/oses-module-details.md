# OSES — Module Details by Phase

**Prepared for:** Client / Examination Board
**Status:** Proposal for discussion — Draft v1
**Date:** 2026-07-02
**Companion to:** OSES Project Delivery Plan

---

## How to read this document

For every module you'll see:

- **What it does** — the purpose in plain terms.
- **Who uses it** — the role.
- **Buttons / actions (CTAs)** — what the user clicks to get things done.
- **Input fields** — what they fill in (⭐ = required, others optional).
- **What they see** — the result / output.

**Status tags:** **(prototype ready)** = already built and demonstrable ·
**(to build)** = planned for the phase · fields marked _(proposed)_ are indicative and will be
confirmed with you before building.

---

# PHASE 1 — MVP: The Complete Core Exam Flow

The modules below run in sequence — this is the full journey from setting up a school to
delivering results.

---

## 1. Login & Access **(prototype ready)**

- **What it does:** Secure sign-in. Every user sees only the screens their role allows.
- **Who uses it:** All roles (Admin, Examiner, School Staff, Checker).
- **Buttons / actions:** `Sign In`, `Show/Hide password`, `Sign Out`.
- **Input fields:** ⭐ Email, ⭐ Password.
- **What they see:** Their own role dashboard after login.

---

## 2. School Management **(prototype ready)**

- **What it does:** The board adds and manages the schools that will use the system.
- **Who uses it:** Board Admin.
- **Buttons / actions:** `Add School`, `Create School` / `Save Changes`, `View`, `Edit`,
  (`Activate / Deactivate`).
- **Input fields:**
  - School Information: ⭐ School Name, ⭐ School Code, ⭐ Registration/Affiliation No.,
    ⭐ Institution Type (Government / Private / Federal / Other), ⭐ School Level (Secondary /
    Higher Secondary / Both), ⭐ Category (Boys / Girls / Co-education).
  - Address: ⭐ Address, ⭐ City, ⭐ Province/Region, Postal Code.
  - Contact Person: ⭐ Name, ⭐ Designation, ⭐ Email, ⭐ Phone.
- **What they see:** A searchable list of schools with code, city, onboarding status, and
  active/inactive — click any row to view or edit.

---

## 3. Student Management **(prototype ready)**

- **What it does:** Schools enroll and maintain their students' records. Personal details are
  protected and never shown to checkers.
- **Who uses it:** School Staff (their own school) and Board Admin.
- **Buttons / actions:** `Add Student`, `Enrol Student` / `Save Changes`, `View`, `Edit`.
- **Input fields:**
  - School & Class: ⭐ School (locked to their own for school staff), ⭐ Grade (9–12),
    Enrollment Status (Active / Inactive / Transferred / Graduated — when editing).
  - Student Details: ⭐ Full Name, ⭐ Father/Guardian Name, ⭐ Gender, ⭐ Date of Birth,
    Student Photo.
  - Identity Documents: Student CNIC/B-Form, ⭐ Father/Guardian CNIC.
  - Contact: ⭐ Father's Mobile, Student's Mobile.
  - Address: ⭐ Address, ⭐ City, ⭐ District, Postal Address.
- **What they see:** A privacy-safe student list (name, reference ID, grade, status) — the
  full detail opens only for authorised roles.

---

## 4. Exam Management **(prototype ready)**

- **What it does:** The examiner creates an exam (a class + cycle) and defines its papers.
- **Who uses it:** Examiner (Board Admin can also manage).
- **Buttons / actions:** `Create Exam` / `Save Changes`, `Add Paper`, `Remove Paper`,
  `Open Registration`, `Close & Assign Roll Numbers`, `View Candidates`.
- **Input fields:**
  - Exam details: ⭐ Exam Name, ⭐ Exam Code, ⭐ Session (e.g. "Annual 2026"), ⭐ Grade (9–12).
  - Registration window: ⭐ Opens On (date), ⭐ Closes On (date).
  - Papers (one or more): ⭐ Subject, ⭐ Type (Compulsory / Elective), ⭐ Total Marks,
    ⭐ Paper Date.
- **What they see:** A list of all exams with session, grade, paper count, candidate count,
  and status (Draft → Registration Open → Registration Closed → In Progress → Completed).

---

## 5. Exam Enrollment (Candidate Registration) **(prototype ready)**

- **What it does:** While registration is open, a school enrolls its students into an exam in
  one action, including any optional (elective) subjects each student takes.
- **Who uses it:** School Staff.
- **Buttons / actions:** `Register Students`, `Select all`, `Search by name`, elective
  toggle chips per student, `Register N Students`.
- **Input fields:**
  - ⭐ Student selection (tick the students to register).
  - Elective papers per selected student (tick any that apply — optional).
- **What they see:**
  - The exam's papers (compulsory + electives) at the top.
  - "Your registered candidates" list — each with status (Pending → Confirmed) and roll
    number once assigned. This list stays visible even after registration closes.
  - Roll numbers are assigned by the examiner after the window closes.

---

## 6. E-Sheet Template Builder **(to build)**

- **What it does:** After enrollment, the examiner designs the marking template (e-sheet) for
  the exam's paper — the structure the answers will be marked against.
- **Who uses it:** Examiner.
- **Buttons / actions:** `Create Template`, `Add Question`, `Save Template`,
  `Generate Student PDFs`.
- **Input fields _(proposed)_:**
  - Select exam / paper.
  - Per question: question number, ⭐ maximum marks, (optional) section/part label.
  - Answer-sheet options: number of pages, header/instructions.
- **What they see:** A reusable template tied to the exam, ready to generate student PDFs.

---

## 7. Student PDF Generation **(to build)**

- **What it does:** From the template, the system produces a personalised answer-sheet PDF for
  every enrolled student — each carrying a code that lets the system match it back to that
  student when it's scanned.
- **Who uses it:** Examiner (generates) / School Staff (downloads/prints).
- **Buttons / actions:** `Generate PDFs`, `Download` (all for an exam, or per school).
- **Input fields _(proposed)_:** Select exam (the student list comes from confirmed
  registrations).
- **What they see:** A downloadable set of per-student answer-sheet PDFs.

---

## 8. Answer-Sheet Upload **(to build)**

- **What it does:** After the exam is taken, school staff upload the filled, scanned answer
  sheets from their portal.
- **Who uses it:** School Staff.
- **Buttons / actions:** `Upload Scans`, `Choose Files`, `Submit Upload`.
- **Input fields _(proposed)_:** ⭐ Select exam, ⭐ Scanned PDF file(s), (optional) batch label.
- **What they see:** An upload/batch list with status (Uploaded → Processing → Ready / Failed).

---

## 9. Scan Processing & Page Splitting **(to build — automatic)**

- **What it does:** The system reads each uploaded PDF, matches it to the correct candidate,
  and splits it **page by page** (page-wise in Phase 1).
- **Who uses it:** Runs automatically; Examiner/Admin monitor it.
- **Buttons / actions:** `Retry` (on a failed batch), `View Batch`.
- **Input fields:** None (automatic).
- **What they see:** Batch status and any pages that need attention.

---

## 10. Marking Assignment **(to build)**

- **What it does:** The examiner distributes the scanned pages to checkers for marking.
- **Who uses it:** Examiner.
- **Buttons / actions:** `Assign`, `Assign to Checker`, `Auto-distribute`, `Save Assignment`.
- **Input fields _(proposed)_:** ⭐ Select exam, ⭐ Checker(s), scope/number of pages to assign.
- **What they see:** Assignment overview and each checker's workload.

---

## 11. Marking (Checking) **(to build)**

- **What it does:** Each checker opens their assigned pages, marks the answers, and submits.
  Checkers see an **anonymous candidate reference only — never the student's name or details.**
- **Who uses it:** Checker.
- **Buttons / actions:** `Open`, `Save`, `Submit`, `Next`, (`Flag for review`).
- **Input fields _(proposed)_:** Marks (number) per answer/question on the page; optional note
  or flag.
- **What they see:** Their marking queue and progress (e.g. "18 of 40 done").

---

## 12. Result Compilation **(to build — automatic)**

- **What it does:** Once all of a candidate's pages are checked, the system adds up the marks
  and produces the result (total, grade, pass/fail per the board's rules).
- **Who uses it:** Runs automatically; the Examiner reviews and declares.
- **Buttons / actions:** `Compile`, `Declare Results`.
- **Input fields:** None to compile; the board's grading rules are configured once.
- **What they see:** Compiled results ready to release to schools.

---

## 13. Results Portal (School View) **(to build)**

- **What it does:** Each school sees its own students' results once declared.
- **Who uses it:** School Staff (Board Admin / Examiner see all schools).
- **Buttons / actions:** `View Results`, `Filter by exam`, `Download Result Card`.
- **Input fields _(proposed)_:** Select exam / filter.
- **What they see:** A table of the school's candidates with obtained marks, grade, and
  pass/fail — plus a downloadable result card per student.

---

## 14. Dashboards **(partly built)**

- **What it does:** A home screen per role with the key numbers and quick links for their job.
- **Who uses it:** All roles.
- **Buttons / actions:** Shortcuts to the role's main tasks.
- **What they see:** Role-relevant summaries (e.g. schools count, students by grade, active
  exams, registered candidates, marking progress) — wired to live data as each module lands.

---

### Phase 1 summary — what the client gets

A complete, working exam system: register schools and students, create exams, enroll
candidates, generate answer sheets, upload and process scans, assign and mark on screen, and
deliver results to schools — all in one platform.

---

# PHASE 2 — Checker Evaluation & Question-wise Marking

## A. Checker Evaluation System **(to build)**

- **What it does:** Measures how well checkers perform — accuracy, consistency, and speed — so
  the board can trust and manage marking quality.
- **Who uses it:** Examiner / Board Admin.
- **Buttons / actions _(proposed)_:** `View Checker Scorecard`, `Review Sample`,
  `Set Evaluation Criteria`.
- **Input fields _(proposed)_:** Evaluation criteria/weights; sample re-marks for comparison.
- **What they see:** Per-checker ratings and a quality overview across all checkers.

## B. Question-wise Segmentation **(to build)**

- **What it does:** Upgrades scan processing to split each sheet into **individual questions**
  instead of whole pages — so assignment and marking happen per question (more precise, better
  balanced).
- **Impact:** Marking Assignment and Marking screens work at question level.

## C. Phase 1 Refinements & Bug Fixes

- Improvements and fixes based on real Phase 1 usage.

---

# PHASE 3 — AI-Assisted Checking & Stabilisation

## A. AI-Based Checking **(to build)**

- **What it does:** The system assists with — and where appropriate automates — evaluating
  answers using AI, reducing manual effort and speeding up results. A human can review or
  override.
- **Who uses it:** Examiner oversees; Checkers review AI suggestions.
- **Buttons / actions _(proposed)_:** `Run AI Checking`, `Review AI Marks`,
  `Accept` / `Override`.
- **What they see:** AI-suggested marks (with confidence) that a human can confirm or change.

## B. Stability & Hardening

- Performance, reliability, and ongoing bug fixing to support full national-scale use.

---

_This is a draft for discussion. Buttons and fields for "to build" modules are indicative and
will be confirmed with you before we build each one._
