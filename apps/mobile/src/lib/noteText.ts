import { textToBlocks } from "@tatakae/core";

// Capture → note (v3.3). Pure, so it is tested without React Native. The first line becomes the
// title (notes need one); the rest becomes the body, one paragraph per line.

export const NOTE_TITLE_MAX = 300;

export interface NoteDraft {
  title: string;
  bodyJson: unknown[] | null;
}

/** Title + BlockNote body from typed text, or null when there are no words. */
export function noteFromText(text: string): NoteDraft | null {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first < 0) return null;
  const line = lines[first]!.trim();
  let title = line;
  let overflow = "";
  if (line.length > NOTE_TITLE_MAX) {
    const cut = line.slice(0, NOTE_TITLE_MAX);
    const space = cut.lastIndexOf(" ");
    title = (space > NOTE_TITLE_MAX * 0.6 ? cut.slice(0, space) : cut).trimEnd();
    overflow = line.slice(title.length).trim();
  }
  const rest = [...(overflow ? [overflow] : []), ...lines.slice(first + 1)];
  while (rest.length > 0 && rest[0]!.trim() === "") rest.shift();
  while (rest.length > 0 && rest[rest.length - 1]!.trim() === "") rest.pop();
  return { title, bodyJson: rest.length > 0 ? textToBlocks(rest.join("\n")) : null };
}

/** Body paragraphs for the read-only view (blank lines dropped). */
export function paragraphsOf(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}
