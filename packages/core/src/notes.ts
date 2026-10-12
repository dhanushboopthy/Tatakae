// Notes helpers (v3). BlockNote documents are arrays of blocks:
//   { type, props?, content?: InlineContent[] | TableContent, children?: Block[] }
// Inline content is { type: "text", text } or { type: "link", content: InlineContent[] }.
// These helpers only read that shape loosely (the editor owns the full model), so unknown block
// types still contribute their text.

/** One paragraph block per line (inbox → note, markdown-less imports). */
export function textToBlocks(text: string): unknown[] {
  return text.split(/\r?\n/).map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line, styles: {} }] : [],
  }));
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function inlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(inlineText).join("");
  if (!isRecord(content)) return "";
  if (typeof content["text"] === "string") return content["text"];
  // links nest their text; tables keep rows → cells
  if (content["content"] !== undefined) return inlineText(content["content"]);
  if (Array.isArray(content["rows"])) {
    return content["rows"]
      .map((r) => (isRecord(r) && Array.isArray(r["cells"]) ? r["cells"].map(inlineText).join(" ") : ""))
      .join("\n");
  }
  return "";
}

/** Plain text of a BlockNote document: one line per block, children indented in order. */
export function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const lines: string[] = [];
  const walk = (list: unknown[]) => {
    for (const b of list) {
      if (!isRecord(b)) continue;
      const line = inlineText(b["content"]).trim();
      if (line) lines.push(line);
      if (Array.isArray(b["children"])) walk(b["children"]);
    }
  };
  walk(blocks);
  return lines.join("\n");
}

/** First `max` characters of the note's text on one line, cut at a word boundary. */
export function excerptOf(blocks: unknown, max = 160): string {
  const flat = blocksToText(blocks).replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Trimmed, lower-cased, de-duplicated tags (order kept). */
export function normalizeTags(tags: readonly string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const v = t.trim().replace(/^#/, "").toLowerCase();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Safe FTS5 MATCH expression from free text: every word becomes a quoted prefix term, so user
 * input can never be parsed as FTS syntax (AND/OR/NEAR, column filters, stray quotes).
 * Returns null when nothing searchable is left.
 */
export function ftsQuery(input: string): string | null {
  const words = input
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(Boolean)
    .slice(0, 12);
  if (words.length === 0) return null;
  return words.map((w) => `"${w}"*`).join(" ");
}

/** A short snippet of `text` around the first matching word, with the match kept intact. */
export function snippetAround(text: string, query: string, radius = 60): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const words = query.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  const lower = flat.toLowerCase();
  let at = -1;
  for (const w of words) {
    const i = lower.indexOf(w);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return flat.slice(0, radius * 2) + (flat.length > radius * 2 ? "…" : "");
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}
