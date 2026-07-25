---
name: sync-docs
description: Reads the current codebase and synchronizes all documentation and AI configuration using 4 specialized agents
user-invocable: true
argument-hint: '[scope: all | types | integrations | reference | rules | after adding X feature]'
allowed-tools: ['Bash', 'Glob', 'Grep', 'Read', 'Edit', 'Write', 'Agent']
---

# /sync-docs

A multi-agent documentation audit and sync system. Launches 4 specialized agents in parallel to compare every documentation layer against the actual codebase, then presents a unified audit report and applies fixes after confirmation.

Use this after completing a feature, a batch of changes, a refactor, or whenever docs feel stale.

This is the OSES monorepo: `apps/web` (Vite + React + TS), `apps/api` (NestJS), `packages/types` (`@oses/types`). The web app runs entirely on mocks — there is no database. Docs live in the root `CLAUDE.md`, `.claude/rules/*.md`, `.claude/README.md`, the root `README.md`, and `docs/`.

Scope: $ARGUMENTS

---

## Phase 0 — Scope Detection

**Goal**: Determine what changed and which agents to launch.

### If `$ARGUMENTS` is empty or "all" or "full":

Run broad detection — all 4 agents will be launched:

```bash
git log --oneline -30
git diff main...HEAD --name-only
```

Categorize every changed file:

| Category          | Files matching                                                              |
| ----------------- | --------------------------------------------------------------------------- |
| Shared types      | `packages/types/src/*.ts`                                                   |
| Mock services     | `apps/web/src/services/*.service.ts`                                        |
| Mock store        | `apps/web/src/services/mock-store.ts`                                       |
| API client        | `apps/web/src/services/api-client.ts`                                       |
| Design system     | `apps/web/src/design-system/**/*.tsx` (atoms/molecules/organisms/templates) |
| Pages             | `apps/web/src/pages/**/*.tsx`                                               |
| Router            | `apps/web/src/router/**/*.ts`, `router/routes.ts`                           |
| Hooks             | `apps/web/src/hooks/*.ts`                                                   |
| API modules       | `apps/api/src/**/*.ts` (controllers, DTOs, guards, interceptors)            |
| Config            | `*.config.ts`, `turbo.json`, `tsconfig*.json`                               |
| API/service seams | Changes touching `api-client.ts` or any `*.service.ts` boundary             |

Output a plain-English summary of what changed before launching agents.

### If `$ARGUMENTS` specifies a scope:

Map keywords to agents:

| Argument contains                                                             | Agents to launch                 |
| ----------------------------------------------------------------------------- | -------------------------------- |
| "types", "@oses/types", "enums", "mocks", "mock-store", "service"             | types-and-mock-data-analyst only |
| "integration", "api-client", "service seam", "api boundary"                   | integrations-explorer only       |
| "reference", "components", "pages", "router", "routes", "hooks", "api module" | code-explorer only               |
| "rules", "claude.md", "readme", "skills", "ai config", "config"               | ai-config-auditor only           |
| "architecture", "conventions", "features"                                     | code-explorer only               |
| anything else (e.g., "after adding marking feature")                          | all 4 agents with scope hint     |

You may launch multiple agents if the scope touches multiple areas. Use judgment.

---

## Phase 1 — Parallel Agent Launch

**Goal**: Launch all applicable agents simultaneously for maximum speed.

### Agents

| Agent                         | File                              | Scope                                                                              | Color   |
| ----------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| **Code Explorer**             | `agents/code-explorer.md`         | `docs/`, web components/pages/router, api modules, file counts                     | Yellow  |
| **Types & Mock-Data Analyst** | `agents/database-analyst.md`      | `@oses/types`, mock services + `mock-store.ts`, type/mock drift                    | Blue    |
| **Integrations Explorer**     | `agents/integrations-explorer.md` | `api-client.ts`, service seams, future integration points                          | Magenta |
| **AI Config Auditor**         | `agents/ai-config-auditor.md`     | `CLAUDE.md`, `.claude/rules/`, `.claude/README.md`, `README.md`, `.claude/skills/` | Cyan    |

### How to launch

For each agent, construct a prompt that includes:

1. **The agent's instructions**: "Follow the instructions in `agents/{agent-name}.md`"
2. **Scope context**: The changed files summary from Phase 0 (so agents can prioritize)
3. **Report format**: "Produce your findings in the exact report format specified in your instructions"
4. **Hard stops reminder**: "You are read-only. Never modify files."

**Launch all applicable agents in a single message using multiple Agent tool calls.**

Example prompts:

**Code Explorer**:

```
Audit all code documentation against the actual codebase. Follow the instructions in agents/code-explorer.md.

Scope context: [paste changed files summary from Phase 0, or "Full audit — no specific scope"]

Produce your findings in the exact report format specified in your instructions. You are read-only — never modify files.
```

**Types & Mock-Data Analyst**:

```
Audit @oses/types and the mock services/store against the docs. Follow the instructions in agents/database-analyst.md.

Scope context: [paste changed files summary or "Full audit"]

There is no database. Read the shared types in packages/types/src and the mock data in apps/web/src/services (service files + mock-store.ts) directly.

Produce your findings in the exact report format specified in your instructions. You are read-only — never modify files.
```

**Integrations Explorer**:

```
Audit integration/service-seam documentation against actual code. Follow the instructions in agents/integrations-explorer.md.

Scope context: [paste changed files summary or "Full audit"]

There are no live third-party integrations yet — the web app runs on mocks. Focus on the api-client and service seams where real integrations will land.

Produce your findings in the exact report format specified in your instructions. You are read-only — never modify files. Never call external APIs or expose secrets.
```

**AI Config Auditor**:

```
Audit all AI configuration files (CLAUDE.md, .claude/rules, .claude/README.md, root README.md, skills) against the actual codebase. Follow the instructions in agents/ai-config-auditor.md.

Scope context: [paste changed files summary or "Full audit"]

Produce your findings in the exact report format specified in your instructions. You are read-only — never modify files. Never auto-update domain rules — always flag for manual review.
```

---

## Phase 2 — Collect & Merge Reports

**Goal**: Combine all agent reports into a unified audit report.

Once all agents return, process their reports:

1. **Group by target file** — all findings affecting the same doc file go together, regardless of which agent found them
2. **Deduplicate** — if two agents flag the same discrepancy (e.g., both Code Explorer and AI Config Auditor flag the same CLAUDE.md count), keep one
3. **Separate findings into**:
   - **Auto-fixable**: UNDOCUMENTED entries, STALE entries (confirmed deleted), DRIFT with clear correction, count updates
   - **Flagged for manual review**: Domain rule changes, ambiguous relocations, architecture decisions
4. **Sort by priority** (highest impact first):
   1. `CLAUDE.md`
   2. `.claude/rules/`
   3. `.claude/README.md`
   4. `README.md`
   5. `.claude/skills/`
   6. `docs/`

---

## Phase 3 — Present Audit Report

**Goal**: Show the user exactly what needs updating before making any changes.

Output the merged report:

```
AUDIT REPORT
============
Agents used: [list of agents launched]
Scope: [full / scoped to X]

CLAUDE.md
  - [list every discrepancy: wrong count, missing entry, stale reference]

.claude/rules/
  - [file]: [discrepancy]

.claude/README.md
  - [discrepancy]

README.md
  - [discrepancy]

.claude/skills/
  - [file]: [discrepancy]

docs/
  - [file].md: [stale path / missing new module / drift]
  - MISSING: [feature name] — no doc exists

TYPES & MOCK DATA
  - [type file]: [drift between @oses/types and mock data]
  - [service]: [mock shape no longer matches the shared type]

SERVICE SEAMS
  - api-client.ts: [findings]
  - [service].service.ts: [findings]

FLAGGED FOR MANUAL REVIEW (domain rules / architecture decisions):
  - [item]

TOTAL: [N] files need updates, [M] items flagged for review
```

**Wait for user confirmation before proceeding.** If the user says "fix all" or "go ahead", apply all non-flagged changes. If they want to cherry-pick, respect that.

---

## Phase 4 — Apply Changes

**Goal**: Update documentation files in priority order.

Apply in this order (highest impact first):

1. **`CLAUDE.md`** — master reference, most loaded by AI
2. **`.claude/rules/`** — always-loaded rules
3. **`.claude/README.md`** — the map of the `.claude/` setup
4. **`README.md`** — root project readme
5. **`.claude/skills/`** — workflow skills
6. **`docs/`** — plans, TRD, module details, flow decisions

For each file:

- Read 3 existing entries first to match style/format
- Show the specific change (before/after or addition/removal)
- Apply the change
- Move to the next file

### Creating missing docs

If the audit found a feature or module without documentation:

- Add a section to the relevant existing `docs/` file (e.g. `oses-module-details.md`) using its existing format
- If a new top-level doc is clearly warranted, propose it and confirm with the user before creating

If the audit found undocumented code artifacts:

- Add entries to the appropriate doc or rule file
- Use the existing format in that file

---

## Phase 5 — Final Verification

**Goal**: Confirm everything was synced and report results.

After all changes are applied:

```
SYNC COMPLETE
=============
Agents used: [list]
Scope: [full / scoped]

FILES UPDATED: [N]
  - [file path]: [what changed]

FILES CREATED: [N]
  - [file path]: [why]

COUNTS VERIFIED:
  - Shared type files (@oses/types): [N]
  - Mock services: [N]
  - Design-system components (atoms/molecules/organisms/templates): [N]
  - Pages: [N]
  - Router modules: [N]
  - API modules: [N]
  - Hooks: [N]

FLAGGED FOR MANUAL REVIEW (not auto-fixed):
  - [items that need human decision]

SKIPPED (no changes needed):
  - [files that were already in sync]
```

---

## Hard Stops

These apply to the orchestrator AND all agents:

- **Never auto-update domain rules** in `CLAUDE.md` or `.claude/rules/domain-rules.md` (anonymity, marking, RBAC, PII) — always flag for manual review
- **Never invent code artifacts** — only document what you actually read in the source
- **Never remove documentation** unless confirmed the code artifact it describes is truly gone (deleted, not just moved)
- **Never change code** — this skill only updates documentation and AI configuration files
- **Never expose secrets** — do not include API keys, tokens, or passwords in reports or docs
- **If a change affects candidate anonymity or PII handling** — flag it prominently, never assume the safe default still holds
