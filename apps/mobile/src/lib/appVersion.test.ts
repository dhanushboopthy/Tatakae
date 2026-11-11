import { describe, expect, it } from "vitest";
import { isOlder, parseVersion, RELEASES_URL, updateNotice } from "./appVersion";

describe("parseVersion", () => {
  it("reads x.y.z with an optional v and tag", () => {
    expect(parseVersion("0.1.0")).toEqual([0, 1, 0]);
    expect(parseVersion("v1.10.3")).toEqual([1, 10, 3]);
    expect(parseVersion("2.0.0-beta.1")).toEqual([2, 0, 0]);
  });
  it("rejects anything else", () => {
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("—")).toBeNull();
  });
});

describe("isOlder", () => {
  it("compares numerically, part by part", () => {
    expect(isOlder("0.1.0", "0.2.0")).toBe(true);
    expect(isOlder("0.9.0", "0.10.0")).toBe(true);
    expect(isOlder("1.0.0", "0.10.0")).toBe(false);
    expect(isOlder("0.2.1", "0.2.0")).toBe(false);
    expect(isOlder("0.2.0", "0.2.0")).toBe(false);
  });
  it("never calls an unreadable version older", () => {
    expect(isOlder("dev", "9.9.9")).toBe(false);
    expect(isOlder("1.0.0", "x")).toBe(false);
  });
});

describe("updateNotice", () => {
  const info = { minMobileVersion: "0.2.0", latestApkUrl: "https://example.com/tatakae-v0.2.0.apk" };
  it("shows for an older app with the APK link", () => {
    expect(updateNotice("0.1.0", info, null)).toEqual({ version: "0.2.0", url: info.latestApkUrl });
  });
  it("falls back to the releases page", () => {
    expect(updateNotice("0.1.0", { ...info, latestApkUrl: null }, null)?.url).toBe(RELEASES_URL);
  });
  it("stays hidden when current, unknown, or dismissed for this version", () => {
    expect(updateNotice("0.2.0", info, null)).toBeNull();
    expect(updateNotice(null, info, null)).toBeNull();
    expect(updateNotice("0.1.0", null, null)).toBeNull();
    expect(updateNotice("0.1.0", info, "0.2.0")).toBeNull();
  });
  it("comes back when a newer minimum appears after a dismissal", () => {
    expect(updateNotice("0.1.0", { ...info, minMobileVersion: "0.3.0" }, "0.2.0")?.version).toBe("0.3.0");
  });
});
