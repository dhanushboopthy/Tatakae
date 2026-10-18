import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FOCUS_MAX, FOCUS_MIN, type SyncStatus } from "@tatakae/core";
import { saveSetting, useSettings, useSyncStatus } from "../../src/lib/hooks";
import { setThemePref, useThemePref, useStyles, type Theme, type ThemePref } from "../../src/lib/theme";
import { ago, shiftHHMM } from "../../src/lib/format";
import { apiDelete, apiGet, ApiError } from "../../src/api/client";
import { logout } from "../../src/auth/session";
import { flush } from "../../src/sync/engine";
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

      <Section title="Afternoon nudge" note="Only if P1 hasn't started. Never more than 3 reminders a day.">
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
    version: { ...f(500, 12, 16), color: c.ink2, textAlign: "center" },
    toast: { alignItems: "center" },
  });
