import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBackup } from "../cron/backup";
import { ownerAuth, setup } from "../test/helpers";
import { resetStratusToken } from "./stratus";

// Stratus over REST against a fake Zoho: an accounts server that hands out access tokens and a bucket
// that keeps objects in a Map.

const BUCKET = "https://tatakae-files.zohostratus.in";
const ACCOUNTS = "https://accounts.zoho.in";
const STRATUS_ENV = {
  STRATUS_BUCKET_URL: BUCKET,
  ZOHO_CLIENT_ID: "1000.CLIENT",
  ZOHO_CLIENT_SECRET: "secret",
  ZOHO_REFRESH_TOKEN: "1000.refresh",
  X_ZOHO_CATALYST_ACCOUNTS_URL: ACCOUNTS, // as AppSail injects it
};

interface Put {
  key: string;
  headers: Headers;
  body: Uint8Array;
}

function fakeZoho(opts: { failPuts?: boolean } = {}) {
  const objects = new Map<string, Uint8Array<ArrayBuffer>>();
  const puts: Put[] = [];
  let tokenCalls = 0;
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === `${ACCOUNTS}/oauth/v2/token`) {
      tokenCalls++;
      const form = new URLSearchParams(String(init?.body));
      if (form.get("refresh_token") !== "1000.refresh") return Response.json({ error: "invalid_code" }, { status: 400 });
      return Response.json({ access_token: `tok-${tokenCalls}`, expires_in: 3600 });
    }
    if (url.startsWith(`${BUCKET}/`)) {
      const key = decodeURIComponent(url.slice(BUCKET.length + 1));
      const headers = new Headers(init?.headers);
      if (!headers.get("authorization")?.startsWith("Zoho-oauthtoken tok-")) return new Response("", { status: 401 });
      if (init?.method === "PUT") {
        if (opts.failPuts) return new Response("", { status: 500 });
        const body = new Uint8Array(init.body as Uint8Array);
        objects.set(key, body);
        puts.push({ key, headers, body });
        return new Response("", { status: 200 });
      }
      const obj = objects.get(key);
      return obj ? new Response(obj) : new Response("", { status: 404 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { objects, puts, tokenCalls: () => tokenCalls };
}

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "tatakae-stratus-"));
  dirs.push(d);
  return d;
};

beforeEach(() => resetStratusToken());
afterEach(() => {
  vi.unstubAllGlobals();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function upload(app: Awaited<ReturnType<typeof setup>>["app"], text: string) {
  const form = new FormData();
  form.append("file", new File([text], "note.txt", { type: "text/plain" }));
  return app.request("/api/files", { method: "POST", body: form, headers: ownerAuth });
}

describe("files on Stratus (Zoho Catalyst)", () => {
  it("stores uploads in Stratus and serves them after the disk cache is gone", async () => {
    const zoho = fakeZoho();
    const filesDir = tempDir();
    const { app } = await setup({ ...STRATUS_ENV, FILES_DIR: filesDir });
    const res = await upload(app, "hello stratus");
    expect(res.status).toBe(201);
    const { item, offsite } = (await res.json()) as { item: { id: string }; offsite: boolean };
    expect(offsite).toBe(true);
    const put = zoho.puts[0];
    expect(put?.key).toBe(`files/${item.id}`);
    expect(put?.headers.get("overwrite")).toBe("true");
    expect(put?.headers.get("content-type")).toBe("text/plain");

    rmSync(filesDir, { recursive: true, force: true }); // AppSail restarted: the local copy is gone
    const get = await app.request(`/api/files/${item.id}`, { headers: ownerAuth });
    expect(get.status).toBe(200);
    expect(await get.text()).toBe("hello stratus");
    expect(zoho.tokenCalls()).toBe(1); // the access token is cached between calls
  });

  it("refuses the upload when Stratus does (the disk alone would lose it)", async () => {
    fakeZoho({ failPuts: true });
    const { app } = await setup({ ...STRATUS_ENV, FILES_DIR: tempDir() });
    const res = await upload(app, "x");
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe("storage_unavailable");
  });

  it("nightly backup goes to Stratus with a 30-day expiry", async () => {
    const zoho = fakeZoho();
    const { db, env } = await setup({ ...STRATUS_ENV, BACKUP_DIR: tempDir() });
    expect(await runBackup(env, db, new Date("2026-10-20T20:30:00Z"))).toBe(true);
    const put = zoho.puts.find((p) => p.key.startsWith("backups/"));
    expect(put?.key).toBe("backups/2026-10-20.json"); // 02:00 IST still belongs to the 20th (04:00 boundary)
    expect(put?.headers.get("expires-after")).toBe(String(30 * 86_400));
    expect(JSON.parse(new TextDecoder().decode(put?.body))).toMatchObject({ app: "tatakae" });
  });

  it("the env needs every Zoho credential once a bucket is set", async () => {
    await expect(setup({ STRATUS_BUCKET_URL: BUCKET })).rejects.toThrow(/ZOHO_CLIENT_ID/);
  });
});
