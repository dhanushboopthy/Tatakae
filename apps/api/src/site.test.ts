import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { withWebsite } from "./site";
import { setup } from "./test/helpers";

// The api serving the built website itself (Zoho Catalyst): same routing, caching and headers as
// deploy/Caddyfile.

const dist = mkdtempSync(join(tmpdir(), "tatakae-dist-"));
mkdirSync(join(dist, "assets"));
writeFileSync(join(dist, "index.html"), "<!doctype html><title>Tatakae</title>");
writeFileSync(join(dist, "sw.js"), "self.addEventListener('install', () => {});");
writeFileSync(join(dist, "assets", "app-abc123.js"), `console.log(${JSON.stringify("x".repeat(4000))});`);
afterAll(() => rmSync(dist, { recursive: true, force: true }));

async function site(overrides: Record<string, string> = {}) {
  const { app, env, auth } = await setup(overrides);
  return { site: withWebsite(app, env, dist), auth };
}

describe("website served by the api", () => {
  it("serves index.html for / and SPA routes, revalidated every load", async () => {
    const { site: s } = await site();
    for (const path of ["/", "/today", "/settings/devices"]) {
      const res = await s.request(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/html/);
      expect(res.headers.get("cache-control")).toBe("no-cache");
      expect(await res.text()).toContain("<title>Tatakae</title>");
    }
    expect((await s.request("/sw.js")).headers.get("content-type")).toMatch(/javascript/);
  });

  it("hashed assets are immutable; a missing one is a real 404, not index.html", async () => {
    const { site: s } = await site();
    const ok = await s.request("/assets/app-abc123.js", { headers: { "accept-encoding": "gzip" } });
    expect(ok.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(ok.headers.get("content-encoding")).toBe("gzip");
    const gone = await s.request("/assets/app-old999.js");
    expect(gone.status).toBe(404);
    expect(gone.headers.get("cache-control")).toBe("no-store");
  });

  it("never reads outside the build", async () => {
    const { site: s } = await site();
    for (const path of ["/assets/../../etc/passwd", "/assets/%2e%2e/%2e%2e/etc/passwd", "/..%2f..%2fetc/passwd"]) {
      const res = await s.request(path);
      expect(await res.text()).not.toContain("root:");
    }
  });

  it("passes /api through and puts the Caddy security headers on everything", async () => {
    const { site: s, auth } = await site({ NODE_ENV: "production", PUBLIC_ORIGIN: "https://tatakae.example.me" });
    const api = await s.request("/api/session/me", { headers: auth });
    expect(api.status).toBe(200);
    for (const res of [api, await s.request("/")]) {
      expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("content-security-policy")).toContain("script-src 'self'");
      expect(res.headers.get("content-security-policy")).toContain("upgrade-insecure-requests");
    }
  });

  it("keeps a route's own CSP (uploaded files stay sandboxed)", async () => {
    const { site: s, auth } = await site({ FILES_DIR: mkdtempSync(join(tmpdir(), "tatakae-files-")) });
    const form = new FormData();
    form.append("file", new File(["hello"], "note.txt", { type: "text/plain" }));
    const up = await s.request("/api/files", { method: "POST", body: form, headers: auth });
    const id = String(((await up.json()) as { item: { id: string } }).item.id);
    const file = await s.request(`/api/files/${id}`, { headers: auth });
    expect(file.headers.get("content-security-policy")).toBe("sandbox; default-src 'none'");
  });
});
