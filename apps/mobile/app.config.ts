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
// - EAS_UPDATE_CHANNEL   channel this build listens to (default "production", see eas.json). The
//                        release APK is built by Gradle in mobile.yml, not EAS Build, so the channel
//                        is sent as a request header instead of being set by EAS.

const easProjectId = process.env.EAS_PROJECT_ID?.trim() || null;
const updateChannel = process.env.EAS_UPDATE_CHANNEL?.trim() || "production";

// Signed updates (security S14). A JS update runs with the phone's session token, so the app only
// accepts updates signed with our key: the public certificate is committed at certs/certificate.pem,
// the private key stays off the repo (keys/, git-ignored) and is passed to `eas update`. Without the
// certificate the build gets no updates block at all, so it can never run an unsigned update.
const CODE_SIGNING_CERT = "./certs/certificate.pem";
const codeSigned = existsSync(join(__dirname, CODE_SIGNING_CERT));
if (easProjectId && !codeSigned) {
  console.warn("EAS_PROJECT_ID is set but certs/certificate.pem is missing: EAS Update stays off (see docs/MANUAL-STEPS.md §17).");
}

/** Only reference artwork that exists, so `expo prebuild` works before the icon is drawn. */
const asset = (file: string): string | undefined =>
  existsSync(join(__dirname, "assets", file)) ? `./assets/${file}` : undefined;

// Drawn by `node scripts/make-icons.mjs --mobile` (the shared mark, no franchise art).
const icon = asset("icon.png");
const adaptiveIcon = asset("adaptive-icon.png");
const monochrome = asset("monochrome-icon.png");

const config: ExpoConfig = {
  name: "Tatakae",
  slug: "tatakae",
  scheme: "tatakae",
  version: "0.1.1",
  orientation: "portrait",
  // The app picks light by day and dark at night itself (src/lib/theme.tsx).
  userInterfaceStyle: "automatic",
  backgroundColor: "#FFFFFF",
  ...(icon ? { icon } : {}),
  android: {
    // Owner can change this before the first release build; changing it later means a fresh install.
    package: "dev.dhanush.tatakae",
    ...(adaptiveIcon
      ? {
          adaptiveIcon: {
            foregroundImage: adaptiveIcon,
            ...(monochrome ? { monochromeImage: monochrome } : {}),
            backgroundColor: "#262626",
          },
        }
      : {}),
    permissions: ["POST_NOTIFICATIONS", "VIBRATE", "RECEIVE_BOOT_COMPLETED", "SCHEDULE_EXACT_ALARM"],
    softwareKeyboardLayoutMode: "resize",
    // The local SQLite holds a full copy of the data. Keep it (and everything else) out of Google
    // backup and device transfer; a new phone signs in and pulls from the server instead.
    allowBackup: false,
    // PACKAGE_USAGE_STATS comes from the local module's manifest (modules/usage-stats).
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
  // JS-only fixes (v4.3): checked on launch, downloaded in the background, applied on the next launch.
  // The launch never waits for the network (fallbackToCacheTimeout 0). Same app version only
  // (runtimeVersion below), so a fix never reaches an APK it wasn't built for.
  ...(easProjectId && codeSigned
    ? {
        updates: {
          url: `https://u.expo.dev/${easProjectId}`,
          checkAutomatically: "ON_LOAD" as const,
          fallbackToCacheTimeout: 0,
          requestHeaders: { "expo-channel-name": updateChannel },
          codeSigningCertificate: CODE_SIGNING_CERT,
          codeSigningMetadata: { keyid: "main", alg: "rsa-v1_5-sha256" as const },
        },
      }
    : {}),
  runtimeVersion: { policy: "appVersion" },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8787", // Android emulator → host
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
};

export default config;
