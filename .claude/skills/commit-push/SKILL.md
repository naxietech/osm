---
name: commit-push
description: Stages changed files, generates a context-aware commit message from the diff and branch name, and commits as Abdul0Mateen. Pushes only when you explicitly ask. Blocks on the main branch.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [optional commit message override]
---

# /commit-push

Commit my changes: $ARGUMENTS

---

## What this does

Analyses staged and unstaged changes, generates a meaningful commit message from the actual diff and the branch name, and commits everything as the project author. Blocks on `main`. It pushes **only when you explicitly ask**; otherwise it commits and stops.

---

## Step 1 — Validate branch

```bash
git rev-parse --abbrev-ref HEAD
```

- If on `main` — **STOP**. Say: _"You're on `main`. Create a feature branch first: `git checkout -b osm-NNN-kebab-description`."_ A pre-commit hook blocks edits on `main`, so there is nothing to commit here anyway.

---

## Step 2 — Gather changes

Run in parallel:

```bash
git status                    # Overview of all changes
git diff --stat               # Unstaged changes summary
git diff --staged --stat      # Already staged changes
git diff --name-only          # Unstaged changed files
git diff --staged --name-only # Staged changed files
git log --oneline -5          # Recent commits for message style
```

- If there are **no changes** (clean working tree) — **STOP**. Say: _"Nothing to commit — working tree is clean."_

---

## Step 3 — Analyse the diff

Read the full diff of all changes:

```bash
git diff                # Unstaged
git diff --staged       # Staged
```

Also list any new untracked files:

```bash
git ls-files --others --exclude-standard
```

For each changed file, understand:

- What was modified and why (from the diff context)
- Which part of the monorepo it touches (`apps/web`, `apps/api`, `packages/types`)
- Whether it's a new feature, bug fix, refactor, config change, etc.

Derive context from the **diff and the branch name** (branches follow `osm-NNN-kebab-description`) — there are no ticket IDs to reference.

---

## Step 4 — Generate commit message

If `$ARGUMENTS` contains a message, use it. Otherwise, generate one.

**Commit message rules:**

- First line: under 72 characters, starts with a verb (Add, Fix, Update, Refactor, Remove)
- Be specific about what changed — not generic like "update files"
- Match the style of recent commits in the repo (many use Conventional Commit prefixes like `feat(web):` / `fix(api):`)
- If multiple unrelated changes, summarise the primary change in the first line
- Add a blank line + bullet points for secondary changes if needed

**Format:**

```
<verb> <what changed> — <brief why>

- Secondary change 1
- Secondary change 2

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## Step 5 — Stage and commit

```bash
# Stage specific files by name (never git add -A / git add .)
git add <list of changed files>

# Commit with the generated message
git commit -m "$(cat <<'EOF'
<message>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

**Important:**

- Stage specific files by name — never `git add -A` or `git add .`
- Never stage or commit `.env` or `SESSION-HANDOFF.md` — both are git-ignored and confidential
- **Never use `--no-verify`** — a hook blocks it, and the pre-commit hooks (eslint + prettier + tests) must run
- If a pre-commit hook fails, fix the issue and retry with a NEW commit (never `--amend`)
- Commit author is **Abdul0Mateen** — do not switch git identity

---

## Step 6 — Push (only if the user asked)

Push **only when the user explicitly asked to push** in this request. If they only asked to commit, stop after Step 5 and tell them the commit is ready to push.

```bash
git push -u origin <branch-name>
```

Never switch the active `gh`/git account to push.

---

## Step 7 — Output

Show:

- Branch name
- Commit hash (short)
- Commit message
- Number of files changed
- Whether it was pushed (and the remote branch) or is waiting for an explicit push
