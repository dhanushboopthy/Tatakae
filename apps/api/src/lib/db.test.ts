import { describe, expect, it } from "vitest";
import { parseEnv } from "../env";
import { openDb, sqliteOf, transaction } from "./db";

// The Turso replica (libsql) has no nested transactions, so db.ts issues SAVEPOINTs itself there.
// `manualSavepoints` runs that same path on better-sqlite3, which is what can run here.

function count(db: ReturnType<typeof openDb>): number {
  return (sqliteOf(db).prepare("SELECT count(*) AS n FROM t").get() as { n: number }).n;
}

describe.each([false, true])("transaction() (manualSavepoints: %s)", (manualSavepoints) => {
  const fresh = () => {
    const db = openDb(":memory:", { manualSavepoints });
    sqliteOf(db).exec("CREATE TABLE t (v INTEGER)");
    return db;
  };
  const insert = (db: ReturnType<typeof openDb>, v: number) => sqliteOf(db).prepare("INSERT INTO t VALUES (?)").run(v);

  it("a failing inner call rolls back alone when the caller catches it", () => {
    const db = fresh();
    transaction(db, () => {
      insert(db, 1);
      try {
        transaction(db, () => {
          insert(db, 2);
          throw new Error("item failed");
        });
      } catch {
        // the sync merge does this per item
      }
      transaction(db, () => insert(db, 3));
    });
    expect(sqliteOf(db).prepare("SELECT v FROM t ORDER BY v").all()).toEqual([{ v: 1 }, { v: 3 }]);
  });

  it("an outer failure rolls back everything, inner work included", () => {
    const db = fresh();
    expect(() =>
      transaction(db, () => {
        insert(db, 1);
        transaction(db, () => insert(db, 2));
        throw new Error("outer failed");
      }),
    ).toThrow("outer failed");
    expect(count(db)).toBe(0);
    expect(sqliteOf(db).inTransaction).toBe(false);
  });
});

describe("hosting env", () => {
  const base = { NODE_ENV: "test", OWNER_EMAIL: "o@example.com", OWNER_PASSWORD_HASH: "x", SESSION_SECRET: "s".repeat(40) };

  it("takes the port from Zoho Catalyst's X_ZOHO_CATALYST_LISTEN_PORT", () => {
    const res = parseEnv({ ...base, X_ZOHO_CATALYST_LISTEN_PORT: "9000" });
    expect(res.ok && res.env.PORT).toBe(9000);
    const explicit = parseEnv({ ...base, PORT: "8787", X_ZOHO_CATALYST_LISTEN_PORT: "9000" });
    expect(explicit.ok && explicit.env.PORT).toBe(8787);
  });

  it("a Turso URL needs its token", () => {
    const res = parseEnv({ ...base, TURSO_DATABASE_URL: "libsql://tatakae-owner.turso.io" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/TURSO_AUTH_TOKEN/);
    expect(parseEnv({ ...base, TURSO_DATABASE_URL: "libsql://tatakae-owner.turso.io", TURSO_AUTH_TOKEN: "t" }).ok).toBe(true);
  });
});
