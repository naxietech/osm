# Domain Rules — OSES / OSMS

The authoritative spec is the **OSMS Technical Requirement Document** (Naxie ↔ Cantab).
Requirement IDs are `OSMS-FR-<AREA>-<NNN>`. Our internal docs are in `docs/`
(`oses-007-trd-alignment.md`, `oses-module-details.md`, `oses-delivery-plan.md`).

## Roles (5-role model)

Super Admin, Admin (limited), Controller Examiner, Evaluator (checker/marker), Institute.
Pages are grouped by feature; role is expressed through the router shells + RBAC grants, not by
duplicating pages per role.

## RBAC

Dynamic roles + permissions with scope. Route guards key off the legacy `UserRole` enum, but
fine-grained capability (e.g. viewing PII) is a **grant** checked via `usePermissions()`. Prefer
grant checks over role checks for capabilities.

## Anonymity & marking

- Candidate identity is hidden from evaluators end-to-end (see `shared-types-and-pii.md`). The TRD
  unit is the **ARID** (opaque, per question-response); a "Script" is the whole reconstructed
  sheet.
- **Marking model — known divergence, do not silently "fix" either way.** The TRD Phase 1 wants a
  **numeric marks-entry field** (validated `0 ≤ x ≤ max`) plus an uploaded, per-checker
  watermarked marking-scheme document; structured rubrics + annotations are Phase 2. We built a
  **4-band scale** (`correct` / `partially-correct` / `partially-incorrect` / `incorrect`) with a
  per-batch rubric that derives marks, plus an annotation canvas. This came from earlier locked
  session decisions and **conflicts with the signed TRD**. Treat it as a decision for the
  user/Cantab to resolve — flag it, don't rewrite it on your own.

## Approvals

Institute approval and checker approval are a **Super Admin AND Admin** action. The Super-Admin-
**only** action is **de-anonymisation** (revealing candidate identity).

## Exams & structure

Categories + dynamic questions; Class → Group → Subgroup hierarchy; SLOs; multi-institute /
multi-subject exams; enrollment flow is soft-register → print → confirm. Multi-client tenancy —
clients are separate; don't assume cross-client data in one query.

> If a task's requirement conflicts with the TRD, surface the conflict rather than picking a side
> silently. The band/annotation marking model is the standing example.
