import { useEffect, useState } from "react";
import { BellIcon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { isNetworkError } from "../../lib/api";
import { disablePush, enablePush, readPushState, sendTestPush, type PushState } from "../../lib/push";
import { rememberedDeviceName } from "../../lib/session";
import { Row, Section } from "./Section";

// Notifications (v4): optional laptop web push — one message at 06:30 with today's P1. The phone keeps
// its own local reminders, so this stays off unless turned on here, per laptop.

const HINT: Record<PushState, string> = {
  unsupported: "This browser can't receive web push. Install the app from Chrome or Edge to use it.",
  "server-off": "The server has no push keys yet (VAPID_* in the server .env).",
  blocked: "Notifications are blocked for this site. Allow them in the browser's site settings, then come back.",
  off: "One message at 06:30 with today's P1. Nothing else.",
  on: "On for this laptop. One message at 06:30 with today's P1.",
};

export function NotificationSettings() {
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    readPushState()
      .then(setState)
      .catch(() => setState("server-off"));
  }, []);

  async function run(fn: () => Promise<PushState>) {
    setBusy(true);
    try {
      setState(await fn());
    } catch (e) {
      toast(isNetworkError(e) ? "This needs a connection." : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    try {
      toast((await sendTestPush()) ? "Sent. It should appear in a moment." : "It didn't reach this laptop. Try turning push off and on.");
    } catch (e) {
      toast(isNetworkError(e) ? "This needs a connection." : "That didn't work. Try again.");
    }
  }

  return (
    <Section id="notifications" title="Notifications" description="The phone reminds you itself. A laptop can get the morning message too, if you want it.">
      <Row label="Morning push on this laptop" hint={state ? HINT[state] : "Checking…"}>
        {state === "on" ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void test()}>
              <BellIcon size={18} /> Send a test
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => void run(disablePush)}>
              Turn off
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || state !== "off"}
            onClick={() => void run(() => enablePush(rememberedDeviceName()))}
          >
            <BellIcon size={18} /> Turn on
          </button>
        )}
      </Row>
    </Section>
  );
}
