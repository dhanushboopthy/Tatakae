import type { ComponentType } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { syncLabel, useInbox, useSyncStatus } from "../lib/hooks";
import { platform } from "../lib/platform";
import { AuthGate } from "./AuthGate";
import { CommandPalette, openCommandPalette } from "./CommandPalette";
import { ChartIcon, CommandIcon, CycleIcon, InboxIcon, LogoMark, MoonIcon, NoteIcon, SettingsIcon, SunIcon } from "./icons";
import { InstallBanner } from "./InstallBanner";
import { ToastProvider } from "./Toast";

/**
 * Laptop layout: left sidebar (Today · Ritual · Inbox · Review (Week/Month) · Cycle · Notes · Settings),
 * sync status in the footer, Cmd/Ctrl+K palette everywhere. Narrow windows get a top bar instead.
 */

type NavIcon = ComponentType<{ size?: number; className?: string }>;

const NAV: readonly { to: string; label: string; Icon: NavIcon }[] = [
  { to: "/today", label: "Today", Icon: SunIcon },
  { to: "/ritual", label: "Ritual", Icon: MoonIcon },
  { to: "/inbox", label: "Inbox", Icon: InboxIcon },
];
const NAV_AFTER: readonly { to: string; label: string; Icon: NavIcon }[] = [
  { to: "/cycle", label: "Cycle", Icon: CycleIcon },
  { to: "/notes", label: "Notes", Icon: NoteIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-tap items-center gap-3 rounded-control border-l-2 px-3 transition-colors duration-fast ease-out ${
    isActive ? "border-ember bg-ink-3 font-medium text-paper" : "border-transparent text-muted hover:bg-ink-3 hover:text-paper"
  }`;

function InboxCount() {
  const { data } = useInbox();
  const n = data?.length ?? 0;
  if (n === 0) return null;
  return (
    <span className="tnum ml-auto rounded-full border border-line-strong px-2 text-xs text-paper">
      {n}
      <span className="sr-only"> unprocessed</span>
    </span>
  );
}

function SyncFooter() {
  const status = useSyncStatus();
  const label = syncLabel(status);
  const dot =
    status.state === "syncing" ? "bg-ember" : status.state === "idle" && status.pending === 0 ? "bg-jade" : "bg-muted";
  return (
    <p className="flex items-center gap-2 px-3 text-sm text-muted" role="status" aria-live="polite">
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{label}</span>
    </p>
  );
}

export function Shell() {
  const mod = platform.isMac() ? "⌘" : "Ctrl";
  return (
    <AuthGate>
      <ToastProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-ink-2 focus:p-3">
          Skip to content
        </a>
        <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
          <aside className="border-b border-line bg-ink-2 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-b-0 md:border-r">
            <div className="flex items-center gap-3 px-4 py-4">
              <LogoMark size={28} />
              <span className="font-semibold">Tatakae</span>
            </div>
            <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
              {NAV.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} className={linkClass}>
                  <Icon size={20} />
                  <span>{label}</span>
                  {to === "/inbox" && <InboxCount />}
                </NavLink>
              ))}
              <div className="md:mt-2">
                <p id="nav-review" className="hidden px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted md:block">
                  Review
                </p>
                <ul aria-labelledby="nav-review" className="flex gap-1 md:flex-col">
                  <li>
                    <NavLink to="/review/week" className={linkClass}>
                      <ChartIcon size={20} />
                      <span>Week</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/review/month" className={linkClass}>
                      <ChartIcon size={20} />
                      <span>Month</span>
                    </NavLink>
                  </li>
                </ul>
              </div>
              <div className="flex gap-1 md:mt-2 md:flex-col">
                {NAV_AFTER.map(({ to, label, Icon }) => (
                  <NavLink key={to} to={to} className={linkClass}>
                    <Icon size={20} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </nav>
            <div className="hidden space-y-2 border-t border-line p-2 md:block">
              <button type="button" onClick={openCommandPalette} className="btn-ghost w-full justify-start text-muted">
                <CommandIcon size={18} />
                <span className="flex-1 text-left">Search or capture</span>
                <span className="kbd">{mod} K</span>
              </button>
              <SyncFooter />
            </div>
          </aside>

          <main id="main" className="min-w-0 px-4 py-6 md:px-10 md:py-10">
            <InstallBanner />
            <Outlet />
            <div className="mt-10 md:hidden">
              <SyncFooter />
            </div>
          </main>
        </div>
        <CommandPalette />
      </ToastProvider>
    </AuthGate>
  );
}
