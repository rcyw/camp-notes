/**
 * Note Markdown export: pure, DOM-free helpers so the exact download bytes and
 * filename rules can be tested under Node without a browser.
 */

// Windows-reserved characters and control characters are replaced so a title
// cannot produce a filename that is rejected or interpreted as a path.
const WINDOWS_UNSAFE = /[<>:"/\\|?*\u0000-\u001f]/g;

// Windows device names cannot be used as files even with an extension, so a
// title matching one (case-insensitive) is prefixed rather than left unsavable.
const RESERVED_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function isReservedBase(base) {
  return RESERVED_DEVICE.test(base.split(".", 1)[0]);
}

/** Clip a filename to a safe byte-ish length without splitting surrogate pairs. */
function clipToSafeLength(text, max = 60) {
  return Array.from(text).slice(0, max).join("");
}

/**
 * Derive a safe `.md` filename from a note title. Falls back to `untitled.md`
 * when the title is empty or contains only unsafe/trailing-dot characters, and
 * prefixes Windows reserved device names so they remain savable.
 */
export function filenameFromTitle(title) {
  const sanitized = clipToSafeLength(
    String(title ?? "")
      .replace(/\r\n|\r|\n/g, " ")
      .replace(WINDOWS_UNSAFE, "-")
      .trim()
      .replace(/[. ]+$/g, "")
      .replace(/\s+/g, " "),
  );
  const base = sanitized.length > 0 ? sanitized : "untitled";
  const safeBase = isReservedBase(base) ? `_${base}` : base;
  return `${safeBase}.md`;
}

/**
 * Prepare the selected note for download. `text` is the note body unchanged, so
 * encoding it as UTF-8 produces the authored bytes exactly — Unicode, blank
 * lines and trailing whitespace included.
 */
export function noteMarkdownExport(note) {
  const title = note && typeof note.title === "string" ? note.title : "";
  const text = note && typeof note.body === "string" ? note.body : "";
  return {
    filename: filenameFromTitle(title),
    text,
    mime: "text/markdown;charset=utf-8",
  };
}
