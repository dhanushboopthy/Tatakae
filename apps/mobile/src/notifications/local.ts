import { AppState, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { addDays, readSettings, todayIST, type ISODate } from "@tatakae/core";
import { sqliteStore as store } from "../sync/outbox";
import { addChangeListener, notifyLocalChange, setAfterBackgroundFlush } from "../sync/engine";
import { ignoredInARow, planReminders, type DayInput, type Reminder } from "./plan";
import { ongoingText, parseSession } from "../focus/timer";

/**
 * LOCAL notifications only (no server push to the phone), docs/05:
 *  - morning at wake time → opens Morning ("P1: <title>. Start?")
 *  - optional afternoon nudge, only if P1 has not started
 *  - ritual reminder at ritual time → opens Quick close
 * Max 3 a day, none on rest / write-off days, never guilt copy. Planned for today and tomorrow and
 * rescheduled whenever settings, missions, days or the day flags change, when the app comes back,
 * and after a background sync. Permission is asked after the first login or the first Quick close,
 * never on launch. Two ignored in a row → Today asks once whether to change the times.
 */

const CHANNEL = "reminders";
const META_SCHEDULED = "notif_scheduled"; // [{ key, at }] from the last schedule
const META_FIRED = "notif_fired"; // [{ key, at }] that have fired (newest 10)
const META_OPENED = "notif_opened"; // [key] tapped (newest 20)
const META_ASKED_TIMES = "notif_asked_times";
const META_ASKED_PERMISSION = "notif_asked_permission";

type Stamp = { key: string; at: number };

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await store.getMeta(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const writeJson = (key: string, v: unknown) => store.setMeta(key, JSON.stringify(v));

async function flag(date: ISODate, name: "p1Started" | "closed"): Promise<boolean> {
  return (await store.getMeta(`day:${date}:${name}`)) === "1";
}

async function dayInput(date: ISODate): Promise<DayInput> {
  const [row, next, missions, p1Started, closedFlag] = await Promise.all([
    store.get("days", date),
    store.get("days", addDays(date, 1)),
    store.getWhere("missions", "dayDate", date),
    flag(date, "p1Started"),
    flag(date, "closed"),
  ]);
  const p1 = missions.find((m) => m.slot === "P1" && m.status !== "rescheduled" && m.deletedAt == null) ?? null;
  return {
    date,
    kind: row?.kind ?? "normal",
    p1Title: p1?.title ?? null,
    p1Open: p1?.status === "open",
    p1Started: p1Started || p1?.status === "done" || p1?.status === "minimum",
    // The laptop ritual forges tomorrow's plan; Quick close sets the flag.
    closed: closedFlag || next?.forgedAt != null,
  };
}

export async function notificationsAllowed(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Plan and (re)schedule today's and tomorrow's reminders. Safe to call often. */
export async function scheduleDaily(): Promise<void> {
  try {
    if (!(await notificationsAllowed())) return;
    const settings = readSettings(await store.getAll("settings"));
    const today = todayIST();
    const days = await Promise.all([dayInput(today), dayInput(addDays(today, 1))]);
    const now = Date.now();

    // What fired since the last schedule goes into the "fired" history (for the ignored count).
    const previous = await readJson<Stamp[]>(META_SCHEDULED, []);
    const fired = await readJson<Stamp[]>(META_FIRED, []);
    const firedKeys = new Set(fired.map((f) => f.key));
    const nowFired = previous.filter((p) => p.at <= now && !firedKeys.has(p.key));
    if (nowFired.length > 0) await writeJson(META_FIRED, [...fired, ...nowFired].sort((a, b) => a.at - b.at).slice(-10));

    const plan: Reminder[] = planReminders({
      now: new Date(now),
      wake: settings.wake_time,
      ritual: settings.ritual_time,
      afternoon: settings.afternoon_nudge,
      days,
    });

    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.key,
        content: { title: r.title, body: r.body, data: { url: r.url, key: r.key }, sound: false },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
      });
    }
    await writeJson(
      META_SCHEDULED,
      plan.map((r) => ({ key: r.key, at: r.at.getTime() })),
    );
    if (nowFired.length > 0) notifyLocalChange(["meta:notif"]);
  } catch {
    // Native module missing (tests, Expo Go) or the OS refused: reminders are a nice-to-have.
  }
}

/**
 * Ask for notification permission once (after the first login or the first Quick close), or
 * again from Settings with `force`. If Android won't ask again, open the app's system settings.
 */
export async function requestPermission(opts: { force?: boolean } = {}): Promise<boolean> {
  try {
    if (await notificationsAllowed()) {
      await scheduleDaily();
      return true;
    }
    if (!opts.force && (await store.getMeta(META_ASKED_PERMISSION)) === "1") return false;
    await store.setMeta(META_ASKED_PERMISSION, "1");
    const current = await Notifications.getPermissionsAsync();
    if (!current.canAskAgain) {
      if (opts.force) await Linking.openSettings();
      return false;
    }
    const res = await Notifications.requestPermissionsAsync();
    notifyLocalChange(["meta:notif"]);
    if (res.granted) await scheduleDaily();
    return res.granted;
  } catch {
    return false;
  }
}

async function recordOpened(key: string): Promise<void> {
  const opened = await readJson<string[]>(META_OPENED, []);
  if (!opened.includes(key)) await writeJson(META_OPENED, [...opened, key].slice(-20));
  notifyLocalChange(["meta:notif"]);
}

/** Two reminders in a row went unopened and we haven't asked yet. */
export async function shouldAskAboutTimes(): Promise<boolean> {
  if ((await store.getMeta(META_ASKED_TIMES)) === "1") return false;
  const fired = await readJson<Stamp[]>(META_FIRED, []);
  const opened = new Set(await readJson<string[]>(META_OPENED, []));
  return ignoredInARow(fired, opened, Date.now()) >= 2;
}

export async function markAskedAboutTimes(): Promise<void> {
  await store.setMeta(META_ASKED_TIMES, "1");
  notifyLocalChange(["meta:notif"]);
}

function openFrom(response: Notifications.NotificationResponse | null): void {
  const data = response?.notification.request.content.data as { url?: unknown; key?: unknown } | undefined;
  if (typeof data?.key === "string") void recordOpened(data.key);
  if (data?.url === "/morning" || data?.url === "/quick-close" || data?.url === "/" || data?.url === "/focus") {
    try {
      router.push(data.url);
    } catch {
      // Navigator not mounted yet; the home redirect still lands on the right screen.
    }
  }
}

// ---------- ongoing focus notification (v2.5) ----------

const FOCUS_CHANNEL = "focus";
const FOCUS_ID = "focus-ongoing";

/**
 * While a focus block runs, one quiet sticky notification says what you're on and when it ends.
 * It's a status line, not a reminder (low importance, no sound, not counted in the 3 a day).
 * Updated on start / pause / resume, removed when the block ends.
 */
export async function syncFocusNotification(): Promise<void> {
  try {
    const session = parseSession(await store.getMeta("focus"));
    if (!session || !(await notificationsAllowed())) {
      await Notifications.dismissNotificationAsync(FOCUS_ID);
      return;
    }
    const mission = await store.get("missions", session.missionId);
    const { title, body } = ongoingText(session, mission?.title ?? null);
    await Notifications.scheduleNotificationAsync({
      identifier: FOCUS_ID,
      content: { title, body, sticky: true, autoDismiss: false, sound: false, data: { url: "/focus" } },
      trigger: { channelId: FOCUS_CHANNEL },
    });
  } catch {
    // Native module missing or refused; the Focus tab still shows the timer.
  }
}

const RESCHEDULE_ON = new Set(["settings", "missions", "days", "meta:flags"]);

/** Start reminders for a signed-in session. Returns cleanup. */
export function initNotifications(): () => void {
  try {
    Notifications.setNotificationHandler({
      // The ongoing focus line goes to the shade only; reminders show as a banner too.
      handleNotification: async (n) => ({
        shouldShowBanner: n.request.identifier !== FOCUS_ID,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync(CHANNEL, {
        name: "Reminders",
        description: "Morning, optional afternoon and ritual reminders. At most three a day.",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      void Notifications.setNotificationChannelAsync(FOCUS_CHANNEL, {
        name: "Focus block",
        description: "Shows the running focus block and when it ends. Silent.",
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        enableVibrate: false,
      });
    }
  } catch {
    return () => undefined;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const soon = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void scheduleDaily(), 2_000);
  };

  void scheduleDaily();
  void syncFocusNotification();
  const offChange = addChangeListener((tables) => {
    if (tables.has("meta:focus")) void syncFocusNotification();
    for (const t of tables) if (RESCHEDULE_ON.has(t)) return soon();
  });
  const appSub = AppState.addEventListener("change", (s) => {
    if (s !== "active") return;
    soon();
    notifyLocalChange(["meta:notif"]); // permission may have changed in system settings
  });
  setAfterBackgroundFlush(scheduleDaily);
  const responseSub = Notifications.addNotificationResponseReceivedListener(openFrom);
  void Notifications.getLastNotificationResponseAsync().then((r) => {
    if (r) {
      openFrom(r);
      void Notifications.clearLastNotificationResponseAsync?.();
    }
  });

  return () => {
    if (timer) clearTimeout(timer);
    offChange();
    appSub.remove();
    setAfterBackgroundFlush(null);
    responseSub.remove();
  };
}
