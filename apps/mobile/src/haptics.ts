import * as Haptics from "expo-haptics";

// Haptics respect the `haptics_enabled` setting. The root layout keeps `enabled` in sync with
// settings (setHapticsEnabled); every call is fire-and-forget and never throws.

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

function run(p: () => Promise<void>): void {
  if (!enabled) return;
  p().catch(() => undefined);
}

/** Light tap: chips, toggles, habit ticks. */
export function tapLight(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Selection change: picking 25/50/90, Stuck choices. */
export function tapSelect(): void {
  run(() => Haptics.selectionAsync());
}

/** Something completed: Done, capture saved, Quick close. */
export function tapDone(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Focus block finished. */
export function tapTimerEnd(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
