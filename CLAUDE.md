# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fetches a WebUntis timetable and writes it to an Emacs org-mode file (`data/timetable.org`),
with automatic subject tagging/filtering and a reproducible layer for manual edits made directly
in the file. All WebUntis auth/client/schema logic lives in the external
`@schnau/webuntis-api` package (Effect-based) — this repo is only the org-mode pipeline on top
of it.

## Commands

```
npm run timetable   # the only entry point: tsx src/timetable.ts
npm test            # vitest run
npx vitest run src/foo.test.ts   # single test file
```

Nix: `nix run .` (fetch once), `nix develop` (shell with node + emacs on PATH — `org-id-gen.ts`
shells out to `emacs --batch`, so it must be on PATH for a real run, though tests don't need it).

No build/lint script — `tsx` runs TypeScript directly, no separate type-check step exists.

## Architecture

`src/timetable.ts` is the single orchestrator; every other module is a pure(ish) function it
calls in sequence. The pipeline, in order:

1. **Capture manual edits** (`overrides.ts: captureManualEdits`) — diffs the *previous* run's
   `data/timetable.org` against `data/timetable-snapshot.json` (the exact text mechanically
   written last time) to detect human deletions/appended notes, folding them into
   `data/overrides.json` *before* anything is refetched.
2. **Fetch** (`pipeline.ts: resolveDateRange` + `loadEntries`) — resolves the current school
   year via `SchoolyearsClient`, clamps the start to today (past dates are never refetched), and
   pulls `TimetableEntry` list in `TimetableClient`-chunked (30-day), concurrent requests.
3. **Classify & build** (`pipeline.ts: classifyEntries` + `buildLessonItems`, using
   `webuntis-mapping.ts`) — maps raw entries to `LessonItem` (subject/teachers/room/notes
   extracted from WebUntis's position1-4 slots), tags cancelled lessons with the `CANCELED`
   keyword (WebUntis signals cancellation either by clearing all teacher positions or by
   `status === "CANCELLED"`), and merges split exam periods (`mergeAdjacentExams`) back into one
   entry.
4. **Automatic rules** (`rules.ts: applyAutomaticRules`) — config-driven (`data/rules.json`):
   drops entries matching `excludeSubjects`, tags the rest via `subjectTags` or a slugified
   fallback.
5. **Manual overrides** (`overrides.ts: applyOverrides`) — applies `data/overrides.json`
   (deletions, appended notes) captured in step 1.
6. **Org-id assignment** (`org-id-registry.ts` + `org-id-gen.ts`) — every lesson occurrence gets
   a stable org-id (real `org-id.el`-compatible ID via headless Emacs' `org-id-new`), persisted
   in `data/org-ids.json` so links/org-caldav stay stable across refetches.
7. **Write** (`org-format.ts`, `org-merge.ts`) — past entries (`pastEntriesText`) are preserved
   byte-for-byte from the previous file; only today-and-later entries are regenerated and
   rendered via `orgEntry`. The result is snapshotted (`snapshot.ts: saveSnapshot`) so the next
   run's capture step (1) has a clean baseline to diff against.

### Identity, not WebUntis IDs

`org-key.ts: entryKey` (`start|end|subject`) is the stable identity used everywhere a lesson
occurrence needs to be tracked across refetches (overrides, org-ids, snapshot diffing) — deliberately
not WebUntis's own entry ids, whose cross-fetch stability isn't guaranteed. `mergeAdjacentExams`
already treats start/end/subject as "the same lesson," so this mirrors that.

### The org file is parsed, not just generated

`org-parse.ts: parseOrgEntries` reads back the small, self-controlled org subset this repo
generates (blank-line-separated blocks, each with a `:UNTIS_KEY:` property) — intentionally not
a general org parser. Both `org-merge.ts` (what to keep verbatim) and `overrides.ts` (what a
human changed) depend on this narrow format staying exactly what `org-format.ts` emits.

### Data directory

Everything under `data/` is untracked, local state (see README.md's table) — `rules.json` is the
one hand-edited config file (copy from `rules.json.example`); `overrides.json`, `org-ids.json`,
and `timetable-snapshot.json` are machine-managed and should not be hand-edited; `timetable.org`
is the generated output meant to be opened in Emacs and *is* meant to be hand-edited (that's the
whole point of the overrides-capture mechanism).
