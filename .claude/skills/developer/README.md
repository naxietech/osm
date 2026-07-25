# Developer Skill

A self-contained skill that runs a team of specialized sub-agents to ship a code change:
triage → discover → ask → design → build → review → verify → hand off.

**Tuned for OSES.** The skill's structure (triage classes, phases, orchestration) is
stack-neutral, but the agents here have been sharpened for this repo: atomic-design layer
boundaries, `@oses/types` contracts, candidate-PII/anonymity rules, the "web runs on mocks /
api has no DB" reality, and our Vitest/Jest verify gates. It is **not a drop-in for other
projects as-is** — if you copy it elsewhere, expect to re-tune those OSES-specific agents (or
strip them back to the generic versions). Within OSES it's the general tool for any code
change: features, bug fixes, refactors.

## What it is for

Making a **code change in this repo**. It is not for research, deploys/ops, data analysis, or
designing a UI from scratch — just building and shipping changes to OSES.

## How it's wired

- **Most agents live in this folder; six review agents are shared.** `code-reviewer`, `frontend-reviewer`, `silent-failure-hunter`, `security-reviewer`, `breaking-change-reviewer`, and `performance-reviewer` live in **`.claude/agents/`** and are reused by the `review-pr` and `pre-pr-review` skills — one copy to maintain, dispatched by name. So this folder is **not** a clean drop-in for another project on its own; you'd also copy those shared agents.
- **Reads the project first.** `agents/_shared/stack-detection.md` + `project-rules-discoverer` tell every agent to read `.claude/rules/`, `CLAUDE.md`, and the code before reasoning.
- **Self-sufficient checks.** Two in-skill agents (`project-rules-discoverer`, `verification-runner`) replace what other skills do, so the skill needs no external skill to run.

## Folder layout

```
developer/
├── SKILL.md                          # the orchestrator — phases, agent picking
├── README.md                         # this file
└── agents/
    ├── _shared/
    │   ├── stack-detection.md        # what every agent does first
    │   ├── output-format.md          # agent → orchestrator output rules
    │   ├── triage-rubric.md          # Phase 0 classification rules
    │   ├── never-commits.md          # hard rule — skill never commits or pushes
    │   └── tldr-output.md            # orchestrator → developer messages always TL;DR
    │
    ├── # Exploration & understanding
    ├── code-explorer.md
    ├── convention-detective.md
    ├── impact-analyzer.md
    ├── ui-flow-tracer.md
    │
    ├── # Design & planning
    ├── code-architect.md
    ├── frontend-architect.md
    ├── refactoring-strategist.md
    ├── edge-case-explorer.md
    │
    ├── # Implementation
    ├── standards-enforcer.md
    ├── documentation-writer.md
    ├── test-designer.md
    ├── unit-test-writer.md
    │
    ├── # Review — hygiene
    ├── bug-hunter.md
    ├── dead-code-finder.md
    ├── secrets-scanner.md
    ├── null-safety-auditor.md
    │
    ├── # Review — security
    ├── pii-redaction-auditor.md
    │
    ├── # Review — frontend
    ├── a11y-auditor.md
    ├── layout-geometry-auditor.md
    │
    ├── # Review — architecture
    ├── module-boundary-auditor.md
    ├── dependency-inspector.md
    │
    ├── # Review — tests
    ├── test-coverage-gap.md
    ├── flake-detector.md
    │
    ├── # Plumbing (replace what external skills used to do)
    ├── project-rules-discoverer.md
    ├── verification-runner.md
    │
    ├── # Self-critique
    ├── critique-agent.md
    │
    └── # Output
    └── pr-writer.md
```

**Shared review agents** (in `.claude/agents/`, dispatched by name; reused by `review-pr` and
`pre-pr-review`): `code-reviewer`, `frontend-reviewer`, `silent-failure-hunter`,
`security-reviewer`, `breaking-change-reviewer`, `performance-reviewer`.

## How shared fragments work

Five files in `agents/_shared/` are referenced by every agent's prompt and by the orchestrator itself:

- **`stack-detection.md`** — what to read (manifests, rules files), what to extract, hard rules ("never recommend a tool the project doesn't use")
- **`output-format.md`** — required output structure for **agent → orchestrator** messages: confidence floor, ranking, file:line references, tone, length
- **`triage-rubric.md`** — Class A through G definitions used by Phase 0 to scale the rest of the phases
- **`never-commits.md`** — the hard rule that no agent and no orchestrator step ever runs `git commit`, `git push`, or `gh pr create`
- **`tldr-output.md`** — the rule for **orchestrator → developer** messages: lead with the answer, plain English, no ceremony, summary table for long responses

When the orchestrator (parent Claude running `SKILL.md`) dispatches an agent, it should include the relevant shared fragments in the agent's prompt, so the agent has consistent rules without each file repeating them.

## Adding a new agent

Three steps:

**1. Copy a similar existing agent** in `agents/` and rename it. Pick the closest match — auditors look like other auditors, generators look like other generators.

**2. Update the frontmatter:**

```yaml
---
name: your-agent-name
description: Single-line, ≤ 200 chars, what it finds or builds
tools: Glob, Grep, LS, Read, NotebookRead, TodoWrite, KillShell, BashOutput
model: sonnet # haiku for mechanical scans, opus for adversarial
color: <distinctive>
---
```

**3. Update SKILL.md:**

- Add a row in the Agent Roster section
- Add it to the right phase's parallel-fan-out list

That's it. No registration step. The orchestrator picks the agent up by file path.

## Tuning model tiers

Each agent declares its own model in frontmatter. The current defaults:

- **Haiku** (cheap, mechanical) — `dead-code-finder`, `secrets-scanner`, `project-rules-discoverer`, `pr-writer`
- **Sonnet** (default, balanced) — most analysis and design agents
- **Opus** (deep reasoning, expensive) — currently none by default; consider for `bug-hunter` and the shared `security-reviewer` on production-critical projects

Changing models is a one-line edit per file. To make `bug-hunter` use opus:

```diff
- model: sonnet
+ model: opus
```

## Customizing for your project

The skill works out of the box, but you can sharpen it for your specific codebase by adding a project-specific layer:

**Option A — extra agent files.** Drop your project-specific agents in `agents/` (e.g., `agents/your-domain-rule-checker.md`). They show up alongside the generic ones.

**Option B — project shared rules.** Add a `_shared/project-rules.md` file with rules specific to your codebase. Reference it from your custom agents.

**Option C — fork.** Make a project-specific copy of `developer/` with the modifications you need. The skill is small enough to maintain a fork without much overhead.

Don't modify the generic agents in place if you plan to update from this folder later. Layer your changes on top.

## Verification

After copying the skill into a project, smoke-test it:

1. Run the skill on a tiny task (e.g., "Fix this typo in the README").
2. Confirm Phase 0 classifies it as Class A.
3. Confirm Phase 6.5 runs `verification-runner` and detects the project's test command.

If `verification-runner` can't find the test command, edit it to add the project's specific entry. The agent is designed to be customized.

## What this skill won't do

- **Commit, push, or open PRs.** Hard rule. See `agents/_shared/never-commits.md`. The developer commits; this skill prepares the artifacts and stops.
- **Run destructive commands.** No `rm -rf`, no `git reset --hard`, no `git clean -fdx` without user approval.
- **Bypass project rules.** `agents/_shared/stack-detection.md` mandates that agents detect and follow what the project actually does.
- **Run all 40+ agents on every task.** The triage rubric is there exactly to prevent this.

## License / use

Copy freely. Adapt freely. This skill exists to make development less repetitive across many projects — keep it that way.
