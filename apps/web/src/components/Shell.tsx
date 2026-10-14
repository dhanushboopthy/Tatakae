import type { ComponentType } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { syncLabel, useInbox, useNow, useRunningFocus, useSettings, useSyncStatus } from "../lib/hooks";
import { platform } from "../lib/platform";
import { useThemeController } from "../lib/theme";
import { AuthGate } from "./AuthGate";
import { CaptureDialog } from "./CaptureDialog";
import { CommandPalette, openCommandPalette } from "./CommandPalette";
import { ConflictNoticeHost } from "./ConflictNotice";
import {
  CalendarIcon,
  ChartIcon,
  CycleIcon,
  FocusIcon,
  InboxIcon,
  LogoMark,
  MoonIcon,
  NoteIcon,
  PlayIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  type IconProps,
} from "./icons";
import { InstallBanner } from "./InstallBanner";
import { StoryToastHost } from "./StoryToast";
import { ToastProvider } from "./Toast";

/**
 * Laptop layout (docs/10 §6, ref 05/06): a left icon rail of 48 px circles (active = lime), the
 * command palette and sync status at the bottom. Narrow windows get a top bar with icon + label pills.
 * Cmd/Ctrl+K opens the palette everywhere. The theme follows ritual/wake time (lib/theme).
 */

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<IconProps>;
  /** Path prefixes that mark the item active (defaults to `to`). */
  match?: readonly string[];
}

const NAV: readonly NavItem[] = [
  { to: "/today", label: "Today", Icon: SunIcon },
  { to: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { to: "/focus", label: "Focus timer", Icon: FocusIcon },
  { to: "/ritual", label: "Night ritual", Icon: MoonIcon },
  { to: "/inbox", label: "Inbox", Icon: InboxIcon },
  { to: "/review/week", label: "Review", Icon: ChartIcon, match: ["/review"] },
  { to: "/cycle", label: "Cycle", Icon: CycleIcon },
  { to: "/notes", label: "Notes", Icon: NoteIcon, match: ["/notes", "/applications", "/stories", "/japanese"] },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

function InboxBadge({ compact }: { compact?: boolean }) {
  const { data } = useInbox();
  const n = data?.length ?? 0;
  if (n === 0) return null;
  return (
    <span
      className={`tnum flex min-w-[20px] items-center justify-center rounded-full bg-lavender px-1.5 text-[11px] font-bold text-on-accent ${
        compact ? "absolute -right-0.5 -top-0.5 h-5" : "h-5"
      }`}
    >
      {n}
      <span className="sr-only"> unprocessed</span>
    </span>
  );
}

/** Shown on the Focus item while a session is running (shape + screen-reader text, not colour alone). */
function FocusRunning({ compact }: { compact?: boolean }) {
  const { data: running } = useRunningFocus();
  if (!running) return null;
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-lime-deep text-white ${compact ? "absolute -right-0.5 -top-0.5 h-5 w-5" : "h-5 w-5"}`}
      title="A focus session is running"
    >
      <PlayIcon size={10} fill="currentColor" />
      <span className="sr-only"> (running)</span>
    </span>
  );
}

function SyncDot() {
  const status = useSyncStatus();
  const label = syncLabel(status);
  const ok = status.state === "idle" && status.pending === 0 && !status.error;
  const tone = status.state === "syncing" ? "bg-lavender" : ok ? "bg-lime-deep" : "bg-missed";
  return (
    <p className="group relative flex h-12 w-12 items-center justify-center" role="status" aria-live="polite" title={label}>
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      <span className="sr-only">{label}</span>
      <Tooltip text={label} />
    </p>
  );
}

function SyncLine() {
  const status = useSyncStatus();
  return (
    <p className="text-sm text-ink-2" role="status" aria-live="polite">
      {syncLabel(status)}
    </p>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-40 -translate-y-1/2 whitespace-nowrap rounded-full bg-charcoal px-3 py-1.5 text-xs font-semibold text-on-charcoal opacity-0 shadow-float transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {text}
    </span>
  );
}

function useIsActive(item: NavItem): boolean {
  const { pathname } = useLocation();
  return (item.match ?? [item.to]).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function RailLink({ item }: { item: NavItem }) {
  const active = useIsActive(item);
  const { Icon } = item;
  return (
    <NavLink
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-12 w-12 items-center justify-center rounded-full transition duration-fast ease-out ${
        active ? "bg-lime text-on-accent" : "bg-surface-2 text-ink hover:bg-line"
      }`}
    >
      <Icon size={22} />
      <span className="sr-only">{item.label}</span>
      {item.to === "/inbox" && <InboxBadge compact />}
      {item.to === "/focus" && <FocusRunning compact />}
      <Tooltip text={item.label} />
    </NavLink>
  );
}

function TopLink({ item }: { item: NavItem }) {
  const active = useIsActive(item);
  const { Icon } = item;
  return (
    <NavLink
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`chip shrink-0 ${active ? "bg-lime text-on-accent" : "bg-surface-2 font-medium text-ink"}`}
    >
      <Icon size={18} />
      {item.label}
      {item.to === "/inbox" && <InboxBadge />}
      {item.to === "/focus" && <FocusRunning />}
    </NavLink>
  );
}

function ThemeController() {
  const { data: settings } = useSettings();
  const now = useNow();
  useThemeController({ ritualTime: settings?.ritual_time ?? "21:30", wakeTime: settings?.wake_time ?? "06:30", now });
  return null;
}

export function Shell() {
  const mod = platform.isMac() ? "⌘" : "Ctrl";
  return (
    <AuthGate>
      <ToastProvider>
        <ThemeController />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-charcoal focus:px-4 focus:py-3 focus:text-on-charcoal"
        >
          Skip to content
        </a>
        <div className="min-h-screen md:grid md:grid-cols-[88px_1fr]">
          {/* Rail (md+) */}
          <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:flex-col md:items-center md:gap-3 md:py-6">
            <NavLink to="/today" className="mb-4 rounded-[14px]" aria-label="Tatakae, go to Today">
              <LogoMark size={48} />
            </NavLink>
            <nav aria-label="Main" className="flex flex-1 flex-col items-center gap-3">
              {NAV.map((item) => (
                <RailLink key={item.to} item={item} />
              ))}
            </nav>
            <button type="button" onClick={openCommandPalette} className="icon-btn group relative" aria-keyshortcuts="Control+K Meta+K">
              <SearchIcon size={22} />
              <span className="sr-only">Search or capture ({mod} K)</span>
              <Tooltip text={`Search or capture · ${mod} K`} />
            </button>
            <SyncDot />
          </aside>

          {/* Top bar (narrow) */}
          <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur md:hidden">
            <div className="flex items-center gap-3 px-4 pt-3">
              <LogoMark size={36} />
              <span className="flex-1 font-semibold">Tatakae</span>
              <button type="button" onClick={openCommandPalette} className="icon-btn-sm" aria-label="Search or capture">
                <SearchIcon />
              </button>
            </div>
            {/* relative: the chips' absolutely positioned sr-only text must be clipped by this scroller, not widen the page */}
            <nav aria-label="Main" className="relative flex gap-2 overflow-x-auto px-4 py-3">
              {NAV.map((item) => (
                <TopLink key={item.to} item={item} />
              ))}
            </nav>
          </header>

          <main id="main" className="min-w-0 px-4 py-6 md:px-8 md:py-8 lg:px-10">
            <InstallBanner />
            <Outlet />
            <div className="mt-10 md:hidden">
              <SyncLine />
            </div>
          </main>
        </div>
        <CommandPalette />
        <CaptureDialog />
        <StoryToastHost />
        <ConflictNoticeHost />
      </ToastProvider>
    </AuthGate>
  );
}
