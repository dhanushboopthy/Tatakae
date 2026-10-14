import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { AnchorsSettings } from "./settings/Anchors";
import { AreasSettings } from "./settings/Areas";
import { DataSettings } from "./settings/Data";
import { DevicesSettings } from "./settings/Devices";
import { GeneralSettings } from "./settings/General";
import { HabitsSettings } from "./settings/Habits";
import { NotificationSettings } from "./settings/Notifications";
import { PasskeysSettings } from "./settings/Passkeys";
import { RechargeSettings } from "./settings/Recharge";
import { ScoringSettings } from "./settings/Scoring";

// Settings (docs/05): everything, including scoring constants (even-ISO-week Sundays), anchors, recharge
// menu, areas, passkeys, devices, data. The Story section was removed (R3-10); the reward queue is in General. Sections are anchors so other
// screens can deep-link (e.g. /settings#habits).

const SECTIONS = [
  ["general", "General"],
  ["habits", "Habits"],
  ["anchors", "Anchors"],
  ["recharge", "Recharge"],
  ["areas", "Areas"],
  ["scoring", "Scoring"],
  ["notifications", "Notifications"],
  ["passkeys", "Passkeys"],
  ["devices", "Devices"],
  ["data", "Data"],
] as const;

export function Settings() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="mx-auto w-full max-w-wide space-y-6">
      <PageHeader eyebrow="Settings" title="Settings" quiet />
      <p className="card-inner text-sm">Misses turn grey. Nothing resets. Don't miss twice.</p>
      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-8 lg:self-start">
          <ul className="flex flex-wrap gap-1.5 lg:flex-col">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="chip bg-surface font-medium hover:bg-surface-2 lg:w-full">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          <GeneralSettings />
          <HabitsSettings />
          <AnchorsSettings />
          <RechargeSettings />
          <AreasSettings />
          <ScoringSettings />
          <NotificationSettings />
          <PasskeysSettings />
          <DevicesSettings />
          <DataSettings />
        </div>
      </div>
    </div>
  );
}
