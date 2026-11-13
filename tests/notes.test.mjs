import test from "node:test";
import assert from "node:assert/strict";

import {
  createNote,
  parseExport,
  toExport,
  previewMerge,
  applyImport,
  searchNotes,
  orderForList,
  isTrashEmpty,
  deleteForever,
  emptyTrash,
} from "../src/store.mjs";

import { escapeHtml, renderMarkdown } from "../src/markdown.mjs";
import { createAutosave } from "../src/autosave.mjs";

test("createNote assigns unique ids and defaults", () => {
  const a = createNote();
  const b = createNote();
  assert.notEqual(a.id, b.id);
  assert.equal(a.title, "");
  assert.equal(a.body, "");
  assert.equal(a.pinned, false);
  assert.equal(a.archived, false);
  assert.equal(a.trashed, false);
  assert.ok(a.createdAt > 0);
  assert.ok(a.updatedAt > 0);
});

test("parseExport round-trips notes", () => {
  const notes = [
    createNote({ title: "Hello", body: "# Hi", pinned: true }),
    createNote({ title: "World", body: "body text", archived: true }),
  ];
  const text = toExport(notes);
  const result = parseExport(text);
  assert.equal(result.ok, true);
  assert.equal(result.notes.length, 2);
  assert.equal(result.notes[0].title, "Hello");
  assert.equal(result.notes[0].pinned, true);
  assert.equal(result.notes[1].archived, true);
});

test("parseExport rejects malformed data without throwing", () => {
  for (const bad of [
    "",
    "not json",
    "null",
    "42",
    '"just a string"',
    "[]",
    "{}",
    '{"app":"other-app","version":1,"notes":[]}',
    '{"app":"camp-notes","version":2,"notes":[]}',
    '{"app":"camp-notes","version":1}',
    '{"app":"camp-notes","version":1,"notes":"nope"}',
    '{"app":"camp-notes","version":1,"notes":[{"no-id":true}]}',
    '{"app":"camp-notes","version":1,"notes":[{"id":"x","title":"t"}]}',
    '{"app":"camp-notes","version":1,"notes":[{"id":"x","title":1,"body":""}]}',
    '{"app":"camp-notes","version":1,"notes":[{"id":"x","title":"t","body":{}}]}',
  ]) {
    const result = parseExport(bad);
    assert.equal(result.ok, false);
    assert.ok(result.error.length > 0);
  }
});

test("parseExport rejects duplicate IDs", () => {
  const dup = JSON.stringify({
    app: "camp-notes",
    version: 1,
    notes: [
      { id: "a", title: "one", body: "" },
      { id: "a", title: "two", body: "" },
    ],
  });
  assert.equal(parseExport(dup).ok, false);
});

test("previewMerge reports adds and overwrites", () => {
  const existing = [createNote({ id: "a", title: "A" })];
  const incoming = [
    { id: "a", title: "A2", createdAt: 1, updatedAt: 1 },
    { id: "b", title: "B", createdAt: 2, updatedAt: 2 },
  ];
  const preview = previewMerge(existing, incoming);
  assert.equal(preview.toAdd, 1);
  assert.equal(preview.toOverwrite, 1);
});

test("applyImport merge keeps existing notes and overwrites by id", () => {
  const existing = [createNote({ id: "a", title: "A" })];
  const incoming = [
    { id: "a", title: "A2" },
    { id: "b", title: "B" },
  ];
  const merged = applyImport(existing, incoming, "merge");
  assert.equal(merged.length, 2);
  assert.equal(merged.find((n) => n.id === "a").title, "A2");
  assert.ok(merged.find((n) => n.id === "b"));
});

test("applyImport replace discards existing notes", () => {
  const existing = [createNote({ id: "a", title: "A" })];
  const incoming = [{ id: "b", title: "B" }];
  const merged = applyImport(existing, incoming, "replace");
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "b");
});

test("searchNotes finds title and content, ranked", () => {
  const notes = [
    createNote({ title: "apple", body: "nothing" }),
    createNote({ title: "plain", body: "contains apple inside" }),
    createNote({ title: "other", body: "other" }),
  ];
  const results = searchNotes(notes, "apple");
  assert.equal(results.length, 2);
  // Title match should rank above body-only match.
  assert.equal(results[0].note.title, "apple");
});

test("searchNotes searches trashed notes and empty query returns all", () => {
  const notes = [
    createNote({ title: "keep" }),
    createNote({ title: "gone", trashed: true }),
  ];
  assert.equal(searchNotes(notes, "gone").length, 1);
  assert.equal(searchNotes(notes, "").length, 2);
});

test("orderForList pins first then updated desc", () => {
  const a = createNote({ title: "a" });
  const b = createNote({ title: "b", pinned: true });
  a.updatedAt = 100;
  b.updatedAt = 50;
  const ordered = orderForList([a, b]);
  assert.equal(ordered[0].id, b.id);
  assert.equal(ordered[1].id, a.id);
});

test("isTrashEmpty reflects trashed state", () => {
  assert.equal(isTrashEmpty([]), true);
  assert.equal(isTrashEmpty([createNote()]), true);
  assert.equal(isTrashEmpty([createNote({ trashed: true })]), false);
});

test("deleteForever removes only the targeted notes", () => {
  const a = createNote({ id: "a" });
  const b = createNote({ id: "b", trashed: true });
  const c = createNote({ id: "c", trashed: true });
  const out = deleteForever([a, b, c], ["b"]);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((n) => n.id).sort(), ["a", "c"]);
});

test("emptyTrash removes only trashed notes", () => {
  const a = createNote({ id: "a" });
  const b = createNote({ id: "b", trashed: true });
  const c = createNote({ id: "c", trashed: true });
  const out = emptyTrash([a, b, c]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "a");
});

test("escapeHtml escapes all special characters", () => {
  assert.equal(
    escapeHtml(`<script>"&'</script>`),
    "&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;",
  );
});

test("renderMarkdown escapes raw HTML", () => {
  const out = renderMarkdown("<script>alert(1)</script>");
  assert.ok(!out.includes("<script>"));
  assert.ok(out.includes("&lt;script&gt;"));
});

test("renderMarkdown handles headings lists emphasis links code", () => {
  const out = renderMarkdown(
    "# Head\n\n- one\n- two\n\n**bold** and *italic* and [link](https://example.com)\n\n`code`",
  );
  assert.ok(out.includes("<h1>Head</h1>"));
  assert.ok(out.includes("<ul>"));
  assert.ok(out.includes("<li>one</li>"));
  assert.ok(out.includes("<strong>bold</strong>"));
  assert.ok(out.includes("<em>italic</em>"));
  assert.ok(out.includes('<a href="https://example.com"'));
  assert.ok(out.includes("<code>code</code>"));
});

test("renderMarkdown blocks unsafe URL schemes", () => {
  const out = renderMarkdown("[x](javascript:alert(1))");
  assert.ok(!out.includes("href"));
  assert.ok(!out.includes("javascript:"));
  assert.equal(out.trim(), "<p>x</p>");
});

test("renderMarkdown fenced code blocks", () => {
  const out = renderMarkdown("```js\nconst a = 1 < 2;\n```");
  assert.ok(out.includes("<pre><code>"));
  assert.ok(out.includes("&lt; 2"));
});

// ---------------------------------------------------------------- autosave

test("autosave flush synchronously writes a pending debounced edit", () => {
  let writes = 0;
  const autosave = createAutosave({
    write: () => { writes += 1; },
    delay: 400,
  });
  autosave.schedule();
  // The debounce timer has not fired yet, so nothing has been written…
  assert.equal(writes, 0);
  // …but a lifecycle flush (pagehide/visibilitychange→hidden) writes it now.
  autosave.flush();
  assert.equal(writes, 1);
  assert.equal(autosave.isPending(), false);
});

test("autosave flush writes the latest value, not a stale snapshot", () => {
  // The actual reported defect: type a change and reload before the debounce.
  // `current` is the mutable note state; `schedule()` happens on the first
  // keystroke, then the value keeps changing right up until the pagehide flush.
  // `write` must capture the *latest* value, not whatever existed at schedule().
  let current = { body: "first draft" };
  let written = null;
  const autosave = createAutosave({
    write: () => { written = JSON.parse(JSON.stringify(current)); },
    delay: 400,
  });
  autosave.schedule();
  assert.equal(written, null); // debounce has not fired yet
  // Further edits mutate the same object the writer will serialize.
  current.body = "latest edit before reload";
  autosave.flush();
  assert.equal(written.body, "latest edit before reload");
});

test("autosave flush with nothing pending still does not lose a write", () => {
  let writes = 0;
  const autosave = createAutosave({ write: () => { writes += 1; } });
  autosave.flush();
  assert.equal(writes, 1);
});

test("autosave never writes when the storage guard is blocked", () => {
  let writes = 0;
  const autosave = createAutosave({
    write: () => { writes += 1; },
    isBlocked: () => true, // corrupt payload / failed initial read
  });
  autosave.schedule();
  autosave.flush();
  assert.equal(writes, 0);
});

test("autosave writes once guard clears, and schedule coalesces rapid edits", async () => {
  let writes = 0;
  let blocked = true;
  const autosave = createAutosave({
    write: () => { writes += 1; },
    isBlocked: () => blocked,
    delay: 5,
  });
  // Blocked flush must not write.
  autosave.flush();
  assert.equal(writes, 0);

  // After recovery clears the guard, a normal schedule debounces and writes.
  blocked = false;
  autosave.schedule();
  autosave.schedule();
  autosave.schedule();
  assert.equal(writes, 0);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(writes, 1);
});
