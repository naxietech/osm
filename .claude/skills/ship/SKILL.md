---
name: ship
description: Full ship workflow — commits changes, pushes to remote, and creates a GitHub PR against main in one step. Runs only when you explicitly ask. Combines /commit-push and /create-pr.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [optional PR title or commit message]
---

# /ship

Ship my changes — commit, push, and create PR: $ARGUMENTS

---

## What this does

One command to go from local changes to an open PR: analyses all changes, generates a commit message, pushes to remote, then creates a GitHub PR against `main` with an auto-generated title and description. Uses the GitHub CLI (`gh`). Only run this when the user has explicitly asked to ship / push / open a PR — the request itself is the authorisation for the push and PR.

---

## Step 1 — Validate branch

```bash
git rev-parse --abbrev-ref HEAD
```

- If on `main` — **STOP**. Say: _"You're on `main`. Create a feature branch first: `git checkout -b osm-NNN-kebab-description`."_

---

## Step 2 — Gather all context

Run in parallel:

```bash
git status                              # All changes
git diff --stat                         # Unstaged summary
git diff --staged --stat                # Staged summary
git diff --name-only                    # Unstaged files
git diff --staged --name-only           # Staged files
git ls-files --others --exclude-standard # Untracked files
git log main..HEAD --oneline            # Commits already on branch
git log --oneline -5                    # Recent commit style
```

- If there are **no changes AND no commits ahead of main** — **STOP**. Say: _"Nothing to ship — no changes or new commits."_

---

## Step 3 — Analyse changes

Read the full diff of all uncommitted changes plus all commits ahead of `main`:

```bash
git diff                    # Unstaged changes
git diff --staged           # Staged changes
git diff main..HEAD         # All committed changes on branch
```

Categorise:

- What feature / fix / refactor is this?
- Which parts of the monorepo are touched? (`apps/web` pages, services, design-system layers; `apps/api` controllers, services, DTOs, guards; `packages/types`)
- Any project-rule implications? (atomic-design boundaries, PII/anonymity, mock-only web, no-DB api)

Derive context from the **diff, commits, and branch name** (`osm-NNN-kebab-description`) — there are no ticket IDs.

---

## Step 4 — Commit (if uncommitted changes exist)

Skip this step if the working tree is clean.

**Generate a commit message** (or use `$ARGUMENTS` if provided):

- Under 72 characters first line
- Starts with a verb, or matches the repo's Conventional Commit style (`feat(web):`, `fix(api):`)

```bash
# Stage specific files by name (never git add -A / git add .)
git add <file1> <file2> ...

# Commit
git commit -m "$(cat <<'EOF'
<commit message>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

**Never** stage or commit `.env` or `SESSION-HANDOFF.md` (git-ignored, confidential). **Never use `--no-verify`** — a hook blocks it and the pre-commit hooks (eslint + prettier + tests) must run. If a hook fails, fix it and make a NEW commit (never `--amend`). Commit author is **Abdul0Mateen**.

---

## Step 5 — Push to remote

```bash
git push -u origin <branch-name>
```

Never switch the active `gh`/git account to push.

---

## Step 6 — Create PR

The PR always targets `main`. Combine context from **all** commits on the branch (not just the latest) to generate it.

**PR title:** under 70 characters. Use `$ARGUMENTS` if provided, otherwise generate from the analysis.

```bash
gh pr create --base main --title "<title>" --body "$(cat <<'EOF'
## Summary
- [2-4 bullet points covering ALL commits on the branch]

## Changes
- [key file changes grouped by area: apps/web, apps/api, packages/types]

## Notes
- [anything to verify: which verify gate was run, follow-ups, scope caveats]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Step 7 — Output

Show:

- PR URL (clickable)
- PR title
- Base branch (`main`)
- Branch name
- Commit(s) included (count + short hashes)
- Files changed (count)
