# webuntis-org

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
cp .env.example .env               # fill in WEBUNTIS_SCHOOL_NAME / USERNAME / PASSWORD
cp data/rules.json.example data/rules.json   # edit to match your own subjects
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

Everything in `data/` is local, personal state — none of it is tracked in
git (it would otherwise leak your subjects, schedule, and any notes you
add straight into the repo).

| Path | What | Tracked? |
|---|---|---|
| `data/timetable.org` | generated output — open this in Emacs | no (regenerated) |
| `data/rules.json` | automatic tag/filter rules, hand-edited | no — copy from `.example` |
| `data/overrides.json` | captured manual edits, machine-managed | no (created on first run) |
| `data/org-ids.json` | per-entry org-id registry, machine-managed | no (created on first run) |
| `data/timetable-snapshot.json` | internal diff baseline | no (regenerated) |

## Running on a schedule

A systemd user timer works well — `Persistent=true` catches up a missed
run after boot/wake, and `After=network-online.target` waits for
connectivity. `npm run timetable` is safe to run on any schedule; it's
the only entry point and never truncates what's already been fetched.

`~/.config/systemd/user/webuntis-timetable.service`:

```ini
[Unit]
Description=Fetch WebUntis timetable and update timetable.org
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/path/to/webuntis-org
Environment=PATH=/usr/bin:/bin
ExecStart=/usr/bin/npm run timetable
```

`~/.config/systemd/user/webuntis-timetable.timer`:

```ini
[Unit]
Description=Run webuntis-timetable.service every few hours during the day

[Timer]
OnCalendar=*-*-* 06,10,14,18:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable with:

```
systemctl --user daemon-reload
systemctl --user enable --now webuntis-timetable.timer
```

If you want it to run even before you log in (e.g. right after boot),
also enable lingering: `loginctl enable-linger $USER`.

## Tests

```
npm test
```
