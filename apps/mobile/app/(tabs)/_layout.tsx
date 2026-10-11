import { Tabs } from "expo-router";

/** Bottom tabs: Today · Focus · Capture (centre, large) · Settings. 44dp+ targets. */
export default function TabsLayout() {
  // TODO(v1): icons, centre capture button, dark tab bar
  return <Tabs screenOptions={{ headerShown: false }} />;
}
