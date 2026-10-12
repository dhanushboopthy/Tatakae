import { useState } from "react";
import type { FocusLength } from "@tatakae/core";
import { SegmentedPills } from "../../components/SegmentedPills";
import { useToast } from "../../components/Toast";
import { saveSetting, useSettings } from "../../lib/hooks";
import { setDisplayName, useDisplayName } from "../../lib/profile";
import { setThemePref, useThemePref, type ThemePref } from "../../lib/theme";
import { Row, Section, Toggle } from "./Section";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function GeneralSettings() {
  const { data: s, isPlaceholderData } = useSettings();
  const toast = useToast();
  const theme = useThemePref();
  const name = useDisplayName();
  const [nameDraft, setNameDraft] = useState(name);
  if (!s || isPlaceholderData) return null; // inputs below are uncontrolled: wait for the stored values

  async function saveTime(key: "wake_time" | "ritual_time", v: string) {
    if (!TIME.test(v)) return;
    await saveSetting(key, v);
    toast("Saved.", { durationMs: 1500 });
  }

  return (
    <Section id="general" title="General" description="Times drive the dark theme, the ritual prompt and the free-minutes suggestion.">
      <Row label="Theme" hint="Auto: light by day, dark from ritual time to wake time. This laptop only.">
        <SegmentedPills<ThemePref>
          label="Theme"
          value={theme}
          onChange={setThemePref}
          options={[
            { value: "auto", label: "Auto" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Row>
      <Row label="Your name" htmlFor="display-name" hint="For the greeting. Stays on this laptop.">
        <input
          id="display-name"
          className="input"
          maxLength={40}
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => setDisplayName(nameDraft)}
        />
      </Row>
      <Row label="Wake time" htmlFor="wake-time" hint="Morning reminder on the phone; free time starts here.">
        <input id="wake-time" type="time" className="input tnum" defaultValue={s.wake_time} onBlur={(e) => void saveTime("wake_time", e.target.value)} />
      </Row>
      <Row label="Ritual time" htmlFor="ritual-time" hint="Night ritual prompt and reminder.">
        <input id="ritual-time" type="time" className="input tnum" defaultValue={s.ritual_time} onBlur={(e) => void saveTime("ritual_time", e.target.value)} />
      </Row>
      <Row label="Afternoon nudge" hint="Phone only, and only if P1 hasn't started.">
        <div className="flex items-center gap-3">
          <Toggle
            label="Afternoon nudge"
            checked={s.afternoon_nudge.enabled}
            onChange={(enabled) => void saveSetting("afternoon_nudge", { ...s.afternoon_nudge, enabled })}
          />
          <label htmlFor="nudge-time" className="sr-only">
            Nudge time
          </label>
          <input
            id="nudge-time"
            type="time"
            className="input tnum w-32"
            disabled={!s.afternoon_nudge.enabled}
            defaultValue={s.afternoon_nudge.time}
            onBlur={(e) => TIME.test(e.target.value) && void saveSetting("afternoon_nudge", { ...s.afternoon_nudge, time: e.target.value })}
          />
        </div>
      </Row>
      <Row label="Default focus length">
        <SegmentedPills<string>
          label="Default focus length"
          value={String(s.focus_default)}
          onChange={(v) => void saveSetting("focus_default", Number(v) as FocusLength)}
          options={[
            { value: "25", label: "25" },
            { value: "50", label: "50" },
            { value: "90", label: "90" },
          ]}
        />
      </Row>
      <Row label="Weekly focus target" htmlFor="focus-target" hint="Minutes; the bar on the focus scoreboard box.">
        <input
          id="focus-target"
          className="input tnum"
          inputMode="numeric"
          defaultValue={String(s.focus_week_target)}
          onBlur={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 0 && n <= 5000) void saveSetting("focus_week_target", n);
          }}
        />
      </Row>
      <Row label="Haptics" hint="Phone vibration on taps.">
        <Toggle label="Haptics" checked={s.haptics_enabled} onChange={(v) => void saveSetting("haptics_enabled", v)} />
      </Row>
    </Section>
  );
}
