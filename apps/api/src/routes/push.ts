import { Hono } from "hono";
import { pushEndpointInput, pushSubscribeInput } from "@tatakae/core";
import type { AppBindings, Env } from "../env";
import { HttpError, NotFound } from "../lib/errors";
import { listSubscriptions, pushConfigured, removeSubscription, saveSubscription, sendPush } from "../lib/push.service";
import { parseBody } from "../lib/validate";

// Phase v4. Optional laptop web push (morning reminder only).
//   GET    /push/key        → { publicKey }   (503 push_off when VAPID_* is not set)
//   POST   /push/subscribe  pushSubscribeInput → 201 { ok }   (upsert by endpoint)
//   DELETE /push/subscribe  { endpoint } → { ok }
//   POST   /push/test       { endpoint } → { sent }  (one test message to that browser)
export const push = new Hono<AppBindings>();

function requireConfigured(env: Env): void {
  if (!pushConfigured(env)) throw new HttpError(503, "push_off", "Web push isn't set up on the server (VAPID keys).");
}

push.get("/key", (c) => {
  requireConfigured(c.get("env"));
  return c.json({ publicKey: c.get("env").VAPID_PUBLIC_KEY });
});

push.post("/subscribe", async (c) => {
  requireConfigured(c.get("env"));
  const input = await parseBody(c, pushSubscribeInput);
  saveSubscription(c.get("db"), input);
  return c.json({ ok: true }, 201);
});

push.delete("/subscribe", async (c) => {
  const { endpoint } = await parseBody(c, pushEndpointInput);
  removeSubscription(c.get("db"), endpoint);
  return c.json({ ok: true });
});

push.post("/test", async (c) => {
  requireConfigured(c.get("env"));
  const { endpoint } = await parseBody(c, pushEndpointInput);
  const sub = listSubscriptions(c.get("db")).find((s) => s.endpoint === endpoint);
  if (!sub) throw new NotFound("This browser isn't subscribed.");
  const r = await sendPush(c.get("env"), c.get("db"), [sub], {
    title: "Tatakae",
    body: "Push works on this laptop. You'll get one message at 06:30.",
    url: "/settings#notifications",
    tag: "test",
  });
  return c.json({ sent: r.sent });
});
