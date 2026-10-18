import { describe, expect, it } from "vitest";
import { sharedText } from "./shareText";

describe("sharedText", () => {
  it.each([
    [{ text: "Read this later" }, "Read this later"],
    [{ text: "Look: https://ex.com/a", webUrl: "https://ex.com/a" }, "Look: https://ex.com/a"],
    [{ text: "", webUrl: "https://ex.com/a", meta: { title: "A page" } }, "A page — https://ex.com/a"],
    [{ text: "A page https://ex.com/a", webUrl: "https://ex.com/a", meta: { title: "A page" } }, "A page https://ex.com/a"],
    [{ text: "  ", webUrl: null, meta: null }, null],
    [{}, null],
  ])("%j → %j", (input, expected) => {
    expect(sharedText(input)).toBe(expected);
  });

  it("keeps it under the inbox limit", () => {
    expect(sharedText({ text: "x".repeat(1500) })?.length).toBe(1000);
  });
});
