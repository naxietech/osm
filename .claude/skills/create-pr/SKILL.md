---
name: create-pr
description: Creates a GitHub PR from the current branch against main, with an auto-generated title and description built from the git diff and commit history. Runs only when you explicitly ask. Uses the gh CLI.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [optional PR title or description override]
---

# /create-pr

Create a pull request for my current branch: $ARGUMENTS

---

## What this does

Creates a GitHub PR from the current feature branch **targeting `main`** (the only PR target — there is no staging branch). Analyses the git diff, commit history, and changed files to auto-generate a meaningful title and description. Uses the GitHub CLI (`gh`, which is available). Only run this when the user has explicitly asked to open a PR.

---

## Step 1 — Validate branch

```bash
git rev-parse --abbrev-ref HEAD
```

- If on `main` — **STOP**. Say: _"You're on `main`. Switch to a feature branch first."_
- If the branch has no commits ahead of `main` — **STOP**. Say: _"No changes to create a PR for."_

---

## Step 2 — Gather context

Run these in parallel:

```bash
git status                              # Check for uncommitted changes
git log main..HEAD --oneline            # All commits on this branch
git diff main..HEAD --stat              # Files changed summary
git diff main..HEAD --name-only         # List of changed files
```

- If there are **uncommitted changes**, warn: _"You have uncommitted changes that won't be in the PR. Run /commit-push first or proceed without them."_
- If the branch is **not pushed to remote**, push it first: `git push -u origin <branch-name>` (this is part of opening the PR the user asked for).

---

## Step 3 — Analyse changes

Read the changed files to understand the scope:

- What feature / fix / refactor does this represent?
- Which parts of the monorepo are affected? (`apps/web` pages, services, design-system layers; `apps/api` controllers, services, DTOs, guards; `packages/types`)
- Any project-rule implications? (atomic-design boundaries, PII/anonymity, mock-only web, no-DB api — see `.claude/rules/`)

Derive all context from the **diff, commits, and branch name** — there are no ticket IDs.

---

## Step 4 — Generate PR title and description

If `$ARGUMENTS` contains a title, use it. Otherwise, generate one from the analysis.

**Title rules:**

- Under 70 characters
- Start with a verb, or match the repo's Conventional Commit style (`feat(web):`, `fix(api):`)
- Be specific about what changed

**Description template:**

```markdown
## Summary

- [2-4 bullet points describing what changed and why]

## Changes

- [key file changes grouped by area: apps/web, apps/api, packages/types]

## Notes

- [anything to verify: which verify gate was run, follow-ups, scope caveats]
```

---

## Step 5 — Create PR

The PR always targets `main`.

```bash
gh pr create --base main --title "<title>" --body "$(cat <<'EOF'
## Summary
<bullets>

## Changes
<file changes>

## Notes
<notes>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Do not switch the active `gh` account.

---

## Step 6 — Output

Show:

- PR URL (clickable)
- PR title
- Base branch (`main`)
- Number of files changed
- Number of commits included
