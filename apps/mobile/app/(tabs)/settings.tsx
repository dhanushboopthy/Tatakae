import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FOCUS_MAX, FOCUS_MIN, type SyncStatus } from "@tatakae/core";
import { saveSetting, useSettings, useSyncStatus, useToday } from "../../src/lib/hooks";
import { pressedStyle, setThemePref, useThemePref, useStyles, useTheme, type Theme, type ThemePref } from "../../src/lib/theme";
import {
  openUsageAccessSettings,
  setChosenApps,
  usageStatsAvailable,
  useChosenApps,
  useRecentApps,
  useUsageAccess,
  useUsageMinutes,
} from "../../src/native/usageStats";
import { Icon } from "../../src/components/Icon";
import { ago, shiftHHMM } from "../../src/lib/format";
import { apiDelete, apiGet, ApiError } from "../../src/api/client";
import { logout } from "../../src/auth/session";
import { flush } from "../../src/sync/engine";
import { requestPermission } from "../../src/notifications/local";
import { useRemindersAllowed } from "../../src/lib/reminders";
import { SegmentedPills } from "../../src/components/SegmentedPills";
import { Stepper } from "../../src/components/fitnessUi";
import { BigButton } from "../../src/components/BigButton";
import { Toast } from "../../src/components/Toast";
import { Card, Screen, ScreenHeader } from "../../src/components/Screen";
import { f, space } from "../../src/theme";

interface Device {
  id: string;
  client: "web" | "mobile";
  deviceName: string;
  lastSeenAt: string | null;
  current: boolean;
}

function parseDevices(body: unknown): Device[] {
  if (typeof body !== "object" || body === null) return [];
  const list = (body as { devices?: unknown }).devices;
  return Array.isArray(list) ? (list as Device[]) : [];
}

function syncLabel(st: SyncStatus): string {
  if (st.error === "auth") return "Signed out — sign in to sync";
  if (st.state === "syncing") return "Syncing…";
  if (st.state === "offline") return st.pending > 0 ? `Offline · ${st.pending} waiting` : "Offline";
  if (st.state === "error") return st.pending > 0 ? `Sync paused · ${st.pending} waiting` : "Sync paused";
  return st.pending > 0 ? `${st.pending} waiting` : "Synced";
}

const THEMES: readonly { value: ThemePref; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const ON_OFF = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
] as const;

/**
 * Settings (docs/05): day times and reminders, focus length, theme, haptics, sync status, devices,
 * sign out, app version. Scoring constants stay on the laptop. Every change syncs through the outbox.
 */
export default function Settings() {
  const s = useStyles(makeStyles);
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const theme = useThemePref().data ?? "auto";
  const sync = useSyncStatus();
  const allowed = useRemindersAllowed();
  const [toast, setToast] = useState({ message: "", token: 0 });
  const say = (message: string) => setToast((t) => ({ message, token: t.token + 1 }));
  const [confirm, setConfirm] = useState<string | null>(null);

  const devices = useQuery({
    queryKey: ["rest", "devices"],
    queryFn: async () => parseDevices(await apiGet("/session/devices")),
    retry: false,
  });

  async function revoke(d: Device) {
    try {
      await apiDelete(`/session/devices/${encodeURIComponent(d.id)}`);
      say(`${d.deviceName} is signed out.`);
      setConfirm(null);
      await qc.invalidateQueries({ queryKey: ["rest", "devices"] });
    } catch (e) {
      say(e instanceof ApiError && e.status === 0 ? "Offline. Try again when connected." : "Couldn't sign that device out.");
    }
  }

  if (!settings) return <Screen tab>{null}</Screen>;
  const nudge = settings.afternoon_nudge;
  const version = Constants.expoConfig?.version ?? "—";

  return (
    <Screen tab>
      <ScreenHeader title="Settings" />

      <Section title="Day" note="Morning reminder at wake time, the ritual reminder at ritual time. Dark theme runs from ritual time to wake time.">
        <TimeRow label="Wake time" value={settings.wake_time} onChange={(v) => void saveSetting("wake_time", v)} />
        <TimeRow label="Ritual time" value={settings.ritual_time} onChange={(v) => void saveSetting("ritual_time", v)} />
      </Section>

      <Section title="Reminders" note="Morning at wake time, the ritual at ritual time, and the optional nudge below. Never more than 3 a day.">
        <Text style={s.body}>{allowed.data ? "On for this phone." : "Off for this phone."}</Text>
        {!allowed.data ? (
          <BigButton label="Turn reminders on" icon="reminders" variant="secondary" onPress={() => void requestPermission({ force: true })} />
        ) : null}
      </Section>

      <Section title="Afternoon nudge" note="Only if P1 hasn't started.">
        <SegmentedPills
          options={ON_OFF}
          value={nudge.enabled ? "on" : "off"}
          onChange={(v) => void saveSetting("afternoon_nudge", { ...nudge, enabled: v === "on" })}
          accessibilityLabel="Afternoon nudge"
          stretch
        />
        {nudge.enabled ? <TimeRow label="At" value={nudge.time} onChange={(v) => void saveSetting("afternoon_nudge", { ...nudge, time: v })} /> : null}
      </Section>

      <Section title="Focus length" note={`Default block, ${FOCUS_MIN}–${FOCUS_MAX} minutes. Morning and Focus also offer 25, 50 and 90.`}>
        <Stepper
          minusLabel="5 minutes shorter"
          plusLabel="5 minutes longer"
          onMinus={() => void saveSetting("focus_default", Math.max(FOCUS_MIN, settings.focus_default - 5))}
          onPlus={() => void saveSetting("focus_default", Math.min(FOCUS_MAX, settings.focus_default + 5))}
          value={<Text style={s.value}>{settings.focus_default} min</Text>}
        />
      </Section>

      {usageStatsAvailable ? <ScreenMinutesSection /> : null}

      <Section title="Look and feel">
        <Text style={s.label}>Theme on this phone</Text>
        <SegmentedPills options={THEMES} value={theme} onChange={(v) => void setThemePref(v)} accessibilityLabel="Theme" stretch />
        <Text style={s.label}>Haptics</Text>
        <SegmentedPills
          options={ON_OFF}
          value={settings.haptics_enabled ? "on" : "off"}
          onChange={(v) => void saveSetting("haptics_enabled", v === "on")}
          accessibilityLabel="Haptics"
          stretch
        />
      </Section>

      <Section title="Sync">
        <Text style={s.body} accessibilityRole="text" accessibilityLiveRegion="polite">
          {syncLabel(sync)}
          {sync.lastSyncAt ? <Text style={s.small}> · last {ago(sync.lastSyncAt)}</Text> : null}
        </Text>
        <BigButton label="Sync now" icon="sync" variant="secondary" onPress={() => void flush()} />
      </Section>

      <Section title="Devices" note="Every signed-in laptop and phone. Sign out a lost one here.">
        {devices.isError ? <Text style={s.small}>The list needs a connection. Your data on this phone is fine.</Text> : null}
        {(devices.data ?? []).map((d) => (
          <View key={d.id} style={s.device}>
            <View style={s.flex}>
              <Text style={s.body}>
                {d.deviceName}
                {d.current ? " · this phone" : ""}
              </Text>
              <Text style={s.small}>
                {d.client === "mobile" ? "Phone" : "Laptop"} · seen {ago(d.lastSeenAt)}
              </Text>
            </View>
            {!d.current ? (
              confirm === d.id ? (
                <BigButton label="Sign out?" size="compact" variant="danger" onPress={() => void revoke(d)} />
              ) : (
                <BigButton label="Sign out" size="compact" variant="secondary" onPress={() => setConfirm(d.id)} />
              )
            ) : null}
          </View>
        ))}
        <BigButton label="Sign out of this phone" icon="logout" variant="secondary" onPress={() => void logout()} accessibilityHint="Your data stays on this phone until you sign in again" />
      </Section>

      {__DEV__ ? <BigButton label="Design page (development only)" variant="quiet" onPress={() => router.push("/dev/design")} /> : null}
      <Text style={s.version}>Tatakae {version}</Text>
      <View style={s.toast} pointerEvents="none">
        <Toast message={toast.message} token={toast.token} />
      </View>
    </Screen>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const s = useStyles(makeStyles);
  return (
    <Card>
      <Text style={s.heading} accessibilityRole="header">
        {title}
      </Text>
      {note ? <Text style={s.small}>{note}</Text> : null}
      {children}
    </Card>
  );
}

const APPS_SHOWN = 12;

/**
 * Screen minutes from usage access (Android): grant access in system settings, then tick the
 * recreational apps that count. Quick close fills in their minutes; the list stays on this phone.
 */
function ScreenMinutesSection() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const today = useToday();
  const allowed = useUsageAccess();
  const chosen = useChosenApps().data ?? [];
  const recent = useRecentApps(today, allowed);
  const minutes = useUsageMinutes(today, allowed);
  const [all, setAll] = useState(false);

  if (!allowed) {
    return (
      <Section title="Screen minutes" note="Quick close can fill these in from Android's usage data. Only the day's total is saved; which apps you use stays on this phone.">
        <BigButton label="Allow usage access" icon="screen" variant="secondary" onPress={openUsageAccessSettings} accessibilityHint="Opens Android settings. Find Tatakae and turn it on." />
        <Text style={s.small}>Or keep typing the number in Quick close.</Text>
      </Section>
    );
  }

  // Chosen apps not used this week still show, so they can be unticked.
  const rows = [
    ...(recent.data ?? []).map((a) => ({ packageName: a.packageName, label: a.label, perDay: Math.round(a.minutes / 7) })),
    ...chosen.filter((p) => !(recent.data ?? []).some((a) => a.packageName === p)).map((p) => ({ packageName: p, label: p, perDay: 0 })),
  ];
  const shown = all ? rows : rows.slice(0, APPS_SHOWN);
  const toggle = (pkg: string) => void setChosenApps(chosen.includes(pkg) ? chosen.filter((p) => p !== pkg) : [...chosen, pkg]);

  return (
    <Section title="Screen minutes" note="Tick the apps that count as recreational. Quick close fills in their minutes since 04:00; you can still change the number.">
      <Text style={s.body} accessibilityLiveRegion="polite">
        {chosen.length === 0 ? "No apps ticked yet." : minutes.data != null ? `Today so far: ${minutes.data} min` : "Today so far: —"}
      </Text>
      {recent.isLoading ? <Text style={s.small}>Reading this week's apps…</Text> : null}
      {!recent.isLoading && rows.length === 0 ? <Text style={s.small}>No app use found this week yet.</Text> : null}
      <View accessibilityLabel="Apps that count">
        {shown.map((a) => {
          const on = chosen.includes(a.packageName);
          return (
            <Pressable
              key={a.packageName}
              onPress={() => toggle(a.packageName)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={a.label}
              style={({ pressed }) => [s.appRow, pressed && pressedStyle]}
            >
              <View style={[s.box, on && s.boxOn]}>{on ? <Icon name="done" size={16} color={c.onFill} strokeWidth={2.5} /> : null}</View>
              <View style={s.flex}>
                <Text style={s.body} numberOfLines={1}>
                  {a.label}
                </Text>
                {a.perDay > 0 ? <Text style={s.small}>about {a.perDay} min a day</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {rows.length > APPS_SHOWN ? (
        <BigButton label={all ? "Show fewer" : `Show all ${rows.length}`} variant="quiet" onPress={() => setAll((v) => !v)} />
      ) : null}
    </Section>
  );
}

/** HH:MM with − / + 15 minute steps. */
function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.timeRow}>
      <Text style={s.label}>{label}</Text>
      <Stepper
        minusLabel={`${label} 15 minutes earlier`}
        plusLabel={`${label} 15 minutes later`}
        onMinus={() => onChange(shiftHHMM(value, -15))}
        onPlus={() => onChange(shiftHHMM(value, 15))}
        value={
          <Text style={s.value} accessibilityLabel={`${label} ${value}`}>
            {value}
          </Text>
        }
      />
    </View>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    heading: { ...f(600, 17, 24), color: c.ink },
    label: { ...f(600, 14, 20), color: c.ink },
    body: { ...f(500, 15, 22), color: c.ink },
    small: { ...f(500, 13, 18), color: c.ink2 },
    value: { ...f(600, 20), color: c.ink, minWidth: 84, textAlign: "center", fontVariant: ["tabular-nums"] },
    // Label over the stepper: two 52 circles + the time don't fit beside a label on a 360 dp phone.
    timeRow: { gap: space(0.75) },
    device: { flexDirection: "row", alignItems: "center", gap: space(1.5), paddingVertical: space(0.5) },
    flex: { flex: 1 },
    appRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: space(1.5), paddingVertical: space(0.5) },
    box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: c.ink2, alignItems: "center", justifyContent: "center" },
    boxOn: { backgroundColor: c.lime, borderColor: c.lime },
    version: { ...f(500, 12, 16), color: c.ink2, textAlign: "center" },
    toast: { alignItems: "center" },
  });
