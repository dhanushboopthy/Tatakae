import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { call, scriptAuth, setup } from "../test/helpers";
import { cleanName } from "./files";

type Json = Record<string, unknown>;

const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text, styles: {} }], children: [] });

describe("notes", () => {
  it("CRUD with tags, flags and a plain-text excerpt", async () => {
    const { app } = await setup();
    const created = await call(app, "POST", "/notes", {
      title: "Raft consensus",
      tags: ["#Distributed", "distributed", "Go"],
      bodyJson: [para("Leader election with randomised timeouts."), para("Log replication.")],
      canExplain: true,
    });
    expect(created.status).toBe(201);
    const note = created.body["item"] as Json;
    expect(note).toMatchObject({ title: "Raft consensus", tags: ["distributed", "go"], canExplain: true, canImplement: null });
    const id = String(note["id"]);

    const list = await call(app, "GET", "/notes");
    const items = list.body["items"] as Json[];
    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty("bodyJson");
    expect(items[0]?.["excerpt"]).toBe("Leader election with randomised timeouts. Log replication.");

    const patched = await call(app, "PATCH", `/notes/${id}`, { canImplement: false, misunderstood: "Joint consensus" });
    expect(patched.body["item"]).toMatchObject({ canExplain: true, canImplement: false, misunderstood: "Joint consensus" });
    expect((patched.body["item"] as Json)["bodyJson"]).toHaveLength(2);

    expect(((await call(app, "GET", "/notes?tag=GO")).body["items"] as Json[]).length).toBe(1);
    expect(((await call(app, "GET", "/notes?tag=rust")).body["items"] as Json[]).length).toBe(0);

    expect((await call(app, "DELETE", `/notes/${id}`)).status).toBe(200);
    expect((await call(app, "GET", `/notes/${id}`)).status).toBe(404);
  });

  it("searches plain text, not BlockNote JSON keys, and ranks titles first", async () => {
    const { app } = await setup();
    await call(app, "POST", "/notes", { title: "Kubernetes networking", bodyJson: [para("CNI plugins and services.")] });
    await call(app, "POST", "/notes", { title: "Weekly notes", bodyJson: [para("Read about kubernetes operators.")] });
    const gone = await call(app, "POST", "/notes", { title: "Kubernetes old", bodyJson: [] });
    await call(app, "DELETE", `/notes/${String((gone.body["item"] as Json)["id"])}`);

    const res = await call(app, "GET", "/notes/search?q=kube");
    const hits = res.body["items"] as Json[];
    expect(hits.map((h) => h["title"])).toEqual(["Kubernetes networking", "Weekly notes"]);
    expect(String(hits[1]?.["snippet"])).toContain("kubernetes operators");

    expect(((await call(app, "GET", "/notes/search?q=paragraph")).body["items"] as Json[]).length).toBe(0);
    expect(((await call(app, "GET", "/notes/search?q=styles")).body["items"] as Json[]).length).toBe(0);
  });

  it("treats search input as words, never as FTS syntax", async () => {
    const { app } = await setup();
    await call(app, "POST", "/notes", { title: "Terraform state", bodyJson: [para("Remote backends.")] });
    for (const q of ['"', "title:terraform", "terraform OR", "NEAR(", "*"]) {
      const res = await call(app, "GET", `/notes/search?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
    }
    expect((await call(app, "GET", "/notes/search?q=")).status).toBe(400);
  });

  it("inbox → note is searchable", async () => {
    const { app } = await setup();
    const item = await call(app, "POST", "/inbox", { text: "Look into eBPF tracing\nfor the VM" });
    const id = String((item.body["item"] as Json)["id"]);
    const res = await call(app, "PATCH", `/inbox/${id}`, { to: "note" });
    expect(res.status).toBe(200);
    const hits = (await call(app, "GET", "/notes/search?q=ebpf")).body["items"] as Json[];
    expect(hits.map((h) => h["id"])).toEqual([res.body["noteId"]]);
  });
});

describe("files", () => {
  const dir = mkdtempSync(join(tmpdir(), "tatakae-files-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  async function upload(app: Awaited<ReturnType<typeof setup>>["app"], file: File, noteId?: string) {
    const form = new FormData();
    form.set("file", file);
    if (noteId) form.set("noteId", noteId);
    const res = await app.request("/api/files", { method: "POST", body: form, headers: scriptAuth });
    return { status: res.status, body: (await res.json()) as Json };
  }

  it("uploads to disk, lists by note, serves and soft-deletes", async () => {
    const { app } = await setup({ FILES_DIR: dir });
    const note = await call(app, "POST", "/notes", { title: "With a diagram" });
    const noteId = String((note.body["item"] as Json)["id"]);
    const png = new File([new Uint8Array([137, 80, 78, 71])], "diagram.png", { type: "image/png" });
    const up = await upload(app, png, noteId);
    expect(up.status).toBe(201);
    expect(up.body["offsite"]).toBe(false);
    const meta = up.body["item"] as Json;
    expect(meta).toMatchObject({ name: "diagram.png", mime: "image/png", size: 4, noteId });

    const list = await call(app, "GET", `/files?noteId=${noteId}`);
    expect((list.body["items"] as Json[]).map((f) => f["id"])).toEqual([meta["id"]]);

    const get = await app.request(`/api/files/${String(meta["id"])}`, { headers: scriptAuth });
    expect(get.status).toBe(200);
    expect(get.headers.get("content-type")).toBe("image/png");
    expect(get.headers.get("content-disposition")).toContain("inline");
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));

    expect((await call(app, "DELETE", `/files/${String(meta["id"])}`)).status).toBe(200);
    expect((await call(app, "GET", `/files/${String(meta["id"])}`)).status).toBe(404);
  });

  it("serves active content as a download", async () => {
    const { app } = await setup({ FILES_DIR: dir });
    const up = await upload(app, new File(["<script>alert(1)</script>"], "x.html", { type: "text/html" }));
    const res = await app.request(`/api/files/${String((up.body["item"] as Json)["id"])}`, { headers: scriptAuth });
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
  });

  it("rejects a missing file, an unknown note and requires auth", async () => {
    const { app } = await setup({ FILES_DIR: dir });
    const form = new FormData();
    form.set("other", "x");
    expect((await app.request("/api/files", { method: "POST", body: form, headers: scriptAuth })).status).toBe(400);
    expect((await upload(app, new File(["x"], "a.txt"), "nope")).status).toBe(404);
    expect((await app.request("/api/files", { method: "POST", body: new FormData() })).status).toBe(401);
  });

  it("cleans filenames", () => {
    expect(cleanName("../../etc/passwd")).toBe("passwd");
    expect(cleanName('C:\\Users\\me\\"cv".pdf')).toBe("cv.pdf");
    expect(cleanName("   ")).toBe("file");
  });
});

describe("applications, stories, japanese log", () => {
  it("applications sort open ones by next step", async () => {
    const { app } = await setup();
    await call(app, "POST", "/applications", { company: "B", role: "SRE", status: "rejected" });
    await call(app, "POST", "/applications", { company: "C", role: "DevOps", nextStepOn: "2026-11-02" });
    await call(app, "POST", "/applications", { company: "A", role: "Platform", status: "interview", nextStepOn: "2026-11-05" });
    await call(app, "POST", "/applications", { company: "D", role: "Cloud", nextStepOn: "2026-11-01" });
    const list = await call(app, "GET", "/applications");
    expect((list.body["items"] as Json[]).map((a) => a["company"])).toEqual(["A", "D", "C", "B"]);
    expect((await call(app, "POST", "/applications", { company: "E", role: "x", status: "ghosted" })).status).toBe(400);
  });

  it("stories keep STAR fields and normalised tags", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", "/stories", { title: "Outage at 2 a.m.", situation: "Disk full", tags: ["Incident", "incident"] });
    expect(res.status).toBe(201);
    const id = String((res.body["item"] as Json)["id"]);
    const patched = await call(app, "PATCH", `/stories/${id}`, { result: "Alerting added" });
    expect(patched.body["item"]).toMatchObject({ situation: "Disk full", result: "Alerting added", tags: ["incident"] });
  });

  it("japanese log filters by date range", async () => {
    const { app } = await setup();
    for (const [date, minutes] of [["2026-11-01", 15], ["2026-11-03", 20], ["2026-11-09", 30]] as const) {
      expect((await call(app, "POST", "/japanese", { date, minutes, kind: "anki" })).status).toBe(201);
    }
    const res = await call(app, "GET", "/japanese?from=2026-11-02&to=2026-11-09");
    expect((res.body["items"] as Json[]).map((e) => e["minutes"])).toEqual([30, 20]);
    expect((await call(app, "POST", "/japanese", { date: "2026-11-01", minutes: 0, kind: "anki" })).status).toBe(400);
  });
});
