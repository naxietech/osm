---
name: review-pr
description: 'Comprehensive PR review using specialized agents'
argument-hint: '[review-aspects]'
allowed-tools: ['Bash', 'Glob', 'Grep', 'Read', 'Agent', 'AskUserQuestion']
---

# Comprehensive PR Review

Run a comprehensive pull request review using multiple specialized agents, each focusing on a different aspect of code quality.

**Review Aspects (optional):** "$ARGUMENTS"

## Agent Roster

Most agents are **shared, project-level agents in `.claude/agents/`** (also dispatchable by name); two are local to this skill in `./agents/` (`pr-test-analyzer`, `type-design-analyzer`), plus `agents/_shared/deep-review-protocol.md`. Each path is given in the roster below. Pick agents based on what changed — don't run all of them every time.

| Keyword        | Agent                          | File                                         | When to Run                                                                       |
| -------------- | ------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------- |
| `architecture` | Architecture Reviewer          | `.claude/agents/architecture-reviewer.md`    | Always                                                                            |
| `security`     | Security Reviewer              | `.claude/agents/security-reviewer.md`        | Always                                                                            |
| `contracts`    | Types & Data-Contract Reviewer | `.claude/agents/data-contract-reviewer.md`   | `@oses/types`, mock services/store, Zod DTOs changed                              |
| `business`     | Business Rules Reviewer        | `.claude/agents/business-rules-reviewer.md`  | Marking, anonymity/PII, RBAC, approvals, tenancy logic                            |
| `frontend`     | Frontend Reviewer              | `.claude/agents/frontend-reviewer.md`        | React components, Tailwind styles, TSX changed                                    |
| `performance`  | Performance Reviewer           | `.claude/agents/performance-reviewer.md`     | Render-heavy code, large lists / high-volume UI (1M+ students), React Query usage |
| `breaking`     | Breaking Change Reviewer       | `.claude/agents/breaking-change-reviewer.md` | Renamed/removed exports, route/type/contract changes                              |
| `comments`     | Comment Analyzer               | `.claude/agents/comment-analyzer.md`         | Comments/docs added                                                               |
| `tests`        | PR Test Analyzer               | `agents/pr-test-analyzer.md`                 | Test files changed                                                                |
| `errors`       | Silent Failure Hunter          | `.claude/agents/silent-failure-hunter.md`    | Error handling, catch blocks                                                      |
| `types`        | Type Design Analyzer           | `agents/type-design-analyzer.md`             | Types added/modified                                                              |
| `code`         | Code Reviewer                  | `.claude/agents/code-reviewer.md`            | Always                                                                            |
| `simplify`     | Code Simplifier                | `.claude/agents/code-simplifier.md`          | After passing review (polish)                                                     |
| `all`          | —                              | —                                            | Run all applicable reviews (default)                                              |

## Review Workflow:

1. **Determine Review Scope**
   - Parse arguments to see if user requested specific review aspects (keywords from table above) or a PR number
   - Default: Run all applicable reviews

2. **Check Out the PR Locally — MANDATORY before any review**

   All file reads during the review MUST come from the PR's checked-out tree. Never review a PR while the working tree is on a different branch — every `Read` call would show the wrong version of every file, and the whole review becomes guesswork on diff text.

   - Record the starting state: `git branch --show-current` and `git status --porcelain`
   - If the tree is dirty, ask the user (stash and continue / abort) via `AskUserQuestion` — never stash silently
   - If reviewing a specific PR: `gh pr checkout <number>` then `git pull` so the head is current
   - If reviewing the current branch's own work (no PR number, changes already local): the branch is already checked out — skip the checkout, but still `git fetch origin <base>` so base comparisons work
   - Remember the original branch — you will return to it in the final step

3. **Identify Changed Files & Resolve GitHub Blob URL**
   - Run `git diff origin/<base>...HEAD --name-only` (merge-base diff) to see modified files
   - Check if PR already exists: `gh pr view`
   - Identify file types and what reviews apply
   - **Resolve the blob URL base** for clickable links (used in the Present Findings step):
     ```bash
     gh pr view <number> --json headRefName,url --jq '"https://github.com/" + (.url | split("/") | .[3] + "/" + .[4]) + "/blob/" + .headRefName'
     ```
     Store this as `{blob_base}` — every issue link will use `{blob_base}/{filepath}#L{line}`

4. **Build the PR Context Pack**

   Gather this once and pass it to **every** agent:
   - Full diff against the merge base: `git diff origin/<base>...HEAD`
   - Changed file list, and PR metadata (number, title, body, branch)
   - **Callers and usages**: for each changed public method, route, event, or response shape — grep results showing where it is consumed
   - **Related project context**: the relevant `docs/features/` file for the touched feature, and the `.claude/rules/` files matching the touched file types

5. **Trace the Flow — Write the Behavior Delta**

   Before launching agents, trace the main affected flow yourself, end to end. For **apps/web**: route/page → React component (atoms/molecules/organisms/templates) → service (mock) in `src/services` → `mock-store`. For **apps/api**: route → controller → Zod DTO/ZodValidationPipe → service → `TransformInterceptor` (`ApiResponse<T>` envelope). Then write a short **behavior-delta note**:
   - What this flow did before the PR (read the base version: `git show origin/<base>:<path>`)
   - What it does now
   - Which inputs, states, or callers hit the difference

   This note goes into every agent prompt. It is what turns agents from diff-linters into system reviewers.

6. **Determine Applicable Reviews**

   Based on changes, read each agent's file from the path in the roster (`.claude/agents/` for shared agents, `./agents/` for this skill's own) to get its prompt:
   - **Always applicable**: `.claude/agents/code-reviewer.md`, `.claude/agents/architecture-reviewer.md`, `.claude/agents/security-reviewer.md`
   - **If `@oses/types`, mock services/store, or Zod DTOs changed**: `.claude/agents/data-contract-reviewer.md`
   - **If code touches marking, anonymity/PII, RBAC/roles, approvals, or tenancy**: `.claude/agents/business-rules-reviewer.md`
   - **If React components, Tailwind styles, or TSX changed**: `.claude/agents/frontend-reviewer.md`
   - **If render-heavy code, large lists / high-volume UI (1M+ students), or React Query usage changed**: `.claude/agents/performance-reviewer.md`
   - **If exports renamed/removed, routes changed, or shared types/contracts altered**: `.claude/agents/breaking-change-reviewer.md`
   - **If test files changed**: `agents/pr-test-analyzer.md`
   - **If comments/docs added**: `.claude/agents/comment-analyzer.md`
   - **If error handling changed**: `.claude/agents/silent-failure-hunter.md`
   - **If types added/modified**: `agents/type-design-analyzer.md`
   - **After passing review**: `.claude/agents/code-simplifier.md` (polish and refine)

7. **Launch Review Agents**

   **Prompt assembly (MANDATORY — never launch an agent with only the diff):**

   Every agent prompt is built from four parts, in this order:
   1. The full content of `agents/_shared/deep-review-protocol.md`
   2. The PR Context Pack (step 4)
   3. The behavior-delta note (step 5)
   4. The agent's own file content, read from its roster path (`.claude/agents/` for shared agents, `./agents/` for this skill's own)

   Agents read changed files and their surrounding code from the checked-out working tree — the diff is a map of what changed, not the review target.

   **Sequential approach** (one at a time):
   - Easier to understand and act on
   - Each report is complete before next
   - Good for interactive review

   **Parallel approach** (user can request):
   - Launch all agents simultaneously
   - Faster for comprehensive review
   - Results come back together

8. **Aggregate Results — Dedupe, Then Filter for Signal**

   After agents complete, consolidate all findings and deduplicate overlapping issues. Then apply the signal filter — **drop** any finding that:
   - is about formatting, naming preference, or style opinion
   - is hypothetical with no realistic trigger in this codebase
   - concerns pre-existing code the PR did not touch or make worse
   - cannot name the affected behavior/flow and its concrete impact

   Every surviving finding must carry all four parts of the finding anatomy (what's wrong, why it matters here, which flow is affected, practical fix). Fewer, deeper comments beat many shallow ones.

9. **Present Findings — Two Sections: Suggestions + TODOs**

   Always present the final review in **two distinct sections**. This is the **mandatory output format** — never use bullet-point lists.

   ### Section 1: Suggestions (grouped by severity with visual emphasis)

   Use **bold** on the `#` and `Issue` columns for Critical/Important rows to create visual weight. Minor rows use plain text. Each severity level gets its own table with a styled heading.

   **Clickable line links (MANDATORY for every issue):**

   At the start of the review, resolve the GitHub blob URL base for the PR's head branch:

   ```bash
   gh pr view <number> --json headRefName,url --jq '"https://github.com/" + (.url | split("/") | .[3] + "/" + .[4]) + "/blob/" + .headRefName'
   ```

   This gives you: `https://github.com/{owner}/{repo}/blob/{branch}`

   For every issue, determine the exact line number in the **new version** of the file (using the same hunk-header counting method described in the "Posting Inline Comments" section). Then construct a clickable link in the **File** column:

   Format: `[FileName.tsx:{line}]({blob_base}/{filepath}#L{line}) → functionName`

   This lets the reviewer click directly to the exact problematic line on GitHub.

   ```markdown
   # PR #<number> Review: <PR title>

   ## Critical — Must Fix Before Merge

   | #     | Issue                | File                                                                                                                           | What's Wrong                    | Fix                      |
   | ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------------------------ |
   | **1** | **Short issue name** | [`FileName.tsx:42`](https://github.com/{owner}/{repo}/blob/{branch}/apps/web/src/components/FileName.tsx#L42) → `functionName` | **Bold description of the bug** | Concrete fix instruction |
   | **2** | **...**              | ...                                                                                                                            | **...**                         | ...                      |

   ## Important — Should Fix

   | #     | Issue                | File                                                                                                                               | What's Wrong                   | Fix                      |
   | ----- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ |
   | **3** | **Short issue name** | [`user.service.ts:78`](https://github.com/{owner}/{repo}/blob/{branch}/apps/web/src/services/user.service.ts#L78) → `functionName` | **Description of the problem** | Concrete fix instruction |

   ## Minor — Nice to Have

   | #   | Issue            | File                                                                                                                             | What's Wrong | Fix             |
   | --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------- |
   | 5   | Short issue name | [`FileName.tsx:120`](https://github.com/{owner}/{repo}/blob/{branch}/apps/web/src/components/FileName.tsx#L120) → `functionName` | Description  | Fix instruction |
   ```

   ### Section 2: TODOs (numbered, prioritized action plan)

   After all suggestion tables, add a **separate TODOs section** with numbered TODO items (T1, T2, T3...) so the user can reference them by number (e.g. "add a comment on T3", "skip T7").

   ```markdown
   ---

   ## TODOs (Recommended Fix Order)

   | #   | Priority | TODO                                                                        | File                                                                                                                                  | Depends On | Effort |
   | --- | -------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
   | T1  | **P0**   | Fix the `canViewPll` grant-name typo (#1)                                   | [`StudentProfile.tsx:842`](https://github.com/{owner}/{repo}/blob/{branch}/apps/web/src/components/organisms/StudentProfile.tsx#L842) | —          | 1 min  |
   | T2  | **P0**   | Import shared `Student` type from `@oses/types` instead of redeclaring (#6) | [`marking.service.ts:910`](https://github.com/{owner}/{repo}/blob/{branch}/apps/web/src/services/marking.service.ts#L910)             | —          | 1 min  |
   | T3  | **P1**   | Infer the DTO type via `z.infer` (#5)                                       | [`create-exam.dto.ts:15`](https://github.com/{owner}/{repo}/blob/{branch}/apps/api/src/exams/dto/create-exam.dto.ts#L15)              | —          | 5 min  |
   | T4  | **P2**   | Remove dead code (#9)                                                       | [`ExamList.tsx:200`](https://github.com/{owner}/{repo}/blob/{branch}/apps/web/src/components/organisms/ExamList.tsx#L200)             | —          | 5 min  |

   > You can reference any TODO by its number (e.g. "add a comment on T3") to post it as a PR comment.
   ```

   ### Formatting rules:

   **Content rules:**
   - **Suggestions section**: Numbers are sequential across all severity tables (1, 2, 3... not restarting per section)
   - **Bold styling**: Critical and Important rows use `**bold**` on `#`, `Issue`, and `What's Wrong` columns. Minor rows are plain
   - **TODOs section**: Each TODO has a numbered ID (T1, T2, T3...) in the `#` column for easy reference
   - **TODOs reference suggestions**: Each TODO references the related suggestion number with `(#N)` in the TODO description
   - **TODO ordering**: Ordered by priority (P0 first), then by dependency chain
   - **Priority labels**: `**P0**` = must fix before merge, `**P1**` = should fix before merge, `**P2**` = can fix in follow-up
   - **Effort**: rough estimate (1 min, 5 min, 15 min, 30 min, 1 hr+)
   - **Depends On**: reference other TODO IDs (T1, T2...) or `—` if independent
   - **User interaction**: After presenting the review, the user can say "add a comment on T3" or "post T1 and T4 as PR comments" — use the TODO number to identify which finding to post
   - Keep "What's Wrong" concise — one sentence with actual impact
   - Keep "Fix" actionable — what exactly to change, not vague advice
   - **File column MUST be a clickable link** — format: `[FileName.tsx:{line}]({blob_url}#L{line}) → functionName`. The link uses the GitHub blob URL for the PR's head branch so clicking opens the file at the exact line. Never use plain text file paths without links
   - Omit severity sections that have zero issues

   **Spacing and visual separation rules (critical for readability):**
   - Use `---` horizontal rule between every major section (between severity groups, before TODOs)
   - Add **two blank lines** before each `## heading` to create clear visual breathing room
   - Add **one blank line** after each table before the next section
   - Between the Suggestions and TODOs sections, use a `---` horizontal rule with one blank line above and below
   - Each severity section heading must include an em-dash and description (e.g. `## Critical — Must Fix Before Merge`)
   - After the TODOs table, add a blank line then the hint blockquote
   - Never stack two tables back-to-back without a heading + blank line between them
   - The overall structure with spacing should look like:

   ```
   # PR Title                          ← H1 title

                                        ← 2 blank lines

   ## Critical — Must Fix Before Merge  ← H2 severity heading
                                        ← 1 blank line
   | table... |                         ← table

                                        ← 1 blank line

   ---                                  ← horizontal rule

                                        ← 1 blank line

   ## Important — Should Fix            ← next severity
                                        ← 1 blank line
   | table... |

                                        ← 1 blank line

   ---

                                        ← 1 blank line

   ## Minor — Nice to Have
                                        ← 1 blank line
   | table... |

                                        ← 1 blank line

   ---                                  ← separator before TODOs

                                        ← 1 blank line

   ## TODOs (Recommended Fix Order)
                                        ← 1 blank line
   | table... |
                                        ← 1 blank line
   > hint blockquote
   ```

10. **Interactive Comment Posting — MANDATORY One-by-One Flow**

This step is **not optional**. After presenting the full review, you MUST immediately start walking through every TODO one at a time using `AskUserQuestion`. Do NOT wait for the user to ask — start the interactive flow automatically right after the review output.

The user navigates with **arrow keys only** and presses Enter — no typing needed (unless they choose "Edit").

### 10a. Walk through each TODO sequentially

For **each** TODO (T1, T2, T3, ..., Tn), call `AskUserQuestion` with exactly these 4 options:

```json
{
  "questions": [
    {
      "question": "T1 [P0] — Fix canViewPll grant-name typo → StudentProfile.tsx:842. Post as PR comment?",
      "header": "T1",
      "multiSelect": false,
      "options": [
        {
          "label": "Post",
          "description": "Post this as an inline comment on the exact line in the PR"
        },
        { "label": "Skip", "description": "Skip this TODO, move to next" },
        { "label": "Edit", "description": "Write your own comment text, then post it" },
        {
          "label": "Post all remaining",
          "description": "Post this + all remaining TODOs without asking again"
        }
      ]
    }
  ]
}
```

**Question format:** Always include: TODO number, priority, short description, file:line.

### 10b. Handle each response

- **Post** → Mark this TODO for posting. Move to next TODO.
- **Skip** → Do not post. Move to next TODO.
- **Edit** → The user types freely (via "Other" or follow-up message). Save their custom text as the comment body. Mark for posting. Move to next TODO.
- **Post all remaining** → Mark this TODO AND every remaining TODO for posting. **Stop asking questions.** Proceed directly to batch-post.

### 10c. Collect ALL decisions first — do NOT post anything yet

Walk through every TODO collecting decisions. **Do NOT post any comments to GitHub until all TODOs have been answered** (or "Post all remaining" is selected). This prevents partial review states.

### 10d. Batch-post all marked TODOs in a single API call

After all decisions are collected, post every marked TODO as **inline comments on the exact problematic line** in a single `gh api` review request.

**Finding the correct line number (CRITICAL — misplaced comments undermine the review):**

1.  Run `gh pr diff <number>` and save the full output BEFORE starting the interactive flow
2.  For each TODO, find the target line in the diff
3.  Look at `@@` hunk headers: `@@ -old,count +new,count @@`
4.  The `line` parameter = the actual line number in the **new version** of the file (RIGHT side)
5.  Only comment on `+` lines (added/modified). If the problematic line is NOT in the diff, use the nearest changed line and reference the actual line in the comment body
6.  **Never guess line numbers** — count from the hunk header every time
7.  **Verify against the checked-out tree** — the PR is checked out locally, so `Read` the file at the computed line and confirm the content matches the finding before posting

**Post as a single review with all inline comments:**

```bash
gh api repos/{owner}/{repo}/pulls/{number}/reviews \
  -X POST \
  -f event="COMMENT" \
  -f 'comments[0][path]=apps/web/src/components/organisms/StudentProfile.tsx' \
  -f 'comments[0][line]=1162' \
  -f 'comments[0][side]=RIGHT' \
  -f 'comments[0][body]=Comment for T1' \
  -f 'comments[1][path]=apps/web/src/components/organisms/StudentProfile.tsx' \
  -f 'comments[1][line]=1178' \
  -f 'comments[1][side]=RIGHT' \
  -f 'comments[1][body]=Comment for T2'
```

**Comment body format (no attribution/signature) — all four parts required:**

```markdown
**[T1] [P0 — Critical]** Fix `canViewPll` grant-name typo

**What's wrong:** `props.canViewPll` references a misspelled prop — the real grant flag is `canViewPII`, so this is always `undefined` (falsy).

**Why it matters here:** PII rendering is gated on `canViewPII`; the typo makes it silently falsy, but any code that inverts or defaults it could instead leak candidate identity to an evaluator — an anonymity breach, not a cosmetic bug.

**Flow affected:** Evaluator marking view → `StudentProfile` → candidate PII rendering.

**Fix:** Change `props.canViewPll` to `props.canViewPII`
```

Every part must be specific to this PR and this codebase. If "Why it matters here" could be pasted onto any PR in any repo, the finding is too generic to post.

### 10e. Confirm result

After posting, print a summary:

```
Posted X of Y TODOs as inline comments on PR #NNNN.
Skipped: T3, T7 (or "None skipped")
```

11. **Wrap Up — Restore the Original Branch**

If step 2 checked out a different branch, return to where the user started:

- `git checkout <original-branch>`
- If a stash was created in step 2, `git stash pop` it
- Confirm with `git status` that the tree matches the starting state

### Rules — do NOT violate these

- **Always check out the PR before reviewing** — never review from a different branch's working tree
- **Always start the interactive flow automatically** after presenting the review — never wait for the user to ask
- **One question per TODO** — never batch multiple TODOs into one question
- **Never post comments without explicit user choice** per TODO
- **Always use inline comments** on the exact diff line — never use PR-level comments (`gh pr comment`)
- **Batch-post at the end** — never post one-by-one during the interactive flow
- **Never add Claude/AI attribution** to comment bodies — no signatures, no "Generated by" text
- **Every posted comment carries the four-part anatomy** — what's wrong, why it matters here, flow affected, fix
- **Always restore the original branch** when the review ends — even if the review is aborted midway

## Usage Examples:

**Full review (default):**

```
/review-pr
```

**Specific aspects:**

```
/review-pr tests errors
# Reviews only test coverage and error handling

/review-pr comments
# Reviews only code comments

/review-pr simplify
# Simplifies code after passing review
```

**Parallel review:**

```
/review-pr all parallel
# Launches all agents in parallel
```

## Agent Descriptions (see `agents/` for full prompts):

**`.claude/agents/architecture-reviewer.md`** — Validates atomic-design layer boundaries and app flow (web: component → service → mock-store; api: controller → Zod DTO → service → envelope), response/`ApiResponse<T>` consistency, naming conventions

**`.claude/agents/security-reviewer.md`** — Auth (JWT, RolesGuard/@Roles()), input validation (Zod/Yup), XSS (`dangerouslySetInnerHTML`), PII/anonymity leakage to evaluators, committed secrets

**`.claude/agents/data-contract-reviewer.md`** — `@oses/types` single source of truth, mock service/store shape consistency, Zod `z.infer` type inference, no accidental live-backend calls

**`.claude/agents/business-rules-reviewer.md`** — Candidate anonymity/PII gating, marking-model TRD divergence (flag, don't rewrite), RBAC grants vs roles, approval gates, multi-client tenancy

**`.claude/agents/frontend-reviewer.md`** — Tailwind v4 token usage, reserved marking colours (green/red/amber), atomic-design layer placement, Formik/Yup + React Query patterns, PII behind `canViewPII`

**`.claude/agents/performance-reviewer.md`** — Render cost (unnecessary re-renders, missing memoization, unstable keys, large-list rendering) and data-volume at 1M+ scale (unvirtualized long lists, in-memory filter/sort that belongs in the service contract, React Query cache growth, evaluator concurrency). Replaces the former separate performance and scalability reviewers

**`.claude/agents/breaking-change-reviewer.md`** — Renamed/removed methods with unchecked callers, changed return types, interface modifications, route URI changes, `@oses/types` field/enum renames, mock-store field renames

**`.claude/agents/comment-analyzer.md`** — Comment accuracy vs code, comment rot, documentation completeness

**`agents/pr-test-analyzer.md`** — Behavioral test coverage, critical gaps, test quality

**`.claude/agents/silent-failure-hunter.md`** — Silent failures, empty catch blocks, swallowed exceptions, missing error logging

**`agents/type-design-analyzer.md`** — Type encapsulation, invariant expression, type design quality

**`.claude/agents/code-reviewer.md`** — CLAUDE.md compliance, bug detection, general code quality

**`.claude/agents/code-simplifier.md`** — Code simplification, clarity, readability, project standards compliance

## Tips:

- **Run early**: Before creating PR, not after
- **Diff finds, tree judges**: The diff tells agents where to look; the checked-out working tree and surrounding code decide whether something is actually wrong
- **Address critical first**: Fix high-priority issues before lower priority
- **Re-run after fixes**: Verify issues are resolved
- **Use specific reviews**: Target specific aspects when you know the concern

## Workflow Integration:

**Before committing:**

```
1. Write code
2. Run: /review-pr code errors
3. Fix any critical issues
4. Commit
```

**Before creating PR:**

```
1. Stage all changes
2. Run: /review-pr all
3. Address all critical and important issues
4. Run specific reviews again to verify
5. Create PR
```

**After PR feedback:**

```
1. Make requested changes
2. Run targeted reviews based on feedback
3. Verify issues are resolved
4. Push updates
```

## Posting Inline Comments — Line Number Reference

Use the `line` parameter (NOT `position`) with `side=RIGHT` for inline comments. The `line` value is the **actual line number in the new version of the file** — not a diff-relative position.

**Mandatory process before posting any comments:**

1. Run `gh pr diff <number>` and save the full output at the START of the review (before the interactive flow)
2. For each TODO being posted, find the exact target line in the diff
3. Parse `@@` hunk headers: `@@ -old,count +new,count @@` — the `+new` number is where new-file line counting starts
4. Count forward from the hunk header to find the exact `line` value for each `+` line
5. Only comment on `+` lines (added/modified) — never on `-` lines (removed)
6. If the problematic line is NOT part of the diff, use the nearest `+` line and reference the actual line number in the comment body
7. **Double-check every line number by counting** — never guess or approximate

**Never guess or approximate line numbers.** A misplaced comment causes confusion and undermines the review.

## Notes:

- Agents run autonomously and return detailed reports
- Each agent focuses on its specialty for deep analysis
- Results are actionable with specific file:line references
- Agents use appropriate models for their complexity
- All agents available in `/agents` list
