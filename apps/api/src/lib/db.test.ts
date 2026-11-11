import { describe, expect, it } from "vitest";
import { openDb, sqliteOf, transaction } from "./db";

function count(db: ReturnType<typeof openDb>): number {
  return (sqliteOf(db).prepare("SELECT count(*) AS n FROM t").get() as { n: number }).n;
}

describe("transaction()", () => {
  const fresh = () => {
    const db = openDb(":memory:");
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
