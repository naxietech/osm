# Triage Rubric — Phase 0 Classification

Before launching exploration agents, classify the work. The class determines which phases run and how many agents fan out per phase. Running every phase on a one-line fix burns time and tokens; running too few on a large feature ships bugs.

## Classes

### A — Trivial

- Typo, log message, comment, or config tweak
- Single file, < 5 lines, no logic change
- **Phases**: skip 2, 3, 4. Implement → run `code-reviewer` + `verification-runner` only.

### B — Localized bug fix

- 1–3 files, logic change confined to one feature
- **Phase 2**: 1 agent (`code-explorer` or `bug-hunter`)
- **Phase 3**: skip if the bug is well-specified
- **Phase 4**: skip architecture; use `refactoring-strategist` if behavior-preserving
- **Phase 6**: `code-reviewer`, `bug-hunter`, plus 1 conditional agent matching the bug class
- **Phase 6.5**: `verification-runner`

### C — Small feature

- New endpoint, component, job, or screen. 3–10 files. Single domain.
- **Phase 2**: 2 agents (`code-explorer`, `convention-detective`)
- **Phase 3**: 3–5 clarifying questions
- **Phase 4**: 1 `code-architect` (skip the multi-architect fan-out)
- **Phase 6**: standard review set, plus conditional agents based on what the feature touches
- **Phase 6.5**: `verification-runner`

### D — Large feature

- Multi-domain, 10+ files, new abstractions, possibly new external integrations
- **All phases, full fan-out.** Multi-architect Phase 4. Heavy Phase 6.

### E — Refactor

- Behavior-preserving restructure
- **Phase 2**: `code-explorer` + `convention-detective` + `impact-analyzer`
- **Phase 4**: `refactoring-strategist` + `impact-analyzer`. Skip `code-architect`.
- **Phase 6**: heavy on `bug-hunter`, `test-coverage-gap`, `breaking-change-reviewer`
- **Phase 6.5**: `verification-runner` is mandatory — refactors must prove behavior preserved

### F — Migration

- Framework upgrade, dependency major-version bump, monorepo/tooling move, infra change (no DB exists in this project)
- **Phase 2**: `code-explorer` + `impact-analyzer`
- **Phase 4**: `code-architect` + `dependency-inspector` (deps) or `impact-analyzer`
- **Phase 6**: `dependency-inspector`, `bug-hunter`, `breaking-change-reviewer` if internal contracts change
- **Phase 6.5**: `verification-runner` plus a manual smoke step for things tests don't cover

### G — Frontend / UI work

- New screen, redesign, component change, or styling pass
- **Phase 2**: `code-explorer` + `convention-detective` + `ui-flow-tracer`
- **Phase 4**: `frontend-architect`
- **Phase 6**: `frontend-reviewer`, `a11y-auditor`, `module-boundary-auditor` if design-system layers are touched
- **Phase 6.5**: `verification-runner` (plus a manual UI smoke check)

## Decision rule

If the user's request is ambiguous between classes, **ask**. Do not guess. The cost of running too many agents is the user's time and tokens; the cost of running too few is shipping bugs.

## Re-classification mid-flight

If during Phase 2 the change turns out larger or smaller than expected, re-classify and re-pick agents. Tell the user the class changed and why.

## Output of Phase 0

A one-line declaration: **"Triage: Class C — small feature. Will run Phases 1–7 with single architect."** Then proceed.
