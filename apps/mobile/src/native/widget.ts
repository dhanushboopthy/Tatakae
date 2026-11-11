import { createElement } from "react";
import { Platform } from "react-native";
import { requestWidgetUpdate, type WidgetTaskHandler } from "react-native-android-widget";
import { todayIST } from "@tatakae/core";
import { sqliteStore as store } from "../sync/outbox";
import { addChangeListener } from "../sync/engine";
import { setStatus } from "../lib/hooks";
import { P1Widget, type P1WidgetProps } from "./P1Widget";

// Android home-screen widget "P1" (v2.5, react-native-android-widget): today's P1 title + Minimum,
// Start (opens the app into a focus block on P1) and Done (marks it done through the outbox, without
// opening the app). Redrawn whenever missions or days change, and every 30 minutes by the launcher.

export const WIDGET_NAME = "P1";

async function loadProps(): Promise<P1WidgetProps> {
  const missions = await store.getWhere("missions", "dayDate", todayIST());
  const p1 = missions.find((m) => m.slot === "P1" && m.status !== "rescheduled" && m.deletedAt == null) ?? null;
  return { missionId: p1?.id ?? null, title: p1?.title ?? null, minimum: p1?.minimum ?? null, status: p1?.status ?? null };
}

const render = async () => createElement(P1Widget, await loadProps());

/** Registered in index.ts; runs in the background when the widget is added, updated or tapped. */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, clickAction, clickActionData, renderWidget }) => {
  try {
    if (widgetAction === "WIDGET_DELETED") return;
    if (widgetAction === "WIDGET_CLICK" && clickAction === "DONE") {
      const id = typeof clickActionData?.missionId === "string" ? clickActionData.missionId : null;
      const m = id ? await store.get("missions", id) : null;
      if (m && m.status === "open") await setStatus(m, "done");
    }
    renderWidget(await render());
  } catch {
    // The widget keeps its last picture; the app shows the truth when opened.
  }
};

/** Redraw every placed P1 widget (no-op when none is on the home screen). */
export async function updateP1Widget(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: render, widgetNotFound: () => undefined });
  } catch {
    // Native module missing (Expo Go, tests).
  }
}

/** Keep the widget in step with local data while the app runs. Returns cleanup. */
export function initWidget(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  void updateP1Widget();
  const off = addChangeListener((tables) => {
    if (!tables.has("missions") && !tables.has("days")) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void updateP1Widget(), 1_000);
  });
  return () => {
    if (timer) clearTimeout(timer);
    off();
  };
}
