import { describe, expect, it } from "vitest";
import { blocksToText } from "@tatakae/core";
import { NOTE_TITLE_MAX, noteFromText, paragraphsOf } from "./noteText";

describe("noteFromText", () => {
  it("returns null without words", () => {
    expect(noteFromText("")).toBeNull();
    expect(noteFromText("  \n \n")).toBeNull();
  });

  it("uses one line as the title with no body", () => {
    expect(noteFromText("  Kubernetes probes  ")).toEqual({ title: "Kubernetes probes", bodyJson: null });
  });

  it("skips leading blank lines and keeps the rest as the body", () => {
    const d = noteFromText("\n\nProbes\nliveness restarts\n\nreadiness gates traffic\n\n");
    expect(d?.title).toBe("Probes");
    expect(blocksToText(d?.bodyJson)).toBe("liveness restarts\nreadiness gates traffic");
  });

  it("handles Windows line endings", () => {
    const d = noteFromText("Title\r\nbody line");
    expect(d?.title).toBe("Title");
    expect(blocksToText(d?.bodyJson)).toBe("body line");
  });

  it("cuts a long first line at a word and moves the rest into the body", () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const d = noteFromText(words);
    expect(d).not.toBeNull();
    expect(d!.title.length).toBeLessThanOrEqual(NOTE_TITLE_MAX);
    expect(d!.title.endsWith(" ")).toBe(false);
    expect(`${d!.title} ${blocksToText(d!.bodyJson)}`).toBe(words);
  });

  it("hard-cuts a long line without spaces", () => {
    const d = noteFromText("x".repeat(400));
    expect(d!.title).toHaveLength(NOTE_TITLE_MAX);
    expect(blocksToText(d!.bodyJson)).toBe("x".repeat(100));
  });
});

describe("paragraphsOf", () => {
  it("drops blank lines and trims", () => {
    expect(paragraphsOf(" a \n\n b\n")).toEqual(["a", "b"]);
    expect(paragraphsOf("")).toEqual([]);
  });
});
