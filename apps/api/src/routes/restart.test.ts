import { describe, expect, it } from "vitest";
import { addDays } from "@tatakae/core";
import { forgeDay, restartRitual } from "../lib/days.service";
import { allRows } from "../lib/rows.service";
import { call, setup } from "../test/helpers";

type Json = Record<string, unknown>;

const REASON = "Doctor moved my appointment to the morning";
const p1 = (dayDate: string) => ({ title: "Main", dayDate, slot: "P1", minimum: "one step", ifThen: "If tea, then start" });

describe("POST /days/:date/restart", () => {
  const date = "2099-01-05"; // always in the future

  it("unlocks a locked plan and logs a mura event", async () => {
    const { app, db } = await setup();
    await call(app, "POST", "/missions", p1(date));
    expect((await call(app, "POST", `/days/${date}/forge`)).status).toBe(200);

    const res = await call(app, "POST", `/days/${date}/restart`, { reason: REASON, confirm: "restart" });
    expect(res.status).toBe(200);
    expect((res.body["day"] as Json)["forgedAt"]).toBeNull();
    const events = allRows(db, "mura_events");
    expect(events).toHaveLength(1);
    expect(events[0]?.reason).toBe(`Ritual restarted: ${REASON}`);

    // The plan can be locked again, but not restarted a second time.
    expect((await call(app, "POST", `/days/${date}/forge`)).status).toBe(200);
    const again = await call(app, "POST", `/days/${date}/restart`, { reason: REASON, confirm: "restart" });
    expect(again.status).toBe(409);
    expect(again.body["error"]).toBe("restart_used");
  });

  it("needs a real reason and the typed word", async () => {
    const { app } = await setup();
    await call(app, "POST", "/missions", p1(date));
    await call(app, "POST", `/days/${date}/forge`);
    expect((await call(app, "POST", `/days/${date}/restart`, { reason: "because", confirm: "restart" })).status).toBe(400);
    expect((await call(app, "POST", `/days/${date}/restart`, { reason: REASON, confirm: "yes" })).status).toBe(400);
    expect((await call(app, "POST", `/days/${date}/restart`, { reason: REASON })).status).toBe(400);
  });

  it("refuses an unlocked plan and past days", async () => {
    const { app } = await setup();
    const res = await call(app, "POST", `/days/${date}/restart`, { reason: REASON, confirm: "restart" });
    expect(res.status).toBe(409);
    expect(res.body["error"]).toBe("not_locked");
    const past = await call(app, "POST", "/days/2020-01-01/restart", { reason: REASON, confirm: "restart" });
    expect(past.status).toBe(400);
    expect(past.body["error"]).toBe("past_day");
  });
});

describe("restartRitual limits", () => {
  it("allows two restarts in 7 days, then refuses", async () => {
    const { app, db } = await setup();
    const now = new Date("2026-10-20T15:00:00Z"); // 20:30 IST
    const dates = ["2026-10-21", "2026-10-22", addDays("2026-10-21", 15)];
    for (const d of dates) {
      await call(app, "POST", "/missions", p1(d));
      forgeDay(db, d, now);
    }
    restartRitual(db, dates[0] ?? "", REASON, now);
    restartRitual(db, dates[1] ?? "", REASON, new Date(now.getTime() + 86_400_000));
    expect(() => restartRitual(db, dates[2] ?? "", REASON, new Date(now.getTime() + 2 * 86_400_000))).toThrow(/2 times in 7 days/);
    // A week later the window has moved on.
    expect(restartRitual(db, dates[2] ?? "", REASON, new Date(now.getTime() + 8 * 86_400_000)).forgedAt).toBeNull();
  });
});
