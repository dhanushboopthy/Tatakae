/**
 * LOCAL notifications (no server push for the phone):
 *  - morning at wake time → opens /morning ("P1: <title>")
 *  - optional afternoon nudge only if P1 not started
 *  - ritual reminder at ritual time → "Laptop ritual at 21:30" (or Quick close if away)
 * Max 3/day. Reschedule whenever settings or tomorrow's P1 sync. Never guilt copy.
 */
export async function scheduleDaily(): Promise<void> {
  // TODO(v1)
}

export async function requestPermission(): Promise<boolean> {
  // TODO(v1): ask after first completed Quick close / first login, not on launch
  return false;
}
