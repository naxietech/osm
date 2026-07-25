# Shared Types & PII / Anonymity

`@oses/types` (`packages/types`) is the contract both apps share. It has **zero third-party
dependencies**.

## Type discipline

- Never duplicate a type that lives in `@oses/types` — import it.
- A shape used by both web and api, or across modules, belongs in `@oses/types`. A shape used by
  one component stays local.
- The runtime-emitting members (enums like `UserRole`, `ExamStatus`, `InstituteLevel`,
  `GenderCategory`, `HttpStatus`, and helpers like `questionTypeHasOptions()`) are imported as
  values; everything else is erased at compile time.

## PII & anonymity (safety-critical)

Marking must be anonymous — **evaluators must never see candidate PII**.

- **Never expose PII fields** (`fullName`, `cnicOrBform`, `dateOfBirth`) in evaluator-facing API
  responses or components. Use **`SafeStudentRef`** for evaluator contexts, and
  `examRegistrationService.listCandidatesForEvaluator` — don't fetch full `Student`s and strip
  names client-side.
- Only **admins and controllers** may receive the full `Student` type.
- Gate PII **rendering** on the `students.viewPII` grant via `usePermissions().canViewPII`, **not**
  on the user's role. Route guards key off the legacy `UserRole` enum, so a custom role without the
  grant would otherwise still see everything. Components that render PII (e.g. `StudentProfile`)
  take `canViewPII` as a prop and **default to withholding** it.
- When in doubt, withhold. Leaking a candidate's identity to an evaluator is a correctness bug, not
  a cosmetic one.
