import { hash } from "@node-rs/argon2";
import type { Day, Mission } from "@tatakae/core";
import { createApp } from "../app";
import { parseEnv, type Env } from "../env";
import { openDb, runMigrations, type Db } from "../lib/db";

// Test harness: in-memory SQLite with the real migrations + default rows, env with an argon2 hash
// computed once per test file, and small request helpers around app.request().

export const OWNER = { email: "owner@example.com", password: "correct horse battery staple" };
export const API_TOKEN = "script-token-".padEnd(48, "x");

let ownerHash: Promise<string> | null = null;
function getOwnerHash(): Promise<string> {
  ownerHash ??= hash(OWNER.password);
  return ownerHash;
}

export type TestApp = ReturnType<typeof createApp>;

export async function setup(overrides: Record<string, string> = {}): Promise<{ app: TestApp; db: Db; env: Env }> {
  const parsed = parseEnv({
    NODE_ENV: "test",
    DATABASE_PATH: ":memory:",
    OWNER_EMAIL: OWNER.email,
    OWNER_PASSWORD_HASH: await getOwnerHash(),
    SESSION_SECRET: "test-session-secret-".padEnd(48, "s"),
    API_TOKEN,
    ...overrides,
  });
  if (!parsed.ok) throw new Error(parsed.message);
  const db = openDb(":memory:");
  runMigrations(db);
  return { app: createApp(parsed.env, db), db, env: parsed.env };
}

export const scriptAuth = { authorization: `Bearer ${API_TOKEN}` };

export function jsonInit(method: string, body?: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

/** Request with JSON in/out. */
export async function call(
  app: TestApp,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = scriptAuth,
): Promise<{ status: number; body: Record<string, unknown>; res: Response }> {
  const res = await app.request(`/api${path}`, jsonInit(method, body, headers));
  const text = await res.text();
  const parsed: unknown = text ? JSON.parse(text) : {};
  return { status: res.status, body: parsed as Record<string, unknown>, res };
}

/** Log in and return headers that authenticate later requests. */
export async function login(
  app: TestApp,
  client: "web" | "mobile" = "mobile",
  deviceName = client === "web" ? "laptop-1" : "phone",
): Promise<Record<string, string>> {
  const { status, body, res } = await call(
    app,
    "POST",
    "/session/login",
    { email: OWNER.email, password: OWNER.password, client, deviceName },
    {},
  );
  if (status !== 200) throw new Error(`login failed: ${status} ${JSON.stringify(body)}`);
  if (client === "mobile") return { authorization: `Bearer ${String(body["token"])}` };
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("no cookie");
  return { cookie: cookie.split(";")[0] ?? "" };
}

const T0 = "2026-10-19T03:00:00.000Z";

export function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "01JTESTMISSION000000000001",
    title: "Write Terraform module",
    dayDate: "2026-10-20",
    slot: "P1",
    points: null,
    status: "open",
    minimum: "Write the variables file",
    ifThen: "If I open the laptop after dinner, then I start the module",
    resumeNote: null,
    goalId: null,
    estMin: 50,
    actualMin: null,
    rescheduleCount: 0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

export function day(overrides: Partial<Day> = {}): Day {
  return {
    date: "2026-10-20",
    kind: "normal",
    screenMin: null,
    smallWin: null,
    qP1: null,
    qDrift: null,
    qPractised: null,
    intention: null,
    energy: null,
    forgedAt: null,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

/** ISO timestamp `minutes` after T0. */
export function at(minutes: number): string {
  return new Date(Date.parse(T0) + minutes * 60_000).toISOString();
}
