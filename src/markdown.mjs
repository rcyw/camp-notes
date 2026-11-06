/**
 * Minimal, safe Markdown renderer for note bodies.
 * Supports: headings, paragraphs, unordered lists, emphasis (bold/italic),
 * inline code, fenced + indented code blocks, blockquotes, links and images.
 * Output is HTML built from escaped text only — raw HTML in the source is
 * escaped, and links are restricted to safe URL schemes.
 */

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/\s/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function isSafeUrl(url) {
  const trimmed = String(url).trim();
  if (trimmed.startsWith("#")) return true; // relative fragment
  if (trimmed.startsWith("/")) return true; // relative path
  if (trimmed.startsWith("./") || trimmed.startsWith("../")) return true;
  try {
    const parsed = new URL(trimmed, "https://local.invalid");
    return SAFE_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}

// Link URL may contain balanced parentheses but not spaces.
const URL_PART = "[^\\s()]+(?:\\([^\\s()]*\\)[^\\s()]*)*";

const TOKEN_RE = new RegExp(
  `\\[([^\\]]*)\\]\\((${URL_PART})(?:\\s+"[^"]*")?\\)` +
    `|!\\[([^\\]]*)\\]\\((${URL_PART})\\)` +
    `|` +
    "`([^`]+)`|(\\*\\*|__)(.+?)\\6|(\\*|_)(.+?)\\8",
  "g",
);

/**
 * Render inline Markdown into escaped HTML. All literal text is escaped;
 * the only unescaped characters emitted are the tags we generate ourselves.
 */
function renderInline(text) {
  if (!text) return "";
  const src = String(text);
  let out = "";
  let last = 0;

  const re = new RegExp(TOKEN_RE.source, "g");
  let match;
  while ((match = re.exec(src)) !== null) {
    out += escapeHtml(src.slice(last, match.index));
    const full = match[0];
    const linkText = match[1];
    const linkUrl = match[2];
    const imgAlt = match[3];
    const imgUrl = match[4];
    const codeTxt = match[5];
    const boldTxt = match[7];
    const italicTxt = match[9];

    if (linkUrl !== undefined) {
      if (isSafeUrl(linkUrl)) {
        out += `<a href="${escapeAttr(linkUrl)}" target="_blank" rel="noopener noreferrer">${renderInline(linkText)}</a>`;
      } else {
        out += renderInline(linkText);
      }
    } else if (imgUrl !== undefined) {
      if (isSafeUrl(imgUrl)) {
        out += `<img src="${escapeAttr(imgUrl)}" alt="${renderInline(imgAlt)}">`;
      } else {
        out += renderInline(imgAlt);
      }
    } else if (codeTxt !== undefined) {
      out += `<code>${escapeHtml(codeTxt)}</code>`;
    } else if (boldTxt !== undefined) {
      out += `<strong>${renderInline(boldTxt)}</strong>`;
    } else if (italicTxt !== undefined) {
      out += `<em>${renderInline(italicTxt)}</em>`;
    } else {
      // Should not happen, but be safe.
      out += escapeHtml(full);
    }
    last = re.lastIndex;
  }
  out += escapeHtml(src.slice(last));
  return out;
}

/** Render a Markdown string to safe HTML. Never emits raw source HTML. */
export function renderMarkdown(markdown) {
  const src = String(markdown ?? "").replace(/\r\n?/g, "\n");
  const lines = src.split("\n");
  const html = [];
  let listOpen = false;
  let para = [];
  let inCode = false;
  let codeLines = [];
  let codeFence = "";

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${renderInline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Fenced code block
    const fence = trimmed.match(/^ {0,3}(```+|~~~+)/);
    if (fence) {
      const marker = fence[1][0];
      const len = fence[1].length;
      if (!inCode) {
        flushPara();
        closeList();
        inCode = true;
        codeFence = fence[1];
        codeLines = [];
        continue;
      }
      if (marker === codeFence[0] && len >= codeFence.length) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}\n</code></pre>`);
        inCode = false;
        codeLines = [];
        codeFence = "";
        continue;
      }
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Heading
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    // Unordered list
    const ul = trimmed.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${renderInline(ul[1])}</li>`);
      continue;
    }

    // Blockquote
    const quote = trimmed.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushPara();
      closeList();
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      continue;
    }

    // Indented code block (4+ spaces or tab, not list/quote)
    if (/^( {4}|\t)/.test(line)) {
      flushPara();
      closeList();
      html.push(`<pre><code>${escapeHtml(line.replace(/^( {4}|\t)/, ""))}\n</code></pre>`);
      continue;
    }

    // Blank line ends paragraph and (optionally) list
    if (line.trim() === "") {
      flushPara();
      closeList();
      continue;
    }

    // Plain paragraph line
    closeList();
    para.push(line);
  }

  flushPara();
  closeList();
  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}\n</code></pre>`);
  }
  return html.join("\n");
}
