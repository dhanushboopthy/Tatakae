import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import webpush from "web-push";
import { afterAll, describe, expect, it } from "vitest";
import { runBackup } from "../cron/backup";
import { runMorningPush } from "../cron/morning";
import { listSubscriptions, morningMessage, saveSubscription, type PushSender } from "../lib/push.service";
import { call, login, mission, setup } from "../test/helpers";

type Json = Record<string, unknown>;

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "tatakae-v4-"));
  dirs.push(d);
  return d;
};
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const vapid = webpush.generateVAPIDKeys();
const VAPID = { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: "mailto:owner@example.com" };
const sub = (n: number) => ({
  endpoint: `https://push.example.com/send/${n}`,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
  device: `laptop-${n}`,
});

describe("export and jobs", () => {
  it("exports every owned table, never sessions or sync bookkeeping", async () => {
    const { app } = await setup();
    await login(app, "web");
    await call(app, "POST", "/notes", { title: "Exported", bodyJson: [{ type: "paragraph", content: [] }] });
    await call(app, "POST", "/inbox", { text: "hello" });
    const res = await call(app, "GET", "/export");
    expect(res.status).toBe(200);
    expect(res.res.headers.get("content-disposition")).toMatch(/^attachment; filename="tatakae-export-\d{4}-\d{2}-\d{2}\.json"$/);
    const tables = res.body["tables"] as Record<string, Json[]>;
    expect(res.body).toMatchObject({ app: "tatakae", format: 1 });
    expect(tables["inbox"]?.map((r) => r["text"])).toEqual(["hello"]);
    expect(tables["notes"]?.[0]).toMatchObject({ title: "Exported", bodyJson: [{ type: "paragraph", content: [] }] });
    expect(tables["settings"]?.length).toBeGreaterThan(0);
    for (const secret of ["sessions", "changes", "sync_items", "push_subscriptions"]) expect(tables).not.toHaveProperty(secret);
  });

  it("nightly backup writes a local copy, prunes old ones and logs the run", async () => {
    const dir = tempDir();
    const { app, db, env } = await setup({ BACKUP_DIR: dir });
    for (let d = 1; d <= 8; d++) writeFileSync(join(dir, `2026-09-0${d}.json`), "{}");
    writeFileSync(join(dir, "keep-me.txt"), "x");
    const ok = await runBackup(env, db, new Date("2026-10-20T03:00:00Z"));
    expect(ok).toBe(true);
    const files = readdirSync(dir).sort();
    expect(files).toContain("2026-10-20.json");
    expect(files).toContain("keep-me.txt");
    expect(files.filter((f) => f.endsWith(".json"))).toHaveLength(7);
    expect(JSON.parse(readFileSync(join(dir, "2026-10-20.json"), "utf8"))).toMatchObject({ app: "tatakae" });

    const jobs = await call(app, "GET", "/system/jobs");
    const runs = jobs.body["runs"] as Json[];
    expect(runs[0]).toMatchObject({ job: "backup", ok: true });
    expect(String(runs[0]?.["detail"])).toContain("local only");
  });

  it("a failed backup is logged as not ok", async () => {
    const file = join(tempDir(), "not-a-dir");
    writeFileSync(file, "x");
    const { db, env, app } = await setup({ BACKUP_DIR: file });
    expect(await runBackup(env, db)).toBe(false);
    const runs = (await call(app, "GET", "/system/jobs")).body["runs"] as Json[];
    expect(runs[0]).toMatchObject({ job: "backup", ok: false });
  });
});

describe("app version", () => {
  it("is public and reads the env", async () => {
    const { app } = await setup({ MIN_MOBILE_VERSION: "1.2.0", LATEST_APK_URL: "https://github.com/x/y/releases/download/mobile-v1.2.0/app.apk" });
    const res = await call(app, "GET", "/app/version", undefined, {});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ minMobileVersion: "1.2.0", latestApkUrl: "https://github.com/x/y/releases/download/mobile-v1.2.0/app.apk" });
  });
  it("defaults without a release", async () => {
    const { app } = await setup();
    expect((await call(app, "GET", "/app/version", undefined, {})).body).toEqual({ minMobileVersion: "0.1.0", latestApkUrl: null });
  });
});

describe("web push", () => {
  it("is off without VAPID keys", async () => {
    const { app } = await setup();
    const res = await call(app, "GET", "/push/key");
    expect(res.status).toBe(503);
    expect(res.body["error"]).toBe("push_off");
  });

  it("subscribes (upsert), unsubscribes and needs auth", async () => {
    const { app, db } = await setup(VAPID);
    expect((await call(app, "GET", "/push/key")).body).toEqual({ publicKey: vapid.publicKey });
    expect((await call(app, "POST", "/push/subscribe", sub(1))).status).toBe(201);
    expect((await call(app, "POST", "/push/subscribe", { ...sub(1), device: "renamed" })).status).toBe(201);
    expect(listSubscriptions(db).map((s) => s.device)).toEqual(["renamed"]);
    expect((await call(app, "POST", "/push/subscribe", { ...sub(2), endpoint: "http://insecure.example.com" })).status).toBe(400);
    expect((await call(app, "POST", "/push/subscribe", sub(3), {})).status).toBe(401);
    expect((await call(app, "DELETE", "/push/subscribe", { endpoint: sub(1).endpoint })).status).toBe(200);
    expect(listSubscriptions(db)).toHaveLength(0);
  });

  it("morning push sends today's P1 and drops expired subscriptions", async () => {
    const { db, env, app } = await setup(VAPID);
    const now = new Date("2026-10-20T01:00:00Z"); // 06:30 IST
    await call(app, "POST", "/missions", { ...mission({ id: undefined as unknown as string }), dayDate: "2026-10-20" });
    saveSubscription(db, { ...sub(1), device: "a" });
    saveSubscription(db, { ...sub(2), device: "b" });
    const sent: { endpoint: string; payload: Json }[] = [];
    const sender: PushSender = async (s, payload) => {
      if (s.endpoint.endsWith("/2")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      sent.push({ endpoint: s.endpoint, payload: JSON.parse(payload) as Json });
    };
    await runMorningPush(env, db, sender, now);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.payload).toMatchObject({ title: "Good morning", url: "/today" });
    expect(String(sent[0]?.payload["body"])).toContain("P1: Write Terraform module. Minimum: Write the variables file");
    expect(listSubscriptions(db).map((s) => s.device)).toEqual(["a"]);
    const runs = (await call(app, "GET", "/system/jobs")).body["runs"] as Json[];
    expect(runs[0]).toMatchObject({ job: "morning_push", ok: true });
  });

  it("morning message without a plan is a calm nudge", async () => {
    const { db } = await setup();
    expect(morningMessage(db, new Date("2026-10-20T01:00:00Z")).body).toBe("No plan for today yet. Pick one thing and start small.");
  });

  it("does nothing when push is off", async () => {
    const { db, env } = await setup();
    let calls = 0;
    await runMorningPush(env, db, async () => void calls++);
    expect(calls).toBe(0);
  });
});
