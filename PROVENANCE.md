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
