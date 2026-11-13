# Release provenance

Camp Notes v0.1.0 was developed through real Camp Agent executions on a native
Linux Runner. A read-only Reviewer returned findings to the Developer. The
operator then exercised the app in real browsers and sent corrections back
through Camp Work.

- Agent source snapshot: `cb49c3db608265561b8d4bab3fa1b7b590f45a5a`.
- Final Camp Resource snapshot: `6417ac07d8028175145933010ccddef779604bdd`.
- Exported source ZIP SHA-256:
  `781d0fd867fdaaffbcb6d5bd4a96cafdcab0225df928f018e698f240ae01eed9`.

The snapshots are Camp Resource version identifiers. The only operator change
between them corrects the README's HTTP serving instructions. Application code
matches the browser-qualified Agent snapshot. The exact README was separately
approved and delivered through Camp as an operator self-review.

Validation before publication:

- 18 data-model and Markdown tests, plus the production build, passed in Camp.
- 64 behavioral browser cases passed across Chromium, Firefox, WebKit and a
  390 × 844 touch configuration.
- Four actual development-server HTTP checks passed, including malformed URLs
  and encoded path traversal.
- Browser qualification preserved the source fingerprint and reported no
  unhandled page errors, external requests or native prompt/confirm dialogs.

The GitHub Pages workflow, this provenance record and release packaging are
operator additions after export. GitHub Actions validates and deploys the Git
commit independently. The Notes app itself uses no model or remote service.

## v0.1.1 autosave patch

The implementation was produced through a real Camp Work item on Camp source
`4e29f45fd69e752b54b3ec4947c3cb3a90fc9010`. Notes Developer implemented the
candidate, handed it to the read-only Notes Reviewer, and addressed their
returned findings. The Runner checked and published exact source snapshot
`6e46d42a2ef99907b91133bfdfcbe1b73566fd9d`; Work then completed automatically.
The operator exported that immutable snapshot through Camp's archive API without
editing the application code, preserving this repository's GitHub workflow and
existing provenance.

This was not an intervention-free run: it used 66 real provider requests and
7 execution turns. Four operator recoveries adjusted the output limit or finite
allowances after execution stopped, always resuming retained files. The original
24-request ceiling was explicitly increased to 48, then 60, then 68; the final
turn ceiling was 7. No unknown model request was replayed or budget reset.

Independent operator checks after publication:

- The original immediate-reload data loss reproduced against unchanged v0.1.0.
- All 23 Node tests and the static build passed on the exported candidate.
- 24 actual-browser cases passed across Chromium, Firefox, WebKit and a Chromium
  touch viewport: immediate real reload, empty-text reload, synchronous pagehide
  and hidden-visibility flush, corrupt-payload preservation, and a denied initial
  storage read that performed no notes writes. Pagehide/visibility were also
  dispatched explicitly to inspect their synchronous behavior; these are not
  claims about an operating system killing a browser without lifecycle events.

The patch preserves the existing visual layout, storage schema and dependencies.
External GitHub publication and Pages deployment are operator actions, separate
from the Agents' implementation and the Runner's publication inside Camp.
