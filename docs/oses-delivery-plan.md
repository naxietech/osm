# OSES — On-Screen Exam System

## Project Delivery Plan

**Prepared for:** Client / Examination Board
**Status:** Proposal for discussion — Draft v2
**Date:** 2026-07-02

---

## About this document

This document explains **what we are building and in what order**. The system is delivered
in **three phases**:

- **Phase 1 — MVP:** the complete core exam flow, working end to end.
- **Phase 2:** a checker-evaluation system and finer, question-wise marking.
- **Phase 3:** AI-assisted checking and system stabilisation.

Anything you want that is not in these three phases is captured at the end as a **Wish List**,
which we will plan and deliver **after Phase 3**.

---

## What is OSES?

OSES (On-Screen Exam System) is a single platform to run examinations from start to finish —
from registering schools and students, to marking scanned answer sheets on a screen, to
compiling results. It is built for national scale: **1,000,000+ students, 150+ schools,
7 subjects, and 3 exam cycles a year.**

Four kinds of users, each with a clear job in the flow:

| User             | Their role in the system                                                         |
| ---------------- | -------------------------------------------------------------------------------- |
| **Board Admin**  | Registers schools; overall administration                                        |
| **Examiner**     | Creates exams, builds e-sheet templates, assigns marking, oversees the process   |
| **School Staff** | Registers students, enrolls them in exams, uploads scanned sheets, views results |
| **Checker**      | Marks answers on screen                                                          |

Throughout, checkers mark answers by an **anonymous reference only** — never the student's
name or personal details — to keep marking fair and unbiased.

---

## The three phases at a glance

| Phase           | Focus                                      | What it delivers                                                                        |
| --------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| **Phase 1**     | MVP — full core exam flow (end to end)     | Run a complete exam: school setup → enrollment → scanning → on-screen marking → results |
| **Phase 2**     | Checker evaluation + question-wise marking | Measure checker quality, mark by individual question, and refine Phase 1                |
| **Phase 3**     | AI-assisted checking + stabilisation       | Speed up checking with AI; harden and stabilise the whole system                        |
| _After Phase 3_ | _Wish List_                                | _Your additional requests, planned and delivered next_                                  |

---

## Phase 1 — MVP: The Complete Core Exam Flow

**Goal:** Deliver the entire examination journey working end to end — from registering a
school all the way to results appearing on the school's portal — with marking done on screen
by human checkers.

This phase is the full loop. Here is the flow, step by step:

1. **Admin registers the school.** The board adds each school to the system.
2. **School registers its students.** School staff enroll their students and their details.
3. **Examiner creates the exam.** The examiner sets up an exam (class + cycle) with its
   subjects/papers and dates.
4. **School enrolls students in the exam.** School staff select their students and enroll
   them as candidates for that exam.
5. **Examiner creates the e-sheet template.** Once enrollment is finished, the examiner
   designs the marking template (e-sheet) for the exam.
6. **System generates a PDF for each student.** From the template, the system produces a
   personalised answer-sheet PDF for every enrolled student.
7. **School uploads the filled, scanned sheets.** After the exam is taken, school staff scan
   the completed answer sheets and upload them from their portal.
8. **System processes each scan.** The system reads each uploaded PDF and splits it **page by
   page** (page-wise for this phase).
9. **Examiner assigns pages to checkers.** The examiner distributes the scanned pages to
   checkers for marking.
10. **Checkers mark and submit.** Each checker opens their assigned pages, marks the answers,
    and submits.
11. **Results are compiled automatically.** Once all of a candidate's answers are checked,
    the system compiles the result.
12. **Results appear on the school's portal.** Each school sees its own students' results.

**Outcome:** A working, end-to-end exam system (MVP) — a school can be set up, students
enrolled and examined, answer sheets scanned and marked on screen, and results delivered back
to the school.

_Current progress: the early part of this flow (school registration, student registration,
exam creation, and enrolling students in an exam) is already working as a demonstrable
prototype. The remaining steps — e-sheet templates, per-student PDFs, scan upload &
page-splitting, page assignment, on-screen marking, and result compilation — are the build
work for this phase._

---

## Phase 2 — Checker Evaluation & Question-wise Marking

**Goal:** Raise marking quality and make marking more precise, and refine Phase 1 based on
real usage.

**What we will build:**

- **Checker Evaluation System.** A dedicated system to evaluate how well checkers are
  performing — measuring their capability, accuracy, and consistency — so the board can
  trust and manage marking quality.
- **Question-wise splitting.** Instead of splitting a scanned sheet page by page, the system
  will split it into **individual questions**. This lets marking and assignment happen per
  question rather than per page — more precise and better balanced across checkers.
- **Phase 1 refinements and bug fixes.** Improvements and fixes based on how Phase 1 performs
  in real use.

**Outcome:** Higher marking quality with proper checker oversight, finer question-level
marking, and a more polished Phase 1.

---

## Phase 3 — AI-Assisted Checking & Stabilisation

**Goal:** Introduce AI into the checking process and make the whole system fast, stable, and
dependable.

**What we will build:**

- **AI-based checking.** Enable the system to assist with — and where appropriate, automate —
  the evaluation of answers using AI, reducing manual effort and speeding up results.
- **Stability & hardening.** Performance improvements, reliability work, and ongoing bug
  fixing across the platform.

**Outcome:** Faster, AI-assisted marking on a stable, hardened system ready for full-scale
national use.

---

## After Phase 3 — Wish List (Future Enhancements)

Once the three phases are delivered, we will plan and build the additional features you want.
This is where **your requests** go. Common examples we can include — please add, remove, or
reprioritise:

- **Notifications** — SMS/email alerts for deadlines and results.
- **Public result portal** — where candidates check results online.
- **Re-checking / re-marking requests** — a formal workflow for result challenges.
- **Online fees / payments** — collecting exam fees through the system.
- **Urdu language** — the system available in Urdu as well as English.
- **Mobile apps** — dedicated apps for schools or candidates.
- **Deeper analytics** — trends across cycles and years.
- **Integrations** — connecting OSES with other board or government systems.

> We will hold a session with you to capture your full wish list, agree priorities, and plan
> these as Phase 4 and beyond.

---

## How we work through the phases

- **Each phase is delivered as working software** you can review and sign off — not just
  documents.
- **We confirm the details of each phase with you before building it** — especially the
  board's exact rules.
- **Fairness and student privacy are built in** — checkers never see candidate identity.

---

## A few things we need from you

To keep the phases on track, we will need the board's decisions on:

- **Result rules (needed in Phase 1):** grading scheme and pass/fail criteria, since results
  are compiled and shown to schools in Phase 1.
- **Marking policy:** how pages (Phase 1) and questions (Phase 2) are assigned, and whether
  any paper should be checked by more than one checker.
- **E-sheet template details:** the layout and mark scheme for each paper.
- **Elective rules:** any minimum/maximum on optional subjects a student may take.
- **Urdu language:** whether it is required, and when.

---

_This is a draft prepared for discussion. The phase contents can be adjusted to match your
priorities before we begin._
