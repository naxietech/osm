# Output Format — Common Rules

Your output is read by a parent orchestrator (the developer skill) and ultimately by a human developer. The parent will dedup, rank, and merge findings from multiple agents. Follow this format so it can do that cleanly.

## Required structure

1. **Headline** — one sentence stating what you reviewed, designed, or found.
2. **Findings** — grouped by severity, ranked within group. Each finding has:
   - Severity (`Critical` / `Important` / `Minor`) or confidence score (0–100)
   - File path and line number — `path/to/file.ext:42`
   - One short paragraph explaining the issue and why it matters
   - Concrete fix or next step (a code snippet, a one-line direction, or a named pattern to follow)
3. **Files to read next** — 5–10 paths the parent should open to deepen context. Skip files the parent already saw.
4. **Open questions** — anything you could not determine and need from the user. If none, omit this section.

## Confidence floor

Report findings only at confidence ≥ 80. Below that, the false-positive rate drowns the signal. If a concern is real but you cannot verify it, mark it as an Open Question instead of a low-confidence finding.

## What to skip

- Pre-existing issues outside the scope of the current change
- Generic best-practice nags not tied to a real bug or convention
- Restating diff content the parent already has
- Ceremony ("Great question!", "Hope this helps!", "Let me know if…")

## Reference precision

Every claim that touches code includes `path:line`. No "in the controller", no "somewhere in the handler". If the line spans a range, write `path:42-58`.

## Tone

Direct, concrete, no hedging. "This deadlocks under N concurrent writes" beats "this might potentially have concurrency issues". If you are uncertain, say so once and move on.

## Length

A 5-line finding with `path:line` and a fix is worth more than a 50-line discussion. Stop when the finding is actionable.

## What the parent does with your output

The parent merges findings from multiple agents, dedups, ranks by severity across all of them, and presents a single consolidated list to the user. So:

- Do not number findings globally — the parent will renumber.
- Do not write a closing "Summary" — the parent will summarize.
- Do not address the user directly — write as if reporting to a senior reviewer who will relay.
