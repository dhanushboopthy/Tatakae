// Turn what another app shared (text, a link, a page title) into one capture line (pure, tested).

export interface Shared {
  text?: string | null;
  webUrl?: string | null;
  meta?: { title?: string | null } | null;
}

const MAX = 1000;

/** "Title — text — link", dropping parts that repeat; null when nothing usable was shared. */
export function sharedText(s: Shared): string | null {
  const text = (s.text ?? "").trim();
  const url = (s.webUrl ?? "").trim();
  const title = (s.meta?.title ?? "").trim();
  const parts: string[] = [];
  if (title && !text.includes(title)) parts.push(title);
  if (text) parts.push(text);
  if (url && !text.includes(url)) parts.push(url);
  const out = parts.join(" — ").slice(0, MAX).trim();
  return out === "" ? null : out;
}
