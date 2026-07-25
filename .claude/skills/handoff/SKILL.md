---
name: handoff
description: Session handoff — write or resume from a SESSION-HANDOFF.md file that captures the full state of an in-progress task. Use `/handoff` to save your current session state before ending, or `/handoff open` to resume a previous session. Trigger this skill whenever the user mentions "handoff", "save session", "pick up where we left off", "resume", "end session", "session notes", or "pass the baton".
user-invocable: true
argument-hint: [open]
---

# Handoff

Two modes:

- **`/handoff`** (no argument) — Save the current session to `SESSION-HANDOFF.md` at the project root.
- **`/handoff open`** — Read the existing `SESSION-HANDOFF.md` and resume the work described in it.

Both modes use the `/developer` skill's agents for codebase understanding before acting.

> **`SESSION-HANDOFF.md` is git-ignored and confidential.** It captures internal, in-progress working state for a private client project — never commit it, never push it, and never include it in a PR. If you find it is not covered by `.gitignore`, say so rather than committing it.

---

## Mode 1: Create Handoff (`/handoff`)

### Step 1 — Project Overview via Developer Skill

Before writing the handoff, use the `/developer` skill's exploration agents to build a grounded understanding of the project's current state. This prevents the handoff from being based solely on conversation memory.

**Dispatch these in parallel:**

1. **`project-rules-discoverer`** (from `.claude/skills/developer/agents/project-rules-discoverer.md`) — Scan the project for conventions, rules, and structure. Skip if this already ran earlier in the session.

2. **`code-explorer`** (from `.claude/skills/developer/agents/code-explorer.md`) — Explore the files and features touched during this session. Focus on the specific area of the codebase the user was working in, not the entire project. The explorer should return the key files, their current state, and how they relate to each other.

3. **Git state scan** — Run in parallel with the agents:
   ```bash
   git branch --show-current
   git log --oneline -5
   git status
   git diff --stat
   git diff --name-only HEAD~3..HEAD 2>/dev/null
   ```

The developer skill's agents give you an accurate picture of the code structure and conventions. The git commands give you the factual state of what's changed. Together, they ground the handoff in reality.

### Step 2 — Gather Session Context

With the project overview in hand, review the current conversation to extract:

1. **The goal** — What task or feature was the user working toward? Be specific. Not "fix a bug" but "fix the marking total not recomputing when a checker changes a per-question mark in `MarkingPanel`".
2. **Current state of the code** — What has been built, changed, or partially implemented? Cross-reference with the `code-explorer` findings and `git diff` output to ensure accuracy.
3. **Files actively being edited** — List every file that was created or modified during this session, with a one-line note on what was done to each.
4. **What was tried and failed** — Every approach that didn't work, why it failed, and what was learned. This is the most valuable part — it prevents the next session from repeating dead ends.
5. **Next steps** — Concrete actions the next session should take, in priority order. Specific enough that a fresh Claude instance can start executing immediately.

### Step 3 — Write `SESSION-HANDOFF.md`

**Check before you overwrite.** `SESSION-HANDOFF.md` may already exist and may hold content
that is NOT a prior handoff (e.g. confidential pricing or proposal notes). Read it first:

- If it's missing, or it's clearly a previous handoff (starts with `# Session Handoff`), write/overwrite freely.
- If it exists and contains anything else, **do not overwrite it.** Show the user what's there
  and ask whether to replace it, append the handoff under a divider, or write to a different
  file (e.g. `SESSION-HANDOFF.local.md`). You did not create that file — never clobber it silently.

Write the file at the project root using this structure (this file is git-ignored and confidential — never commit it):

```markdown
# Session Handoff

**Date**: [current date]
**Branch**: [current git branch]

## Goal

[One clear paragraph describing what we're building/fixing and why. Include the business context.]

## Current State

[What has been accomplished. What works, what's partially done, what's broken. Be honest.]

### Modified Files

| File   | Status                        | What Changed           |
| ------ | ----------------------------- | ---------------------- |
| [path] | [complete/in-progress/broken] | [one-line description] |

## What Was Tried (and Failed)

1. **[Approach name]** — [what was done]. Failed because [reason]. Lesson: [what to do differently].

## Uncommitted Changes

[Output of `git status` and `git diff --stat`.]

## Next Steps

1. [First thing to do]
2. [Second thing to do]
3. [Third thing to do]

## Context & Decisions

[Important decisions, constraints discovered, or non-obvious context. "We chose X over Y because Z."]
```

### Step 4 — Confirm

Show the user a brief summary of what was captured and confirm the handoff is ready.

---

## Mode 2: Resume from Handoff (`/handoff open`)

### Step 1 — Read the Handoff

Read `SESSION-HANDOFF.md` from the project root. If it doesn't exist, tell the user there's no handoff file to resume from and stop.

### Step 2 — Project Overview via Developer Skill

Use the `/developer` skill's agents to take a fresh overview and compare it against the handoff's recorded state.

**Dispatch these in parallel:**

1. **`project-rules-discoverer`** (from `.claude/skills/developer/agents/project-rules-discoverer.md`) — Scan the project for conventions and rules so the developer skill has its bootstrap context.

2. **`code-explorer`** (from `.claude/skills/developer/agents/code-explorer.md`) — Explore the files listed in the handoff's "Modified Files" table and the areas described in the "Goal" and "Next Steps" sections. The explorer should verify the current state of those files and flag anything that changed since the handoff was written.

3. **Git state scan** — Run in parallel with the agents:
   ```bash
   git branch --show-current
   git log --oneline -10
   git status
   git diff --stat
   ```

Compare the current state against what the handoff describes. Note discrepancies — files modified since the handoff, new commits, branch changes.

### Step 3 — Briefing

Present the user with a concise briefing:

- **Goal** (from handoff): [the goal]
- **Where we left off**: [current state, cross-referenced with code-explorer findings]
- **What was already tried**: [brief list of failed approaches so we don't repeat them]
- **Changes since handoff**: [any new commits, file modifications, or branch changes detected]
- **Recommended next step**: [first item from Next Steps, adjusted for any changes since the handoff]

### Step 4 — Resume with Developer Skill

Invoke the `/developer` skill with the full context from the handoff. The prompt to `/developer` should include:

- The goal from the handoff
- The files that were already modified (from the Modified Files table)
- The approaches that were tried and failed (so `/developer` avoids repeating them)
- The next steps to execute
- The project rules discovered in Step 2

The `/developer` skill then handles the actual implementation — triage, exploration, architecture, coding, review. The handoff skill's job is to load context and delegate.

---

## Rules

1. **Use developer agents, not raw scans.** The project overview must go through the developer skill's `code-explorer` and `project-rules-discoverer` agents, not just raw `find` or `grep` commands. These agents understand code structure, not just file listings.
2. **Be specific, not generic.** File paths, function names, error messages, line numbers. A handoff that says "fix the bug in the service" is useless. One that says "fix `recomputeTotal()` in `apps/web/src/services/marking.service.ts:142`" is actionable.
3. **Capture failures honestly.** The failed-attempts section prevents the next session from going in circles.
4. **Don't embellish the state.** If something is half-built and broken, say so.
5. **Keep it scannable.** Tables for file lists, numbered items for steps, bold for key terms.
6. **Never clobber unknown content.** If `SESSION-HANDOFF.md` already exists, read it first. Overwrite only a prior handoff (starts with `# Session Handoff`); if it holds anything else, stop and ask (see Step 3). Overwriting your own prior handoff on re-run is fine.
7. **Never commit the handoff.** `SESSION-HANDOFF.md` is git-ignored and confidential — do not commit, push, or include it in a PR.
