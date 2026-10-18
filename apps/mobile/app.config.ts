import type { ExpoConfig } from "expo/config";

// Evaluated by the Expo CLI in Node. The app tsconfig has no @types/node, so type the two Node
// APIs used here locally instead of adding a dependency.
declare const __dirname: string;
const { existsSync } = require<{ existsSync(p: string): boolean }>("fs");
const { join } = require<{ join(...parts: string[]): string }>("path");

// Phone app (Android first). iOS stays possible but is not built or shipped.
//
// Env:
// - EXPO_PUBLIC_API_URL  production API origin, e.g. https://tatakae.example.me (no trailing /api)
// - EAS_PROJECT_ID       set once the EAS project exists; enables EAS Update (v4). Without it the
//                        build has no `updates` block, so local/CI builds never point at a placeholder.

const easProjectId = process.env.EAS_PROJECT_ID?.trim() || null;

/** Only reference artwork that exists, so `expo prebuild` works before the icon is drawn. */
const asset = (file: string): string | undefined =>
  existsSync(join(__dirname, "assets", file)) ? `./assets/${file}` : undefined;

const icon = asset("icon.png"); // TODO(phase0): original 1024×1024 icon, no franchise art
const adaptiveIcon = asset("adaptive-icon.png");

const config: ExpoConfig = {
  name: "Tatakae",
  slug: "tatakae",
  scheme: "tatakae",
  version: "0.1.0",
  orientation: "portrait",
  // The app picks light by day and dark at night itself (src/lib/theme.tsx).
  userInterfaceStyle: "automatic",
  backgroundColor: "#FFFFFF",
  ...(icon ? { icon } : {}),
  android: {
    // Owner can change this before the first release build; changing it later means a fresh install.
    package: "dev.dhanush.tatakae",
    ...(adaptiveIcon ? { adaptiveIcon: { foregroundImage: adaptiveIcon, backgroundColor: "#262626" } } : {}),
    permissions: ["POST_NOTIFICATIONS", "VIBRATE", "RECEIVE_BOOT_COMPLETED", "SCHEDULE_EXACT_ALARM"],
    softwareKeyboardLayoutMode: "resize",
    // TODO(v2): PACKAGE_USAGE_STATS (usage access, granted by user in system settings)
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    "expo-secure-store",
    ["expo-notifications", { color: "#7E9A1E" }],
    "expo-background-task",
    "expo-quick-actions",
    // Share sheet → Capture: text and links only, Android only (iOS is not built).
    ["expo-share-intent", { androidIntentFilters: ["text/*"], disableIOS: true }],
    // Home-screen widget: today's P1 with Start and Done (src/native/widget.ts).
    [
      "react-native-android-widget",
      {
        widgets: [
          {
            name: "P1",
            label: "Tatakae P1",
            description: "Today's P1 with Start and Done",
            minWidth: "250dp",
            minHeight: "110dp",
            targetCellWidth: 4,
            targetCellHeight: 2,
            resizeMode: "horizontal|vertical",
            updatePeriodMillis: 1_800_000,
          },
        ],
      },
    ],
  ],
  ...(easProjectId ? { updates: { url: `https://u.expo.dev/${easProjectId}` } } : {}), // TODO(v4) EAS Update channel
  runtimeVersion: { policy: "appVersion" },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8787", // Android emulator → host
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
};

export default config;
