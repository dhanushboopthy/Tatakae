import * as QuickActions from "expo-quick-actions";

// Launcher long-press shortcuts (v2.5): "Start focus" opens the Focus tab (P1 is picked first),
// "Capture" opens the capture sheet. Routing is handled by useQuickActionRouting in app/(tabs)/_layout.tsx.

const ITEMS: QuickActions.Action[] = [
  { id: "focus", title: "Start focus", icon: null, params: { href: "/focus" } },
  { id: "capture", title: "Capture", icon: null, params: { href: "/capture" } },
];

/** Register the shortcuts once per launch; a phone without support just skips it. */
export async function registerQuickActions(): Promise<void> {
  try {
    if (!(await QuickActions.isSupported())) return;
    await QuickActions.setItems(ITEMS);
  } catch {
    // Native module missing (Expo Go, tests): no shortcuts.
  }
}

/** Remove the shortcuts after sign-out, so they don't open screens behind the login. */
export async function clearQuickActions(): Promise<void> {
  try {
    await QuickActions.setItems([]);
  } catch {
    // Nothing to clear.
  }
}
