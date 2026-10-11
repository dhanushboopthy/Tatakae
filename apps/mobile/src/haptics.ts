import * as Haptics from "expo-haptics";

export async function tapDone(enabled: boolean): Promise<void> {
  if (!enabled) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
