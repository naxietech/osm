---
name: pr-resolver
description: Multi-agent PR feedback resolver — builds PR context, groups related comments, evaluates against project conventions, walks through each with assessment, resolves approved items, verifies changes, composes reviewer replies, and resolves GitHub threads.
argument-hint: '[PR number — auto-detected if omitted]'
allowed-tools: ['Bash', 'Glob', 'Grep', 'Read', 'Edit', 'Write', 'AskUserQuestion', 'Agent']
---

# /pr-resolver

Resolve PR review feedback interactively: $ARGUMENTS

---

## What this does

Orchestrates 5 specialized agents to resolve PR review comments efficiently:

1. **Context Builder** — reads diff, commits, PR description, project rules (runs once)
2. **Comment Evaluator** — groups related comments, reorders by file, evaluates validity (runs once)
3. **Resolver** — makes precise code changes for approved comments (sequential per approval)
4. **Verifier** — reviews combined changes for regressions and consistency (runs once at end)
5. **Reply Composer** — drafts GitHub replies for resolved/skipped comments (runs once after decisions)

---

## Where things live

```
.claude/skills/pr-resolver/
├── SKILL.md                        ← this file (orchestrator)
└── agents/
    ├── context-builder.md          ← Phase 1: gather PR context
    ├── comment-evaluator.md        ← Phase 2: group, reorder, evaluate
    ├── resolver.md                 ← Phase 4: make code changes
    ├── verifier.md                 ← Phase 5: verify all changes
    └── reply-composer.md           ← Phase 7: draft GitHub replies
```

---

## Output Rules

### Agent → Orchestrator

All agents follow these output rules so the orchestrator can merge and present cleanly:

- **Headline** — one sentence stating what you did or found
- **Findings / Results** — structured per the agent's specific format
- **Open questions** — anything unresolved. Omit if none
- Every claim that touches code includes `path:line`
- No ceremony, no restating the task, stop when actionable

### Orchestrator → User

- Lead with the answer. Use simple words. Stop when done.
- No preamble, no postamble, no recap, no tool-call narration
- Bullets when listing 3+ things. Every code reference carries `path:line`
- No "Would you like me to...?" unless a real fork needs the user's pick

---

## Phase 0 — Identify the PR

If `$ARGUMENTS` contains a PR number, use it. Otherwise, auto-detect:

```bash
gh pr view --json number,title,url --jq '"\(.number) \(.title) \(.url)"'
```

Also extract owner/repo for API calls:

```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'
```

If no PR exists for the current branch — **STOP**. Say: _"No open PR found for this branch. Push your branch and create a PR first."_

---

## Phase 1 — Build Context (Context Builder Agent)

Dispatch `context-builder` agent with:

- PR number
- Repository owner/name

The agent reads:

- Full PR diff (`gh pr diff`)
- Commit history (`git log --oneline main..HEAD`)
- PR description (`gh pr view --json body`)
- Relevant `.claude/rules/` files based on changed file types
- `CLAUDE.md` for project-wide conventions

**Output:** A structured context summary covering PR intent, files changed, key code changes, applicable rules, and potential concerns.

Cache this output — every downstream agent receives it.

---

## Phase 2 — Fetch and Evaluate Comments

### 2a. Fetch all review comments

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '.[] | {id: .id, path: .path, line: (.line // .original_line), body: .body, user: .user.login, created_at: .created_at}'
```

Also fetch PR review body comments:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/reviews --jq '.[] | select(.body != "" and .body != null) | {id: .id, body: .body, user: .user.login, state: .state}'
```

- If there are **no comments** — **STOP**. Say: _"No review comments found on PR #N."_

### 2b. Evaluate all comments (Comment Evaluator Agent)

Dispatch `comment-evaluator` agent with:

- The context summary from Phase 1
- All fetched comments

The agent:

1. **Groups related comments** — detects when multiple comments describe the same underlying issue across different files (e.g., "Same XSS issue" on 3 files). Groups them so the user makes one decision, not N.
2. **Reorders by file → line** — sorts comments and groups by file path (alphabetical), then line number (ascending). The user processes all feedback for one file before moving to the next.
3. **Evaluates each** — validity, convention alignment, actionability, impact, assessment, suggested action.

**Output:** Grouped, ordered, evaluated comments ready for the interactive walk-through.

---

## Phase 3 — Interactive Walk-Through (Orchestrator)

Present each evaluated comment/group to the user one-by-one using `AskUserQuestion`, in the order determined by the evaluator (by file, then line).

### For standalone comments

```json
{
  "questions": [
    {
      "question": "Comment 1/N — {file}:{line}\n\n> {comment body}\n\nAssessment: {agent's evaluation and reasoning}",
      "header": "1/N",
      "multiSelect": false,
      "options": [
        {
          "label": "Resolve",
          "description": "{agent's suggested fix, or 'Make the requested change'}"
        },
        { "label": "Skip", "description": "{agent's skip reason, or 'Move to next comment'}" },
        {
          "label": "Resolve all remaining",
          "description": "Resolve this + all remaining valid comments without asking"
        }
      ]
    }
  ]
}
```

### For grouped comments

When presenting a group, show all related comments together as one decision:

```json
{
  "questions": [
    {
      "question": "Group A (3 comments) — {issue description}\n\nFiles: {file1}:{line1}, {file2}:{line2}, {file3}:{line3}\n\n> {primary comment body}\n\nAssessment: {agent's evaluation — applies to all files in the group}",
      "header": "A",
      "multiSelect": false,
      "options": [
        { "label": "Resolve all 3", "description": "{agent's suggested fix applied to all files}" },
        { "label": "Skip all 3", "description": "{agent's skip reason}" },
        {
          "label": "Resolve all remaining",
          "description": "Resolve this group + all remaining valid comments"
        }
      ]
    }
  ]
}
```

### Handle each response

- **Resolve / Resolve all N** → Queue comment(s) for resolution in Phase 4.
- **Skip / Skip all N** → Record as skipped with reason. Move to next.
- **Resolve all remaining** → Queue this + all remaining comments the evaluator assessed as valid. Auto-skip comments assessed as "already fixed" or "invalid". Note auto-skips in the summary.

### Rules

- **One question per comment or group** — never batch unrelated comments
- **Show the full comment body** — don't truncate
- **Include the agent's assessment** — this is the value-add
- **Never auto-resolve** — every comment/group needs explicit user approval
- **Groups save clicks** — 3 related comments = 1 decision, not 3

---

## Phase 4 — Resolve Approved Comments (Resolver Agent)

For each comment the user approved, dispatch `resolver` agent with:

- The comment (file, line, body)
- The context summary from Phase 1
- Any specific instruction from the user (if they typed a custom response)

For **grouped comments**, send all files in the group to a single resolver invocation so the same fix is applied consistently.

The resolver:

1. Reads the target file(s) at the referenced line
2. Reads relevant `.claude/rules/` if needed
3. Makes the minimal precise edit
4. Checks for ripple effects (renames across files, removed references)
5. Reports what was changed

**Sequential execution** — resolve one comment/group at a time to avoid conflicts when multiple comments touch the same file.

If multiple standalone approved comments reference the same file, group them and send to a single resolver invocation.

---

## Phase 5 — Verify All Changes (Verifier Agent)

After all resolutions, dispatch `verifier` agent with:

- The context summary from Phase 1
- List of all resolutions made
- The current `git diff`

The verifier checks:

1. **Consistency** — renames applied everywhere, patterns consistent
2. **No regressions** — no working code removed, no syntax errors
3. **Convention compliance** — changes follow `.claude/rules/`
4. **Completeness** — each resolution addresses its comment
5. **File integrity** — no broken files

**Output:** PASS or FAIL with details.

If FAIL — present the issues to the user and ask how to proceed.

---

## Phase 6 — Diff Preview and Summary

### 6a. Show the actual diff

Before asking to commit, show the user what will be committed:

```bash
git diff --stat
```

Then show the full diff of key changes (files with substantive edits, not just whitespace):

```bash
git diff
```

Present this as a summary: "Here's what will be committed:" followed by the stat output.

### 6b. Show decision summary

```
Resolved: X of Y comments (Z via groups)
Skipped: [list with one-line reasons]
Files changed: [list]
Verification: PASS/FAIL
```

### 6c. Ask to commit and push

Only if at least one comment was resolved and verification passed:

```json
{
  "questions": [
    {
      "question": "Diff above shows all changes. Commit and push?",
      "header": "Commit",
      "multiSelect": false,
      "options": [
        {
          "label": "Commit and push",
          "description": "Stage, commit, and push all changes to remote"
        },
        { "label": "Commit only", "description": "Stage and commit locally, don't push" },
        { "label": "No", "description": "Leave changes uncommitted for manual review" }
      ]
    }
  ]
}
```

### If user chooses Commit and push / Commit only:

```bash
git add <specific changed files>
git commit -m "Address PR #N review feedback

- <brief description of each resolved comment>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Push only if user chose "Commit and push":

```bash
git push
```

Show:

```
Branch: <branch-name>
Commit: <short hash>
Files changed: N
```

### If user chooses No:

Say: _"Changes left uncommitted. Review with `git diff` and commit when ready."_

If no changes were made: _"No changes made — all comments were skipped."_

---

## Phase 7 — Reply to Reviewer and Resolve Threads

This phase runs **only after a successful commit and push** (user chose "Commit and push" in Phase 6).

### 7a. Compose replies (Reply Composer Agent)

Dispatch `reply-composer` agent with:

- All decisions (resolved + skipped comments with reasons)
- The context summary from Phase 1
- Resolution details (what was changed, commit hash)

The agent drafts short, professional replies for each comment:

- **Resolved:** `Fixed in {commit} — {description}.`
- **Skipped (already fixed):** `Already addressed in {commit hash}.`
- **Skipped (convention):** `Keeping as-is — follows convention in \`.claude/rules/{file}.md\`.`
- **Skipped (user decision):** `Noted — keeping current approach for now.`

### 7b. Ask to post replies

Present the drafted replies to the user:

```json
{
  "questions": [
    {
      "question": "Post replies to reviewer? Here are the drafts:\n\n{formatted list of replies per comment}",
      "header": "Replies",
      "multiSelect": false,
      "options": [
        {
          "label": "Post all replies",
          "description": "Post all drafted replies as GitHub PR comments"
        },
        {
          "label": "Post resolved only",
          "description": "Only reply to comments that were resolved, skip the rest"
        },
        { "label": "Skip", "description": "Don't post any replies" }
      ]
    }
  ]
}
```

### 7c. Post replies via GitHub API

For each approved reply, post as a reply to the original comment:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies \
  -X POST \
  -f body="{reply text}"
```

### 7d. Resolve GitHub review threads

After posting replies, resolve the conversation threads for resolved comments:

First, fetch the thread IDs for the comments:

```bash
gh api graphql -f query='
{
  repository(owner: "{owner}", name: "{repo}") {
    pullRequest(number: {number}) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes {
              databaseId
            }
          }
        }
      }
    }
  }
}'
```

Then resolve each thread for resolved comments:

```bash
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {threadId: "{thread_id}"}) {
    thread {
      isResolved
    }
  }
}'
```

Only resolve threads for comments that were **resolved** (code was changed). Do NOT resolve threads for skipped comments — the reviewer should see those replies and decide.

### 7e. Confirm

```
Posted X replies on PR #N.
Resolved X/Y review threads.
```

---

## Agent Model Tiers

| Agent             | Model  | Why                                                   |
| ----------------- | ------ | ----------------------------------------------------- |
| Context Builder   | sonnet | Heavy reading, structured summarization               |
| Comment Evaluator | sonnet | Nuanced judgment, grouping logic, convention matching |
| Resolver          | sonnet | Precise code edits with context awareness             |
| Verifier          | sonnet | Cross-file consistency analysis                       |
| Reply Composer    | haiku  | Templated text generation, low complexity             |

---

## Important Rules

- **Never auto-resolve** — every comment/group needs explicit user approval
- **Assessment informs, doesn't decide** — agents evaluate, user decides
- **Build context before evaluating** — Phase 1 always runs before Phase 2
- **Group related comments** — same issue across N files = 1 decision, not N
- **Order by file** — minimize context-switching during walk-through
- **Sequential resolution** — resolve one at a time to avoid edit conflicts
- **Verify before commit** — always run verifier after resolutions
- **Preview before commit** — show `git diff --stat` before asking to commit
- **Replies only after push** — Phase 7 only runs if code was pushed
- **Resolve threads selectively** — only resolve threads where code was changed
- **One commit at the end** — don't commit after each fix
- **Preserve code style** — edits must match existing formatting
- **Don't over-fix** — only change what each comment asks for
- Stage specific files — never `git add -A` or `git add .`
- Do NOT include `.env`, credentials, or sensitive files
