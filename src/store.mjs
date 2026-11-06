/**
 * Camp Notes store: pure data model with no DOM dependency.
 * Notes are kept in a single ordered list. Each note has:
 *   id       — stable unique string
 *   title    — plain text title
 *   body     — Markdown body
 *   pinned   — boolean
 *   archived — boolean
 *   trashed  — boolean
 *   createdAt, updatedAt — epoch millis
 */

export const SCHEMA_VERSION = 1;

let counter = 0;

function uniqueId() {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const seq = (counter++).toString(36);
  return `n_${now}_${rand}_${seq}`;
}

export function createNote(fields = {}) {
  const now = Date.now();
  return {
    id: typeof fields.id === "string" && fields.id.length > 0 ? fields.id : uniqueId(),
    title: typeof fields.title === "string" ? fields.title : "",
    body: typeof fields.body === "string" ? fields.body : "",
    pinned: Boolean(fields.pinned),
    archived: Boolean(fields.archived),
    trashed: Boolean(fields.trashed),
    createdAt: typeof fields.createdAt === "number" ? fields.createdAt : now,
    updatedAt: typeof fields.updatedAt === "number" ? fields.updatedAt : now,
  };
}

/** Normalize an arbitrary value into a safe note, or null if not a usable note. */
function normalizeNote(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  // Required fields must be the correct type; malformed notes are rejected
  // rather than silently coerced.
  if (typeof raw.title !== "string") return null;
  if (typeof raw.body !== "string") return null;
  return {
    id: raw.id,
    title: raw.title,
    body: raw.body,
    pinned: raw.pinned === true,
    archived: raw.archived === true,
    trashed: raw.trashed === true,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
  };
}

export function isNoteShape(value) {
  return normalizeNote(value) !== null;
}

/**
 * Parse and validate an export payload. Returns { ok, notes, error }.
 * Never throws. Malformed data yields ok:false and leaves caller data intact.
 */
export function parseExport(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, notes: [], error: "Import data is empty." };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, notes: [], error: "Import data is not valid JSON." };
  }
  // Reject any non-object payload (null, numbers, strings, arrays, booleans)
  // and any backup that is not a Camp Notes v1 export.
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, notes: [], error: "Import data is not a Camp Notes backup." };
  }
  if (parsed.app !== "camp-notes") {
    return { ok: false, notes: [], error: "Import data is not a Camp Notes backup (unrecognized app)." };
  }
  if (parsed.version !== SCHEMA_VERSION) {
    return {
      ok: false,
      notes: [],
      error: `Unsupported backup version (expected ${SCHEMA_VERSION}, got ${JSON.stringify(parsed.version)}).`,
    };
  }
  if (!Array.isArray(parsed.notes)) {
    return { ok: false, notes: [], error: "Import data is missing a notes array." };
  }
  const seen = new Set();
  const notes = [];
  for (const raw of parsed.notes) {
    const note = normalizeNote(raw);
    if (!note) {
      return { ok: false, notes: [], error: "Import data contains an invalid note." };
    }
    if (seen.has(note.id)) {
      return { ok: false, notes: [], error: "Import data contains duplicate note IDs." };
    }
    seen.add(note.id);
    notes.push(note);
  }
  return { ok: true, notes, error: null };
}

/** Serialize notes to the JSON export format. */
export function toExport(notes) {
  return JSON.stringify(
    {
      app: "camp-notes",
      version: 1,
      exportedAt: new Date().toISOString(),
      notes: notes.map((n) => ({ ...n })),
    },
    null,
    2,
  );
}

/** Summary of how an imported set would combine with existing notes. */
export function previewMerge(existing, incoming) {
  const existingIds = new Set(existing.map((n) => n.id));
  const toAdd = incoming.filter((n) => !existingIds.has(n.id)).length;
  const toOverwrite = incoming.length - toAdd;
  return { toAdd, toOverwrite, total: incoming.length };
}

/**
 * Replace existing notes with incoming set. Options:
 *   mode: "replace" — discard existing notes entirely
 *   mode: "merge"   — keep existing notes, add new, overwrite by id
 */
export function applyImport(existing, incoming, mode = "merge") {
  if (mode === "replace") {
    return incoming.map((n) => ({ ...n }));
  }
  const byId = new Map(existing.map((n) => [n.id, { ...n }]));
  for (const n of incoming) {
    byId.set(n.id, { ...n });
  }
  // Preserve existing ordering; append only brand-new notes at the end.
  const existingIds = new Set(existing.map((n) => n.id));
  const merged = existing.map((n) => byId.get(n.id)).filter(Boolean);
  for (const n of incoming) {
    if (!existingIds.has(n.id)) {
      merged.push({ ...n });
    }
  }
  return merged;
}

const TITLE_RANK = 2;
const BODY_RANK = 1;

function titleMatches(note, term) {
  return note.title.toLowerCase().includes(term);
}
function bodyMatches(note, term) {
  return note.body.toLowerCase().includes(term);
}

/** Ranked text search across title and content. Returns scored matches. */
export function searchNotes(notes, query) {
  const term = typeof query === "string" ? query.trim().toLowerCase() : "";
  if (!term) return notes.map((n) => ({ note: n, score: 0 }));
  const out = [];
  for (const note of notes) {
    let score = 0;
    if (titleMatches(note, term)) score += TITLE_RANK;
    if (bodyMatches(note, term)) score += BODY_RANK;
    if (score > 0) out.push({ note, score });
  }
  out.sort((a, b) => b.score - a.score || a.note.updatedAt - b.note.updatedAt);
  return out;
}

/** Default note ordering for the sidebar: pinned first, then updated desc. */
export function orderForList(notes) {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export function isTrashEmpty(notes) {
  return !notes.some((n) => n.trashed);
}

/** Permanently remove notes, returning the surviving list. */
export function deleteForever(notes, ids) {
  const targets = new Set(ids);
  return notes.filter((n) => !targets.has(n.id));
}

/** Permanently remove every trashed note, returning the surviving list. */
export function emptyTrash(notes) {
  return notes.filter((n) => !n.trashed);
}
