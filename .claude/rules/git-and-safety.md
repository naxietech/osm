# Git & Safety

## Confidentiality (highest priority)

This is a **private client project**. Never paste source, data, schemas, or docs into external
services, web forms, LLM tools, or any third party. `SESSION-HANDOFF.md` holds confidential notes
and is **git-ignored on purpose — never commit it** (nor `.env` files).

## Branching

- Never edit on `main` (a pre-commit hook blocks it). Branch first:
  `git checkout -b osm-NNN-kebab-description`.
- `main` is the PR target. There is no `staging` branch.

## Commits

- Commit author is **Abdul0Mateen**.
- **Never use `--no-verify`** or otherwise bypass the pre-commit hooks (eslint + prettier + tests).
  A hook blocks the flag outright.
- Write clear, scoped messages describing the change and why. Use a HEREDOC to preserve formatting.
- End commit messages with the co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Pushing & PRs — explicit ask only

- **Do not `git push`, open/merge PRs, or switch gh accounts unless the user explicitly asks** for
  that action, that time. Editing and committing locally is fine; anything outward-facing needs a
  yes. Approval for one push/PR is not standing authorization for the next.
- Never `--force` / `--force-with-lease` on a shared branch, never `git reset --hard` or
  `git clean -f` on someone else's work.
- PR bodies end with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Never

- No `rm -rf` / `rm -r` (denied). To delete during a task, target specific files.
- No destructive git on shared history without an explicit ask.
