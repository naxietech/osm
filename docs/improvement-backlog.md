# Improvement Backlog

Known improvements that were deliberately deferred — not bugs being ignored, but work that was
judged smaller than its cost at the time, or that cannot be done until another module lands.

**Append only. Never renumber an existing entry** — entries are referenced by number from commit
messages and reviews. Mark one `RESOLVED` in place with the commit that closed it rather than
deleting it, so the reasoning stays readable.

---

## 1. Subjects list: the empty state cannot tell "no matches" from "no subjects"

**Found:** 2026-08-03, pre-push review of `osm-017-development-of-subject-module`
**Where:** `apps/web/src/pages/setup/subjects.page.tsx` — the `DataTable` `emptyMessage` prop

Searching for something that matches nothing shows "No subjects yet", the same message used when
the catalogue is genuinely empty. An admin could reasonably conclude there are no subjects and
start creating duplicates of ones that already exist.

The project already makes this distinction elsewhere — `checker-form.tsx` passes
`emptyMessage="No subjects match"` for its filtered picker.

**Fix:** `emptyMessage={needle ? 'No subjects match your search' : 'No subjects yet'}`, plus a test
for the zero-results case, which nothing currently covers.

---

## 2. Per-row action feedback is last-wins across concurrent mutations

**PARTLY RESOLVED** — fixed on the Subjects screen (`rowErrors`, keyed by subject id, rendered
under the row's name; covered by two tests that fail against the old shared-slot behaviour).
**Still open on `users-list.page.tsx`**, which was left alone as it belongs to another module.
Extracting the shared mechanism is still worth doing before a third list screen copies it.

**Found:** 2026-08-03, pre-push review of `osm-017-development-of-subject-module`
**Where:** `apps/web/src/pages/setup/subjects.page.tsx` and `apps/web/src/pages/users/users-list.page.tsx`

Both screens let several rows have an action in flight at once — that is exactly what their
`busyRowIds` sets exist to track — but success and failure are reported through a single shared
`notice` / `actionError` pair. If row A's request fails and row B's then succeeds, B's success
banner overwrites A's failure and the admin is left believing both worked. The only surviving
signal is the row's own badge, and nothing prompts anyone to check it.

**Fix:** attribute feedback per row (an inline row-level error, or a toast queue) rather than one
global "last mutation wins" slot. Worth doing once, in a shared place, since two screens already
have the problem and every future list screen will inherit it.

---

## 3. Nothing warns before deactivating a subject that is in use

**PARTLY RESOLVED** — the deactivate dialog now carries an explicit warning that usage cannot be
checked, and tells the admin to confirm the subject is not needed for a current or upcoming exam
cycle. What is still missing is the **count**, which needs real referencing data.

Note the correction below: the right behaviour here is **warn, not block**. Deactivating is the
only way to retire a subject, so refusing it while anything references one would mean a subject
can never be withdrawn once it has been used — the opposite of what is wanted. That is why this
does not copy institute-categories' 409-on-delete rule.

**Found:** 2026-08-03, pre-push review of `osm-017-development-of-subject-module`
**Where:** `apps/web/src/pages/setup/subjects.page.tsx`, `PATCH /subjects/:id/status`

The old mock screen had an "In use by" column and warned before deactivating a subject referenced
by curriculum entries, SLOs or exams. The rebuilt screen drops it deliberately: nothing in the
system references a subject yet, so any count would be a hard-coded zero — and a fake zero is
worse than no column, because it invites deactivating something that is genuinely in use.

**This is safe today and becomes a real gap the moment the curriculum module lands.** At that
point neither the API nor the UI has any guard on deactivation.

**Fix, when curriculum/SLO/exam-paper linking exists:** add a reference probe on the API side
(the `CategoryReferenceProbe` in `modules/institute-categories/ports.ts` is the pattern), expose
the count, and replace the dialog's "cannot check" warning with the real figure plus a usage
column. Do not add a count before there is something real to count — a confident `0` reads as a
check that was performed.
