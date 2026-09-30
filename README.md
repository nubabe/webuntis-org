# webuntis-tomorrow

Fetches your WebUntis timetable and writes it to an Emacs org-mode file
(`data/timetable.org`), with automatic subject tagging/filtering and a
reproducible layer for manual edits you make directly in the file.

Built on [`@schnau/webuntis-api`](https://git.schnau.dev/schnau/webuntis-api) —
all the credit for talking to WebUntis (auth, the Effect-based client,
the typed schemas) goes there. This repo is just the org-mode pipeline
on top of it.

## Setup

```
npm install
cp .env.example .env   # fill in WEBUNTIS_SCHOOL_NAME / USERNAME / PASSWORD
```

## Usage

```
npm run timetable
```

Fetches from today through the end of the current school year and writes
`data/timetable.org`. Safe to run repeatedly (e.g. on a schedule) — see
[Behavior](#behavior) below for exactly what happens on each run.

## Behavior

- **Past entries are frozen.** Only today and later are ever (re)fetched;
  anything before today is preserved byte-for-byte from the last write,
  edits included.
- **Manual edits survive re-runs.** Delete a heading or append a note
  directly in `data/timetable.org`, and the next run detects the change
  (by diffing against `data/timetable-snapshot.json`) and records it in
  `data/overrides.json`, so it's reapplied every time that entry is
  regenerated.
- **Automatic tagging/filtering** is config, not code — see
  `data/rules.json`: `excludeSubjects` drops matching entries entirely,
  `subjectTags` maps a subject to an org tag (anything unmatched gets a
  slugified fallback tag).
- **Each entry gets a real org-id** (`data/org-ids.json`, generated via
  headless Emacs' `org-id-new`), stable across refetches — so it's a
  valid link target and compatible with tools like org-caldav.

## Data layout

| Path | What | Tracked? |
|---|---|---|
| `data/timetable.org` | generated output — open this in Emacs | no (regenerated) |
| `data/rules.json` | automatic tag/filter rules | yes |
| `data/overrides.json` | captured manual edits (deletions/notes) | yes |
| `data/org-ids.json` | per-entry org-id registry | yes |
| `data/timetable-snapshot.json` | internal diff baseline | no (regenerated) |

## Running on a schedule

A systemd user timer works well — `Persistent=true` catches up a missed
run after boot/wake, and `After=network-online.target` waits for
connectivity. See `~/.config/systemd/user/webuntis-timetable.{service,timer}`
for a working example.

## Tests

```
npm test
```
