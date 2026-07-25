# Claude Code — OSES

This is the Claude Code setup for **OSES (On-Screen Exam System)**. It configures how Claude
works in this repo: the always-loaded project rules, the skills (invokable with
`/skill-name [args]`), the `security-reviewer` agent, and the safety hooks/permissions.

Start with the root **`CLAUDE.md`** — it's the project map. The detailed conventions live in
`.claude/rules/` and load every session.

---

## Stack (what these skills target)

- **Monorepo**: Turborepo + pnpm 9 (Node ≥ 20).
- **`apps/web`**: Vite + React 18 + TypeScript + Tailwind v4 + Formik/Yup + React Query +
  react-router + recharts. Atomic Design with ESLint-enforced layer boundaries. **Runs on mocks.**
  Tested with **Vitest**.
- **`apps/api`**: NestJS 10 scaffold (JWT auth, Zod DTOs, guards, Swagger). **No database yet.**
  Tested with **Jest**.
- **`packages/types`**: `@oses/types` — shared type + enum contract.

Skills use `pnpm` / `turbo` / `npx` (vitest, jest, tsc, eslint, vite) — never `php`/`composer`/`npm`.

---

## Development flow

```
1. Build        → /developer  (triage → discover → design → build → review → verify → hand off)
2. Self-review  → /pre-pr-review
3. Commit       → /commit-push        (blocks on main; never --no-verify)
4. Open PR      → /create-pr  (or /ship to do 3+4)  — target is main; only when you ask
5. Review a PR  → /review-pr <n>, /pr-resolver
6. Keep in sync → /sync-docs, /handoff
```

---

## Skills

| Skill            | What it does                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/developer`     | Main build companion. Orchestrates specialist sub-agents across triage → discovery → clarify → design → implement → review → verify → critique → handoff. Never commits/pushes on its own. |
| `/pre-pr-review` | Full specialist self-review before pushing (architecture, security, PII/domain rules, frontend, tests…).                                                                                   |
| `/review-pr`     | Review one GitHub PR: fetch diff, read changed files, apply the checklist, post comments.                                                                                                  |
| `/pr-resolver`   | Work through PR feedback: group comments, evaluate, resolve, reply, close threads.                                                                                                         |
| `/commit-push`   | Stage → context-aware commit (author Abdul0Mateen) → push. Blocks on `main`, never `--no-verify`.                                                                                          |
| `/create-pr`     | Open a GitHub PR against `main` with an auto-generated title + body.                                                                                                                       |
| `/ship`          | `commit-push` + `create-pr` in one step.                                                                                                                                                   |
| `/handoff`       | Write/resume a session-handoff file. (`SESSION-HANDOFF.md` is git-ignored — never commit it.)                                                                                              |
| `/sync-docs`     | Audit + sync `CLAUDE.md`, `.claude/rules/`, `.claude/README.md`, root `README.md`, and `docs/` against the code.                                                                           |

---

## Directory structure

```
.claude/
├── README.md            ← this file
├── CLAUDE.md            ← (root of repo) the project map — read first
├── settings.json        ← shared: safety hooks + permissions + enabled plugins
├── settings.local.json  ← personal, machine-local (git-ignored)
├── agents/
│   └── security-reviewer.md   ← Agent-tool reviewer (XSS, PII/anonymity, JWT/RBAC, secrets)
├── rules/               ← always-loaded project conventions
│   ├── atomic-design.md
│   ├── typescript-conventions.md
│   ├── web-conventions.md
│   ├── api-conventions.md
│   ├── shared-types-and-pii.md
│   ├── domain-rules.md
│   ├── testing-and-gates.md
│   └── git-and-safety.md
└── skills/
    └── <skill-name>/SKILL.md   (+ agents/ for multi-agent skills)
```

---

## Safety (settings.json)

- **Hooks** — block editing on `main` (branch first: `osm-NNN-kebab-description`); block edits to
  protected paths (`.env`, `SESSION-HANDOFF.md`, lockfile, `node_modules`, `dist`, `.turbo`);
  block any Bash command containing `--no-verify`.
- **Permissions** — allow read-only git, `pnpm`/`turbo`/`npx` build+test+lint, and read-only `gh`.
  `git push` / `gh pr create` are **not** pre-allowed — they prompt, because pushing and opening
  PRs need an explicit ask each time. Denies `rm -rf`, force-push, hard reset, `chmod`/`sudo`, etc.
- Hooks are written for Git Bash and use `sed`/`git` only (**no `jq`** — it isn't installed here).

---

## Maintaining this setup

- Add a convention → a new/updated file in `rules/` (keep them tight; they load every session).
- Add a workflow → a new `skills/<name>/SKILL.md` with YAML frontmatter.
- After a codebase shift, run `/sync-docs` to reconcile the docs and this config with the code.
