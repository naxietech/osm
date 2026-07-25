---
name: pre-pr-review
description: 'Comprehensive pre-push code review using specialized agents. Reviews architecture, security, data contracts, business/domain rules, frontend, error handling, comments, and code simplification before code is pushed to version control.'
argument-hint: '[review-aspects]'
allowed-tools: ['Bash', 'Glob', 'Grep', 'Read', 'Agent']
---

# Pre-Push Code Review

Run a comprehensive code review using multiple specialized agents before pushing to version control. Each agent focuses on a different aspect of code quality.

**Review Aspects (optional):** "$ARGUMENTS"

## Review Workflow:

1. **Determine Review Scope**
   - Check git status to identify changed files (unstaged, staged, and recent commits)
   - Parse arguments to see if user requested specific review aspects
   - Default: Run all applicable reviews

2. **Available Review Aspects:**

   - **architecture** - Atomic-design layer boundaries, response/envelope consistency, naming conventions
   - **security** - Auth (JWT/guards), input validation (Zod/Yup), XSS, PII/anonymity leakage, secrets
   - **contracts** - `@oses/types` single-source, mock service/store consistency, Zod type inference, no live-backend calls
   - **business** - Domain rule compliance (candidate anonymity, marking model, RBAC grants, approvals, tenancy)
   - **frontend** - React 18, Tailwind v4 tokens, atomic-design layers, Formik/Yup, React Query
   - **errors** - Silent failures, error handling, catch blocks
   - **comments** - Comment accuracy, completeness, maintainability
   - **simplify** - Code simplification and clarity
   - **all** - Run all applicable reviews (default)

3. **Identify Changed Files**

   Run these commands to find all changed files:

   ```bash
   git diff --name-only HEAD~1..HEAD    # files in last commit
   git diff --staged --name-only        # staged but uncommitted
   git diff --name-only                 # unstaged changes
   ```

   Read every changed file **in full** — not just diff hunks. Surrounding context is needed to catch issues.

4. **Determine Applicable Reviews**

   Based on the changed files:
   - **Always applicable**: `.claude/agents/architecture-reviewer.md`, `.claude/agents/security-reviewer.md`
   - **If `@oses/types`, mock services/store, or Zod DTOs changed**: `.claude/agents/data-contract-reviewer.md`
   - **If code touches marking, anonymity/PII, RBAC/roles, approvals, or tenancy**: `.claude/agents/business-rules-reviewer.md`
   - **If React components, Tailwind styles, or TSX changed**: `.claude/agents/frontend-reviewer.md`
   - **If try/catch, error handling, or external/service calls changed**: `.claude/agents/silent-failure-hunter.md`
   - **If comments/docs added or modified**: `.claude/agents/comment-analyzer.md`
   - **After all reviews pass**: `.claude/agents/code-simplifier.md` (polish pass)

   When `$ARGUMENTS` specifies aspects, only run those. When "all" or empty, run all applicable.

5. **Launch Review Agents**

   **Sequential approach** (default):
   - One agent at a time, each report complete before next
   - Good for focused, interactive review

   **Parallel approach** (user can request with "parallel"):
   - Launch all applicable agents simultaneously
   - Faster for comprehensive review

6. **Aggregate Results**

   After agents complete, consolidate all findings and deduplicate overlapping issues.

7. **Present Findings — Two Sections: Suggestions + TODOs**

   Always present the final review in **two distinct sections**. This is the **mandatory output format**.

   ### Section 1: Suggestions (grouped by severity with visual emphasis)

   Use **bold** on the `#` and `Issue` columns for Critical/Important rows. Each severity level gets its own table.

   ```markdown
   # Pre-Push Review: [branch name or description]

   ## Critical — Must Fix Before Push

   | #     | Issue                | File                            | What's Wrong                    | Fix                      |
   | ----- | -------------------- | ------------------------------- | ------------------------------- | ------------------------ |
   | **1** | **Short issue name** | `FileName.tsx` → `functionName` | **Bold description of the bug** | Concrete fix instruction |

   ## Important — Should Fix

   | #     | Issue                | File                               | What's Wrong                   | Fix                      |
   | ----- | -------------------- | ---------------------------------- | ------------------------------ | ------------------------ |
   | **3** | **Short issue name** | `file.service.ts` → `functionName` | **Description of the problem** | Concrete fix instruction |

   ## Minor — Nice to Have

   | #   | Issue            | File                            | What's Wrong | Fix             |
   | --- | ---------------- | ------------------------------- | ------------ | --------------- |
   | 5   | Short issue name | `FileName.tsx` → `functionName` | Description  | Fix instruction |
   ```

   ### Section 2: TODOs (numbered, prioritized action plan)

   ```markdown
   ---

   ## TODOs (Recommended Fix Order)

   | #   | Priority | TODO                                                                        | Depends On | Effort |
   | --- | -------- | --------------------------------------------------------------------------- | ---------- | ------ |
   | T1  | **P0**   | Fix the typo in `canViewPll` grant name (#1)                                | —          | 1 min  |
   | T2  | **P0**   | Import shared `Student` type from `@oses/types` instead of redeclaring (#6) | —          | 1 min  |
   | T3  | **P1**   | Move the button out of the `templates` layer into an atom (#5)              | —          | 5 min  |

   > You can reference any TODO by its number (e.g. "fix T3") to apply the fix.
   ```

   ### Formatting rules:

   **Content rules:**
   - **Suggestions section**: Numbers are sequential across all severity tables (1, 2, 3... not restarting per section)
   - **Bold styling**: Critical and Important rows use `**bold**` on `#`, `Issue`, and `What's Wrong` columns. Minor rows are plain
   - **TODOs section**: Each TODO has a numbered ID (T1, T2, T3...) referencing suggestion number with `(#N)`
   - **TODO ordering**: Ordered by priority (P0 first), then by dependency chain
   - **Priority labels**: `**P0**` = must fix before push, `**P1**` = should fix before push, `**P2**` = can fix in follow-up
   - **Effort**: rough estimate (1 min, 5 min, 15 min, 30 min, 1 hr+)
   - Keep "What's Wrong" concise — one sentence with actual impact
   - Keep "Fix" actionable — what exactly to change
   - Omit severity sections that have zero issues

   **Spacing rules:**
   - Use `---` horizontal rule between every major section
   - Add **two blank lines** before each `## heading`
   - Add **one blank line** after each table
   - Never stack two tables back-to-back without a heading + blank line between them

8. **Interactive Fix Application — Fix Code One TODO at a Time**

   This is NOT a PR comment flow. You are fixing local files directly before the code is pushed.

   After presenting the full review, walk through each TODO **one at a time** using `AskUserQuestion` (single-select, `multiSelect: false`). For each TODO, suggest a concrete code change and let the user decide.

   **Flow:**
   - Start with T1, then T2, T3, etc. in order
   - For each TODO, show the **exact code change** you propose (before → after), then call `AskUserQuestion` with options:
     - **Fix** — apply this code change to the file using the Edit tool
     - **Skip** — skip this TODO, move to next
     - **Edit** — user provides alternative fix instructions, then apply
     - **Fix all remaining** — apply this and all remaining TODOs without asking again

   **Example AskUserQuestion call:**

   ```json
   {
     "questions": [
       {
         "question": "T1 [P0] — Fix `canViewPll` typo in `StudentProfile.tsx:142`\n\nBefore: `props.canViewPll`\nAfter: `props.canViewPII`\n\nApply this fix?",
         "header": "T1",
         "multiSelect": false,
         "options": [
           { "label": "Fix", "description": "Apply this code change to the file" },
           { "label": "Skip", "description": "Skip this TODO, move to next" },
           { "label": "Edit", "description": "Provide alternative fix instructions" },
           {
             "label": "Fix all remaining",
             "description": "Apply this and all remaining fixes without asking"
           }
         ]
       }
     ]
   }
   ```

   **How to handle each response:**
   - **Fix** → use the Edit tool to apply the change to the file, confirm it was applied, then ask about the next TODO
   - **Skip** → move to the next TODO
   - **Edit** → ask the user what they want changed instead, apply their version using Edit tool, then next TODO
   - **Fix all remaining** → apply this and all remaining TODOs using Edit tool without further questions

   After all TODOs are processed, confirm: "Applied X of Y fixes. Run `/pre-pr-review` again to verify."

## Usage Examples:

**Full review (default):**

```
/pre-pr-review
```

**Specific aspects:**

```
/pre-pr-review contracts security
# Reviews only data contracts and security

/pre-pr-review frontend
# Reviews only frontend code

/pre-pr-review errors comments
# Reviews error handling and comments
```

**Parallel review:**

```
/pre-pr-review all parallel
# Launches all agents in parallel
```

## Agent Descriptions:

**architecture-reviewer**:

- Validates atomic-design layer boundaries (atoms/molecules/organisms/templates) and the web mock flow (component → service → mock-store) / api flow (controller → Zod DTO → service → envelope)
- Checks response consistency (`ApiResponse<T>` envelope)
- Enforces naming conventions

**security-reviewer**:

- Checks auth (JWT, NestJS RolesGuard/@Roles())
- Validates input via Zod DTOs (api) and Formik/Yup (web)
- Flags XSS (`dangerouslySetInnerHTML`), PII/anonymity leakage to evaluators, data exposure
- Flags committed secrets / `.env` values

**data-contract-reviewer**:

- Verifies `@oses/types` is the single source of truth (no duplicated types)
- Checks mock service (`src/services/*.service.ts`) and `mock-store.ts` shapes stay consistent with `@oses/types`
- Confirms Zod DTOs infer their TypeScript types (`z.infer`) with no drifting parallel interfaces
- Flags accidental live-backend calls (web must go through the mock service layer)

**business-rules-reviewer**:

- Enforces candidate anonymity (evaluators never see PII; `SafeStudentRef`) and PII gating on the `students.viewPII` grant
- Flags conflicts with the marking model (bands+rubric+annotations vs the TRD's numeric-marks Phase 1) — surfaces, never silently rewrites
- Checks RBAC grant-vs-role usage and approval gates (institute/checker = Super Admin AND Admin; de-anonymisation = Super Admin only)
- Enforces multi-client tenancy isolation

**frontend-reviewer**:

- Enforces Tailwind v4 token usage (CSS variables, not hardcoded colours) and reserved marking colours (green=correct, red=incorrect, amber=partial)
- Validates atomic-design layer placement and reuse-before-build
- Checks Formik/Yup and React Query patterns, and that PII renders only behind `canViewPII`

**silent-failure-hunter**:

- Finds empty catch blocks and silent failures
- Reviews error logging quality and context
- Checks external/service call error handling
- Validates React Query error handling and retry configuration

**comment-analyzer**:

- Verifies comment accuracy vs code
- Flags stale/misleading comments
- Identifies missing comments on complex logic

**code-simplifier**:

- Reduces unnecessary complexity
- Eliminates redundant code
- Applies project coding standards
- Preserves all functionality

## Tips:

- **Run before every push**: Catch issues before they hit version control
- **Focus on changes**: Agents analyze git diff by default
- **Address critical first**: Fix P0 issues before lower priority
- **Re-run after fixes**: Verify issues are resolved
- **Use specific reviews**: Target specific aspects when you know the concern

## Workflow Integration:

**Before committing:**

```
1. Write code
2. Run: /pre-pr-review architecture errors
3. Fix any critical issues
4. Commit
```

**Before pushing:**

```
1. Stage all changes
2. Run: /pre-pr-review all
3. Address all critical and important issues
4. Run specific reviews again to verify
5. Push
```

## Notes:

- Agents run autonomously and return detailed reports
- Each agent focuses on its specialty for deep analysis
- Results are actionable with specific file:line references
- All review agents are shared, project-level agents in the `.claude/agents/` directory (also dispatchable by name), reused by `review-pr` too
