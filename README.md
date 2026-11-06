# Camp Notes

A focused, local-first web notes app for one person. Create, edit, search, pin,
archive, and recover notes — all stored in your own browser.

Camp Notes is released as open-source under the project name `rcyw/camp-notes`
and is prepared for hosting via GitHub Pages at
<https://rcyw.github.io/camp-notes/>.

## Features

- **Local-first**: notes are autosaved to `localStorage` in your browser. No
  account, tracking, remote services, paid API, external fonts, or CDN.
- **Markdown editor** with a safe preview: headings, lists, emphasis, links,
  and code. User content is escaped — no raw HTML execution or unsafe URL
  schemes.
- **Organize**: pin notes, archive/unarchive, move to trash and restore.
- **Search** titles and content with ranked results.
- **Backup**: JSON export and validated import (merge or replace with a
  preview of consequences). Malformed imports are rejected without touching
  your existing notes.
- **Keyboard & mobile friendly**: visible focus, responsive sidebar, and
  editor/back behavior on narrow screens.

## Data & backup limitations

- Notes are stored **only in this browser's localStorage**. Clearing site data
  or using a different browser/device will not carry your notes over.
- **Local saving is not a backup.** Use **Export** regularly to download a
  JSON file you can keep and re-import later.
- There is **no cross-device sync and no encryption**.

## Getting started

Requirements: a modern browser and Node.js (for the dev server, tests, and
build only — the app itself has no runtime dependencies).

```sh
npm test       # run the test suite
npm run build  # build the self-contained site into dist/
npm run dev    # serve locally at http://127.0.0.1:4173/
```

Run the dev server and visit `http://127.0.0.1:4173/`.
For deployment, serve the built `dist/` directory over HTTP(S) with a static
host. Asset paths also resolve under `/camp-notes/`.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl`/`Cmd` + `N` | New note |
| `Ctrl`/`Cmd` + `F` | Focus search |
| `Ctrl`/`Cmd` + `B` | Toggle notes sidebar |

(On Linux/Windows use `Ctrl`; on macOS use `Cmd`.)

## Recovery

- **Trash**: deleted notes move to Trash; open the Trash view and select a note,
  then press **Restore** to bring it back, or empty the trash by permanently
  deleting.
- **Storage errors**: if saving fails, a status message in the editor toolbar
  will tell you. Export your notes immediately to avoid losing changes.
- **Corrupt saved data**: if the app cannot read previously saved data, it
  leaves the invalid payload untouched and offers to download the raw JSON or
  reset to a fresh state — it never silently overwrites your data.

## Project layout

```
index.html          app shell
styles.css          styling
src/app.mjs         UI wiring & persistence
src/store.mjs       data model (CRUD, search, import/export)
src/markdown.mjs    safe Markdown renderer
scripts/build.mjs   build script
scripts/serve.mjs   local dev server
tests/notes.test.mjs  test suite
```

## Deployment

The site is prepared for GitHub Pages: `npm run build` produces a
self-contained `dist/` whose asset URLs resolve under the `/camp-notes/`
subpath. The operator exports the approved version, verifies it in real
browsers, and publishes the first release.

## License

MIT — see [LICENSE](LICENSE).
