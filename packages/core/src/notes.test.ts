import { describe, expect, it } from "vitest";
import { blocksToText, excerptOf, ftsQuery, normalizeTags, snippetAround, textToBlocks } from "./notes";

const doc = [
  { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Raft", styles: {} }], children: [] },
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Leader election uses ", styles: {} },
      { type: "link", href: "https://raft.github.io", content: [{ type: "text", text: "terms", styles: {} }] },
    ],
    children: [{ type: "bulletListItem", content: [{ type: "text", text: "nested point", styles: {} }], children: [] }],
  },
  { type: "table", content: { type: "tableContent", rows: [{ cells: [[{ type: "text", text: "a" }], [{ type: "text", text: "b" }]] }] } },
  { type: "image", props: { url: "/api/files/x" } },
];

describe("blocksToText", () => {
  it("reads headings, links, children and tables in order", () => {
    expect(blocksToText(doc)).toBe("Raft\nLeader election uses terms\nnested point\na b");
  });
  it("ignores junk", () => {
    expect(blocksToText(null)).toBe("");
    expect(blocksToText([1, "x", { content: 5 }])).toBe("");
  });
  it("round-trips textToBlocks", () => {
    expect(blocksToText(textToBlocks("one\n\ntwo"))).toBe("one\ntwo");
  });
});

describe("excerptOf", () => {
  it("keeps short text and cuts long text at a word", () => {
    expect(excerptOf(textToBlocks("short"))).toBe("short");
    const long = excerptOf(textToBlocks("word ".repeat(100)), 30);
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(31);
    expect(long).not.toMatch(/ …$/);
  });
});

describe("normalizeTags", () => {
  it("trims, drops #, lower-cases and dedupes", () => {
    expect(normalizeTags([" #DevOps", "devops", "k8s", "", "K8s "])).toEqual(["devops", "k8s"]);
  });
});

describe("ftsQuery", () => {
  it("quotes every word as a prefix term", () => {
    expect(ftsQuery("raft leader")).toBe('"raft"* "leader"*');
  });
  it("neutralises FTS syntax", () => {
    expect(ftsQuery('title:x OR "y" NEAR(z)')).toBe('"title"* "x"* "OR"* "y"* "NEAR"* "z"*');
  });
  it("returns null when nothing is searchable", () => {
    expect(ftsQuery(" -* ")).toBeNull();
  });
  it("keeps non-Latin words", () => {
    expect(ftsQuery("日本語 の")).toBe('"日本語"* "の"*');
  });
});

describe("snippetAround", () => {
  it("centres on the first match", () => {
    const text = `${"a ".repeat(50)}needle ${"b ".repeat(50)}`;
    const s = snippetAround(text, "needle", 10);
    expect(s).toContain("needle");
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
  });
  it("falls back to the start", () => {
    expect(snippetAround("hello world", "zzz")).toBe("hello world");
  });
});
