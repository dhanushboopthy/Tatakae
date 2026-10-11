import type { ExpoConfig } from "expo/config";

// Phone app (Android first). iOS stays possible but is not built or shipped.
const config: ExpoConfig = {
  name: "Tatakae",
  slug: "tatakae",
  scheme: "tatakae",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",               // TODO(phase0): original icon, no franchise art
  android: {
    package: "dev.OWNER.tatakae",          // TODO(phase0): replace OWNER
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#0b0b0f" },
    permissions: ["POST_NOTIFICATIONS", "VIBRATE"],
    // TODO(v2): PACKAGE_USAGE_STATS (usage access, granted by user in system settings)
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    "expo-secure-store",
    ["expo-notifications", { color: "#f2a33a" }],
    "expo-background-task",
    // TODO(v2): "expo-share-intent", "expo-quick-actions", "react-native-android-widget"
  ],
  updates: { url: "https://u.expo.dev/TODO_EAS_PROJECT_ID" }, // TODO(v4) EAS Update
  runtimeVersion: { policy: "appVersion" },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8787", // Android emulator → host
  },
};

export default config;
