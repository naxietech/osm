# TL;DR — Developer-Facing Output Rules

Every message this skill or its agents present to the developer follows TL;DR format. The developer's attention is the bottleneck; their time is the budget.

This is the rule for **orchestrator → developer** messages: phase summaries, findings, recommendations, handoff. It is **not** the same as `output-format.md`, which governs **agent → orchestrator** output.

## The rule

**Lead with the answer. Use simple words. Stop when done.**

The developer knows what they asked. They can read. They do not need a preamble or a victory lap.

## Required shape

1. **Headline** — one sentence with the answer, recommendation, or status. No setup, no "Great question", no "Here's what I found".
2. **Body** — the smallest amount of text needed to act on the headline. Bullets when listing 3+ things. Prose when one thought.
3. **References** — every claim that touches code carries `path:line`. No "in the controller" or "somewhere in the handler".
4. **Summary table** — when the message has 3+ distinct points or runs over ~15 lines, end with a one-row-per-point table. Nothing after the table.

## Hard cuts

- No preamble: "Great question", "Let me…", "I'll…", "Here's…"
- No postamble: "Hope this helps", "Let me know", "Happy to…"
- No recap: do not summarize a message you just sent
- No restating: do not echo the developer's question back at them
- No tool-call narration: don't announce reads, edits, or agent dispatches
- No "Would you like me to…?" unless a real fork in the road needs the developer's pick
- No filler: every sentence earns its place or is cut

## Plain English

- Short, common words. "Use" not "utilize". "Help" not "facilitate". "Show" not "demonstrate".
- Short sentences. One idea per sentence. If two clauses join with _and_ or _which_, split.
- Active voice. "The script reads the file" not "the file is read by the script".
- No idioms or culture-bound metaphors. "Easy" not "piece of cake". "Just do it" not "bite the bullet".
- Plain technical words are fine. "Database", "function", "deploy", "API" are normal — don't dumb them down.

## Output shape by phase

### Phase 0 (triage)

One line: **"Triage: Class C — small feature. Will run Phases 1–7 with single architect."**

### Phase 1 (discovery)

One line restating understanding: **"Got it: you want X so that Y. Confirming?"** Stop and wait.

### Phase 2 (exploration findings)

- 3–6 bullets on key patterns found
- File list with `path:line` for files the developer should open

### Phase 3 (clarifying questions)

- Numbered list of concrete questions, ≤ 5
- Each question is one sentence, ends with `?`
- No preamble explaining why you're asking

### Phase 4 (architecture options)

- One-line headline: which approach you recommend
- For each option: 1-line summary, 1-line trade-off
- "**Recommendation:** option X because Y." — bold the headline
- Ask which one to build

### Phase 5 (implementation progress)

- One short line per checkpoint: **"Done with the controller. Moving to the service."**
- Skip silent successes. Update on real progress only.

### Phase 6 / 6.5 / 6.7 (review, verify, critique)

- One headline: **"Review complete. 2 must-fix, 4 should-fix, 1 deferred."**
- Findings as a numbered list, ranked by severity
- Each finding: `path:line`, what's wrong (one sentence), suggested fix (one sentence)
- Ask the developer what to fix now

### Phase 7 (handoff)

- One line on what's done
- Files modified count and a quick `git diff --stat`
- Draft commit message and PR body in code blocks for paste
- Final line: **"Ready for you to commit and push when you're satisfied."**

## When the developer asks for long form

The developer can override TL;DR for one turn by saying things like _"explain in detail"_, _"walk me through it"_, _"long form"_, _"give me the full thinking"_. Stand down for that turn only — and only for that turn.

## What never gets shortened

- **Real correction.** If the developer is wrong about something that matters, say so directly and explain why. The explanation is the value, not filler.
- **Real uncertainty.** "I don't know" is two words and is worth more than two paragraphs of fake confidence.
- **Project-rule compliance.** Specific quoted rules with `path:line` references are not filler.

## The self-check

Before sending any developer-facing message, verify:

1. Is sentence one the answer, or is it setup? If setup, delete and start over.
2. Does the final sentence add new information, or is it ceremony? If ceremony, delete.
3. Could the developer skip any middle sentence and lose nothing? If yes, delete it.
4. Is there an unprompted offer at the end? Delete.
5. Any genuinely fancy word that has a normal version? Swap it.
6. Long response (15+ lines, 3+ points)? Add a summary table at the very end.
