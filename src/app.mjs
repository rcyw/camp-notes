/**
 * Camp Notes app shell: wires the store + markdown modules to the DOM,
 * manages localStorage persistence, search, pin/archive/trash, and import/export.
 */

import {
  SCHEMA_VERSION,
  createNote,
  parseExport,
  toExport,
  previewMerge,
  applyImport,
  searchNotes,
  orderForList,
  deleteForever,
  emptyTrash,
} from "./store.mjs";
import { renderMarkdown } from "./markdown.mjs";
import { createAutosave } from "./autosave.mjs";

const STORAGE_KEY = "camp-notes.v1";

const state = {
  notes: [],
  selectedId: null,
  view: "notes",
  query: "",
  searchOpen: false,
  mode: "edit",
  corrupt: false,
  corruptRaw: "",
};

// ---------------------------------------------------------------- DOM refs
const $ = (id) => document.getElementById(id);
const app = $("app");
const noteList = $("note-list");
const sidebar = $("sidebar");
const sidebarToggle = $("sidebar-toggle");
const searchToggle = $("search-toggle");
const searchRow = $("search-row");
const searchInput = $("search-input");
const newNoteBtn = $("new-note-btn");
const emptyNewBtn = $("empty-new-btn");
const emptyState = $("empty-state");
const editor = $("editor");
const titleInput = $("note-title");
const bodyInput = $("note-body");
const previewEl = $("preview");
const savedStatus = $("saved-status");
const pinBtn = $("pin-btn");
const archiveBtn = $("archive-btn");
const trashBtn = $("trash-btn");
const exportBtn = $("export-btn");
const importBtn = $("import-btn");
const importFile = $("import-file");
const emptyTrashBtn = $("empty-trash-btn");
const dialog = $("dialog");
const dialogTitle = $("dialog-title");
const dialogBody = $("dialog-body");
const dialogActions = $("dialog-actions");
const storageError = $("storage-error");
const storageErrorText = $("storage-error-text");
const storageErrorDismiss = $("storage-error-dismiss");
const storageErrorExport = $("storage-error-export");

// ---------------------------------------------------------------- storage
let storageAvailable = true;
// Set when the *initial* payload read throws: the stored data is unknown, so
// we must not write over it (a successful setItem does NOT prove the read
// succeeded). Cleared only by a safe reload or an explicit recovery action.
let readFailed = false;

function storageUnavailable(message) {
  if (storageAvailable !== false || message) {
    storageAvailable = false;
    storageErrorText.textContent =
      message ||
      "Storage is unavailable — changes cannot be saved. Export your notes immediately to avoid losing work.";
    storageError.hidden = false;
  }
}

function storageRecovered() {
  if (!storageAvailable) {
    storageAvailable = true;
    storageError.hidden = true;
  }
}

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    storageUnavailable();
    return null;
  }
}

function load() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // A failed initial READ means the stored payload is unknown. We must not
    // write to it and risk overwriting existing notes. Block writes until a
    // safe reload or explicit recovery. In-memory changes remain exportable.
    readFailed = true;
    storageUnavailable(
      "Your saved notes could not be read. They have been left untouched. " +
        "Export current notes or reload to retry — changes will not be saved until reading succeeds.",
    );
    return;
  }
  // Empty/absent payload means a fresh start — not corruption.
  if (raw == null || raw.trim() === "") return;
  const result = parseExport(raw);
  if (result.ok) {
    state.notes = result.notes;
    // Restore the view first so selection validation is scoped correctly.
    const savedView = safeGetItem("camp-notes.view");
    if (savedView === "notes" || savedView === "archive" || savedView === "trash") {
      state.view = savedView;
    }
    const lastSelected = safeGetItem("camp-notes.selection");
    if (lastSelected) {
      const note = noteById(lastSelected);
      // Only keep the selection if that note exists and belongs to the restored
      // view. Guard the null note BEFORE comparing ids so a stale/deleted saved
      // selection never throws and falls back to the first visible note below.
      if (note && visibleNotes().some((n) => n.id === note.id)) {
        state.selectedId = lastSelected;
      }
    }
  } else {
    // Any non-empty payload that fails validation (invalid JSON, null/number/
    // array, wrong app/version, malformed notes) is treated as corrupt and
    // never silently overwritten.
    state.corrupt = true;
    state.corruptRaw = raw;
  }
}

/**
 * Raw localStorage write + status. Guarding is handled by the autosave
 * instance's `isBlocked` predicate so every write path (debounced timer,
 * lifecycle flush, and direct writes) enforces the never-overwrite rule in one
 * place.
 */
function persistNow() {
  const payload = { app: "camp-notes", version: SCHEMA_VERSION, notes: state.notes };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem("camp-notes.selection", state.selectedId ?? "");
    try {
      localStorage.setItem("camp-notes.view", state.view ?? "notes");
    } catch {
      // View metadata is non-critical; ignore a failure here.
    }
    storageRecovered();
    savedStatus.textContent = "Saved";
    savedStatus.removeAttribute("role");
  } catch {
    storageUnavailable();
    savedStatus.textContent = "Storage error — changes not saved";
    savedStatus.setAttribute("role", "alert");
  }
}

/**
 * Never overwrite an unreadable saved payload — even after the recovery dialog
 * is dismissed — until the user explicitly resets. Reports the blocked state to
 * the user via the status label and returns true so the autosave skips the write.
 */
function saveBlocked() {
  if (state.corrupt) {
    savedStatus.textContent = "Recovery needed — changes are not being saved";
    savedStatus.setAttribute("role", "alert");
    return true;
  }
  if (readFailed) {
    savedStatus.textContent = "Storage read failed — changes are not being saved";
    savedStatus.setAttribute("role", "alert");
    return true;
  }
  return false;
}

const autosave = createAutosave({
  write: persistNow,
  isBlocked: saveBlocked,
  onStatus: (status) => {
    if (status === "saving") savedStatus.textContent = "Saving…";
  },
});

function scheduleSave() {
  autosave.schedule();
}

/**
 * Synchronously flush any pending (debounced) edits to storage. Called on
 * `pagehide` and `visibilitychange`→hidden so a fast reload/tab-switch never
 * loses the latest keystroke. Pending text changes already live in
 * `state.notes`, and the blocked-write guard still applies.
 */
function flushPendingSave() {
  autosave.flush();
}

// ---------------------------------------------------------------- helpers
function snippet(note) {
  const text = note.body.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 90) : "";
}

function visibleNotes() {
  let notes;
  if (state.view === "archive") notes = state.notes.filter((n) => n.archived && !n.trashed);
  else if (state.view === "trash") notes = state.notes.filter((n) => n.trashed);
  else notes = state.notes.filter((n) => !n.archived && !n.trashed);
  if (state.query.trim()) {
    return searchNotes(notes, state.query).map((r) => r.note);
  }
  return orderForList(notes);
}

function noteById(id) {
  return state.notes.find((n) => n.id === id) ?? null;
}

function selectNote(id, { focusTitle = false } = {}) {
  state.selectedId = id;
  renderList();
  renderEditor();
  // Persist the selection so a reload restores the same open note. This writes
  // to a separate key (never the notes payload), but it still respects the
  // never-overwrite guard so that a corrupt/unreadable payload is left untouched
  // on every write path. When blocked, saveBlocked() also surfaces the status.
  if (storageAvailable && !saveBlocked()) {
    try {
      localStorage.setItem("camp-notes.selection", id ?? "");
    } catch {
      storageUnavailable();
    }
  }
  if (focusTitle) titleInput.focus();
}

// ---------------------------------------------------------------- rendering
function renderList() {
  noteList.textContent = "";
  const notes = visibleNotes();

  if (notes.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-list";
    li.textContent =
      state.view === "trash"
        ? "Trash is empty."
        : state.view === "archive"
          ? "No archived notes."
          : state.query.trim()
            ? "No notes match your search."
            : "No notes yet.";
    noteList.appendChild(li);
    return;
  }

  for (const note of notes) {
    const li = document.createElement("li");
    li.className = "note-item";
    li.setAttribute("aria-current", note.id === state.selectedId ? "true" : "false");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "note-item-btn" + (note.id === state.selectedId ? " selected" : "");
    btn.setAttribute("aria-pressed", note.id === state.selectedId ? "true" : "false");

    const title = document.createElement("span");
    title.className = "note-item-title" + (note.pinned ? " pinned-title" : "") + (note.title.trim() ? "" : " empty-title");
    title.textContent = note.title.trim() || "Untitled";

    const snip = document.createElement("span");
    snip.className = "note-item-snippet";
    snip.textContent = snippet(note);

    btn.appendChild(title);
    btn.appendChild(snip);
    btn.addEventListener("click", () => selectNote(note.id));
    li.appendChild(btn);
    noteList.appendChild(li);
  }
}

function renderEditor() {
  const note = noteById(state.selectedId);
  if (!note) {
    editor.hidden = true;
    emptyState.hidden = false;
    renderEmptyState();
    return;
  }
  editor.hidden = false;
  emptyState.hidden = true;

  titleInput.value = note.title;
  bodyInput.value = note.body;
  pinBtn.setAttribute("aria-pressed", String(note.pinned));
  pinBtn.setAttribute("aria-label", note.pinned ? "Unpin note" : "Pin note");
  pinBtn.title = note.pinned ? "Unpin note" : "Pin note";
  archiveBtn.textContent = note.trashed ? "Restore" : note.archived ? "Unarchive" : "Archive";
  trashBtn.textContent = note.trashed ? "Delete forever" : "Trash";
  archiveBtn.hidden = false;
  renderPreview();
}

function renderEmptyState() {
  const heading = $("empty-state-title");
  const text = $("empty-state-text");
  if (state.view === "trash") {
    heading.textContent = "Trash is empty";
    text.textContent = "Notes you trash will appear here so you can restore or permanently delete them.";
  } else if (state.view === "archive") {
    heading.textContent = "No archived notes";
    text.textContent = "Archive notes to tuck them out of the way without deleting them.";
  } else if (state.query.trim()) {
    heading.textContent = "No matching notes";
    text.textContent = "Try a different search.";
  } else {
    heading.textContent = "Welcome to Camp Notes";
    text.textContent = "Your notes are stored only in this browser. Create a note to get started.";
  }
}

function renderPreview() {
  const note = noteById(state.selectedId);
  previewEl.innerHTML = note ? renderMarkdown(note.body) : "";
  const editing = state.mode === "edit";
  bodyInput.hidden = !editing;
  previewEl.hidden = editing;
  document.querySelectorAll(".mode-tab").forEach((t) => {
    t.setAttribute("aria-pressed", t.dataset.mode === state.mode ? "true" : "false");
  });
}

function renderViewTabs() {
  document.querySelectorAll(".view-tab").forEach((t) => {
    t.setAttribute("aria-pressed", t.dataset.view === state.view ? "true" : "false");
  });
  emptyTrashBtn.hidden = state.view !== "trash";
}

function renderSearch() {
  searchRow.hidden = false;
}

// ---------------------------------------------------------------- dialog
let dialogReturnFocus = null;

function openConfirm(title, body, actions) {
  dialogTitle.textContent = title;
  dialogBody.textContent = body;
  dialogActions.textContent = "";
  const btnFor = (action) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn" + (action.danger ? " btn-ghost btn-danger" : " btn-primary");
    b.textContent = action.label;
    b.addEventListener("click", () => {
      closeDialog();
      if (action.onSelect) action.onSelect();
    });
    return b;
  };
  for (const action of actions) dialogActions.appendChild(btnFor(action));

  // Remember where focus was so we can return it on close.
  dialogReturnFocus = document.activeElement;
  // Make the background app inert while the dialog is open. The modal itself
  // lives outside #app, so it stays interactive.
  app.inert = true;
  dialog.hidden = false;
  const focusable = dialogActions.querySelectorAll("button");
  if (focusable.length) focusable[focusable.length - 1].focus();
}

function closeDialog() {
  dialog.hidden = true;
  dialogTitle.textContent = "";
  dialogBody.textContent = "";
  dialogActions.textContent = "";
  app.inert = false;
  const target = dialogReturnFocus instanceof HTMLElement ? dialogReturnFocus : null;
  dialogReturnFocus = null;
  if (target && document.contains(target)) target.focus();
}

// Close the dialog when clicking the backdrop (outside the dialog box).
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) closeDialog();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !dialog.hidden) {
    e.preventDefault();
    closeDialog();
  }
});
// Keep focus within the dialog (simple trap).
dialog.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const focusables = Array.from(dialogActions.querySelectorAll("button")).filter((b) => b.offsetParent !== null);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

// ---------------------------------------------------------------- trash actions
function deleteSelectedForever() {
  const note = noteById(state.selectedId);
  if (!note || !note.trashed) return;
  openConfirm(
    "Delete forever?",
    `"${note.title.trim() || "Untitled"}" will be permanently deleted. This cannot be undone.`,
    [
      { label: "Delete forever", danger: true, onSelect: () => {
        state.notes = deleteForever(state.notes, [note.id]);
        state.selectedId = null;
        const first = visibleNotes()[0];
        if (first) state.selectedId = first.id;
        scheduleSave();
        renderAll();
        renderEditor();
      } },
      { label: "Cancel", onSelect: closeDialog },
    ],
  );
}

function emptyTrashConfirm() {
  if (state.notes.every((n) => !n.trashed)) {
    closeDialog();
    return;
  }
  const count = state.notes.filter((n) => n.trashed).length;
  openConfirm(
    "Empty trash?",
    `${count} note${count === 1 ? "" : "s"} will be permanently deleted. This cannot be undone.`,
    [
      { label: "Empty trash", danger: true, onSelect: () => {
        state.notes = emptyTrash(state.notes);
        state.selectedId = null;
        scheduleSave();
        renderAll();
        renderEditor();
      } },
      { label: "Cancel", onSelect: closeDialog },
    ],
  );
}

// ---------------------------------------------------------------- note actions
function createNewNote() {
  const note = createNote();
  state.notes.push(note);
  state.selectedId = note.id;
  state.view = "notes";
  state.query = "";
  searchInput.value = "";
  renderAll();
  renderEditor();
  scheduleSave();
  titleInput.focus();
  if (isMobile()) setSidebarOpen(false);
}

function updateSelected(patch) {
  const note = noteById(state.selectedId);
  if (!note) return;
  Object.assign(note, patch, { updatedAt: Date.now() });
  scheduleSave();
  renderList();
}

function pinSelected() {
  const note = noteById(state.selectedId);
  if (!note) return;
  updateSelected({ pinned: !note.pinned });
  // Keep the button state in sync without re-rendering the editor (which would
  // reset the body/title caret).
  const pinned = note.pinned;
  pinBtn.setAttribute("aria-pressed", String(pinned));
  pinBtn.setAttribute("aria-label", pinned ? "Unpin note" : "Pin note");
  pinBtn.title = pinned ? "Unpin note" : "Pin note";
}

function toggleArchive() {
  const note = noteById(state.selectedId);
  if (!note) return;
  if (note.trashed) {
    // Restore from trash back to the notes view.
    updateSelected({ trashed: false, archived: false });
    state.view = "notes";
    renderAll();
    renderEditor();
    autosave.flush();
    return;
  }
  updateSelected({ archived: !note.archived });
  // If the note left the current view's scope (archived under Notes, or
  // unarchived under Archive), reconcile selection to the next visible note.
  const stillVisible = visibleNotes().some((n) => n.id === note.id);
  if (!stillVisible) {
    const remaining = visibleNotes();
    state.selectedId = remaining.length ? remaining[0].id : null;
  }
  renderList();
  renderEditor();
}

function trashSelected() {
  const note = noteById(state.selectedId);
  if (!note) return;
  updateSelected({ trashed: true, archived: false });
  const remaining = visibleNotes();
  state.selectedId = remaining.length ? remaining[0].id : null;
  renderList();
  renderEditor();
}

// ---------------------------------------------------------------- import/export
function doExport() {
  const data = toExport(state.notes);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `camp-notes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const result = parseExport(String(reader.result));
    if (!result.ok) {
      openConfirm("Import failed", result.error, [
        { label: "OK", onSelect: closeDialog },
      ]);
      importFile.value = "";
      return;
    }
    const preview = previewMerge(state.notes, result.notes);
    const currentCount = state.notes.length;
    const lines = [];
    lines.push(
      preview.toAdd > 0
        ? `${preview.toAdd} new note${preview.toAdd === 1 ? "" : "s"} will be added.`
        : `No new notes will be added.`,
    );
    if (preview.toOverwrite > 0) {
      lines.push(
        `${preview.toOverwrite} existing note${preview.toOverwrite === 1 ? "" : "s"} will be overwritten.`,
      );
    }
    if (currentCount > 0) {
      lines.push(
        `Replace all will remove ${currentCount} existing note${currentCount === 1 ? "" : "s"} before importing ${preview.total} note${preview.total === 1 ? "" : "s"}.`,
      );
    }
    const detail = lines.join(" ");
    openConfirm("Import notes", detail, [
      { label: "Merge", onSelect: () => {
        state.notes = applyImport(state.notes, result.notes, "merge");
        finishImport();
      } },
      ...(currentCount > 0
        ? [{ label: "Replace all", danger: true, onSelect: () => {
            state.notes = applyImport(state.notes, result.notes, "replace");
            finishImport();
          } }]
        : []),
      { label: "Cancel", onSelect: closeDialog },
    ]);
    importFile.value = "";
  };
  reader.onerror = () => {
    openConfirm("Import failed", "The file could not be read.", [
      { label: "OK", onSelect: closeDialog },
    ]);
    importFile.value = "";
  };
  reader.readAsText(file);
}

function finishImport() {
  state.selectedId = state.notes[0]?.id ?? null;
  state.view = "notes";
  scheduleSave();
  renderAll();
  renderEditor();
}

function exportRawString(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Handle an unreadable/invalid saved payload without silently overwriting it. */
function showCorruptRecovery() {
  openConfirm(
    "Saved data could not be read",
    "Your saved notes could not be parsed. They have been left untouched. " +
      "Download the raw data to recover it later, or reset to start fresh.",
    [
      { label: "Download raw data", onSelect: () => {
        exportRawString("camp-notes-corrupt.json", state.corruptRaw || "{}");
        showCorruptRecovery();
      } },
      { label: "Reset", danger: true, onSelect: () => {
        state.notes = [];
        state.selectedId = null;
        state.corrupt = false;
        // Explicitly overwrite the invalid payload with a valid empty one.
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ app: "camp-notes", version: SCHEMA_VERSION, notes: [] }));
          localStorage.setItem("camp-notes.selection", "");
        } catch {
          storageUnavailable();
        }
        renderAll();
        renderEditor();
      } },
      { label: "Close", onSelect: closeDialog },
    ],
  );
}

// ---------------------------------------------------------------- render all
function renderAll() {
  renderList();
  renderViewTabs();
  renderSearch();
}

// ---------------------------------------------------------------- events
emptyTrashBtn.addEventListener("click", emptyTrashConfirm);
storageErrorDismiss.addEventListener("click", () => {
  storageError.hidden = true;
});
storageErrorExport.addEventListener("click", doExport);

newNoteBtn.addEventListener("click", createNewNote);
emptyNewBtn.addEventListener("click", createNewNote);
pinBtn.addEventListener("click", pinSelected);
archiveBtn.addEventListener("click", toggleArchive);
trashBtn.addEventListener("click", () => {
  const note = noteById(state.selectedId);
  if (note && note.trashed) deleteSelectedForever();
  else trashSelected();
});
exportBtn.addEventListener("click", doExport);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  if (importFile.files && importFile.files[0]) handleImportFile(importFile.files[0]);
});

titleInput.addEventListener("input", () => updateSelected({ title: titleInput.value }));
bodyInput.addEventListener("input", () => updateSelected({ body: bodyInput.value }));
titleInput.addEventListener("blur", () => autosave.flush());
bodyInput.addEventListener("blur", () => autosave.flush());

document.querySelectorAll(".view-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.view = tab.dataset.view;
    state.selectedId = null;
    const first = visibleNotes()[0];
    if (first) state.selectedId = first.id;
    renderAll();
    renderEditor();
    autosave.flush();
  });
});

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.mode = tab.dataset.mode;
    renderPreview();
  });
});

function isMobile() {
  return window.innerWidth <= 720;
}

// Keep sidebar inert state coherent when the viewport crosses the breakpoint.
window.addEventListener("resize", () => {
  if (isMobile()) {
    document.body.classList.remove("sidebar-collapsed");
    sidebar.inert = !sidebar.classList.contains("open");
  } else {
    sidebar.inert = false;
  }
});

function setSidebarOpen(open) {
  sidebar.classList.toggle("open", open);
  if (isMobile()) {
    // On mobile the closed sidebar is off-screen; mark it inert so its
    // (offscreen) keyboard controls are not reachable via Tab.
    sidebar.inert = !open;
  } else {
    // On desktop, collapse the sidebar into a narrow rail when closed.
    document.body.classList.toggle("sidebar-collapsed", !open);
  }
}

function openSearch() {
  state.searchOpen = true;
  setSidebarOpen(true);
  renderSearch();
  searchInput.focus();
}

sidebarToggle.addEventListener("click", () => setSidebarOpen(!sidebar.classList.contains("open")));
searchToggle.addEventListener("click", openSearch);
searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderList();
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  // While the modal is open, block global shortcuts that mutate/create so a
  // keypress cannot change the app behind the dialog.
  if (!dialog.hidden) return;
  const key = e.key.toLowerCase();
  if (key === "n") {
    e.preventDefault();
    createNewNote();
  } else if (key === "f") {
    e.preventDefault();
    openSearch();
  } else if (key === "b") {
    e.preventDefault();
    setSidebarOpen(!sidebar.classList.contains("open"));
  }
});

// Close mobile sidebar when a note is selected.
noteList.addEventListener("click", () => {
  if (isMobile()) setSidebarOpen(false);
});

// ---------------------------------------------------------------- lifecycle flush
// Flush pending debounced edits synchronously before the page is unloaded or
// hidden so a fast reload/tab-switch never loses the latest keystroke. Using
// pagehide (covers reload and navigation) plus the visibilitychange→hidden
// path (covers bfcache-free backgrounding) that are reliable for sync writes
// to localStorage.
window.addEventListener("pagehide", flushPendingSave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPendingSave();
});

// ---------------------------------------------------------------- boot
load();
app.hidden = false;

// Ensure a selection exists if possible (only when data is valid).
if (!state.corrupt && !noteById(state.selectedId)) {
  const first = visibleNotes()[0];
  state.selectedId = first ? first.id : null;
}
renderAll();
renderEditor();

// Initialize sidebar/dialog inert state for the current viewport so
// off-screen mobile controls are not reachable before any toggle.
if (isMobile()) {
  sidebar.inert = !sidebar.classList.contains("open");
} else {
  sidebar.inert = false;
}

if (state.corrupt) {
  showCorruptRecovery();
}
