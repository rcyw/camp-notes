# Camp Notes v0.1.0

Build a useful, polished local-first web notes app for one person. The app will be released as open-source rcyw/camp-notes and hosted at https://rcyw.github.io/camp-notes/. The working project starts here in this Room.

## Product
- Responsive, keyboard-accessible English UI: a compact notes sidebar and an editor with a calm, coherent visual style. The Notes app can have its own contemporary style; Camp itself retains its Platinum style.
- Create and edit title and Markdown body, autosave in localStorage, retain notes/selection on reload, search titles and content, pin notes, archive/unarchive, and move to trash with a recovery path.
- Safe Markdown preview with headings, lists, emphasis, links and code. Escape user content; no raw HTML execution or unsafe URL schemes.
- JSON export and validated import; preserve existing notes on malformed data, confirm meaningful merge/replace consequences, avoid duplicate IDs/data loss. Empty and storage-error states must be actionable and calm.
- Useful shortcuts (new note, search), visible focus, mobile navigation with editor/back behavior. Avoid redundant labels, nested boxes and needless confirmations.
- No account, tracking, remote services, paid API, external font/CDN or runtime dependency. Notes stay on this browser; clearly distinguish local saving from a backup. No claim of cross-device sync or encryption.

## Implementation and checks
Use semantic HTML/CSS and modern browser ES modules with no npm dependencies, keeping installation/build simple. All asset URLs must work under the /camp-notes/ subpath. Organize source modules rather than placing everything in one file.
Include package.json (type module and version 0.1.0), index.html, styles, app modules, scripts/build.mjs, scripts/serve.mjs, tests/notes.test.mjs, README.md, LICENSE (MIT), and .gitignore. Build a self-contained dist/ directory; exclude generated artifacts from source.
Commands already configured in Camp:
1. node --test tests/notes.test.mjs
2. node scripts/build.mjs
Test actual store/import/export/search/archive/trash behavior and safe Markdown handling with Node's built-in test runner. Missing tests must fail, not report success with zero cases. Serve script must bind localhost by default.
README must describe npm test, npm run build, npm run dev, browser-local data/backup limitations, keyboard shortcuts, recovery and deployment. Do not claim any check passed or version published before it happened.

## Collaboration
Notes Developer implements the first complete app, runs its tests/build and hands off to Notes Reviewer with camp_handoff. Reviewer has read-only access: inspect code and tests for functional gaps, data loss, XSS, accessibility and narrow-screen usability, then hand concrete findings back to Notes Developer. Developer fixes the findings, re-runs checks and finishes with camp_finish and a concise summary plus important file paths. Do not finish from the read-only review turn.

The initial task has 6 turns and 24 model requests total. Prefer efficient batched reads/writes; leave room for review and fixes. Ask a person only for a consequential unresolved product decision, and propose a sensible default. Do not attempt GitHub access or deployment from the network-restricted workspace; the operator will export the exact approved version, verify in real browsers and publish the first release.
