import type { ComponentType } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  Bell,
  Briefcase,
  CalendarDays,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleQuestionMark,
  Coffee,
  Command,
  Contrast,
  CornerUpRight,
  Download,
  Dumbbell,
  Feather,
  Inbox,
  Info,
  Languages,
  LifeBuoy,
  Lock,
  LogOut,
  Minus,
  Moon,
  NotebookPen,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Server,
  Settings2,
  Smartphone,
  Sparkles,
  Sun,
  Target,
  Timer,
  Trash,
  Upload,
  X,
  type LucideProps,
} from "lucide-react";
import { ICONS, type IconKey } from "@tatakae/core";

// Lucide line icons (docs/11 §6): 1.75 px stroke, decorative by default (aria-hidden). Always pair
// with a visible label or an aria-label on the control. Names follow core ICONS where one exists.

export type IconProps = Omit<LucideProps, "ref"> & { size?: number };
type Lucide = ComponentType<LucideProps>;

function wrap(L: Lucide) {
  const C = ({ size = 20, strokeWidth = 1.75, ...rest }: IconProps) => (
    <L size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...rest} />
  );
  return C;
}

// Navigation / meanings (core ICONS)
export const SunIcon = wrap(Sun);
export const CalendarIcon = wrap(CalendarDays);
export const FocusIcon = wrap(Timer);
export const PlusIcon = wrap(Plus);
export const SettingsIcon = wrap(Settings2);
export const MoonIcon = wrap(Moon);
export const InboxIcon = wrap(Inbox);
export const ChartIcon = wrap(ChartColumn);
export const CycleIcon = wrap(Target);
export const NoteIcon = wrap(NotebookPen);
export const OpenIcon = wrap(ArrowUpRight);
export const BellIcon = wrap(Bell);
export const SearchIcon = wrap(Search);
export const CheckIcon = wrap(Check);
export const MinimumIcon = wrap(Contrast);
export const DashIcon = wrap(Minus);
export const RescheduleIcon = wrap(CornerUpRight);
export const StuckIcon = wrap(LifeBuoy);
export const RechargeIcon = wrap(BatteryCharging);
export const HabitIcon = wrap(Repeat);
export const ScreenIcon = wrap(Smartphone);
export const LockIcon = wrap(Lock);
export const RestIcon = wrap(Coffee);
export const WriteOffIcon = wrap(Feather);
export const StoryIcon = wrap(Sparkles);

// Status marks (shape encodes the state, never colour alone)
export const DoneMarkIcon = CheckIcon;
export const HalfMarkIcon = MinimumIcon;
export const OpenMarkIcon = wrap(Circle);

// Controls
export const CommandIcon = wrap(Command);
export const CloseIcon = wrap(X);
export const PlayIcon = wrap(Play);
export const PauseIcon = wrap(Pause);
export const DownloadIcon = wrap(Download);
export const UploadIcon = wrap(Upload);
export const InfoIcon = wrap(Info);
export const PencilIcon = wrap(Pencil);
export const TrashIcon = wrap(Trash);
export const ArrowRightIcon = wrap(ArrowRight);
export const ArrowLeftIcon = wrap(ArrowLeft);
export const HelpIcon = wrap(CircleQuestionMark);
export const ChevronLeftIcon = wrap(ChevronLeft);
export const ChevronRightIcon = wrap(ChevronRight);
export const ChevronDownIcon = wrap(ChevronDown);
export const LogOutIcon = wrap(LogOut);
export const RefreshIcon = wrap(RefreshCw);

const BY_NAME: Record<(typeof ICONS)[IconKey], Lucide> = {
  Sun,
  CalendarDays,
  Timer,
  Plus,
  Settings2,
  Moon,
  Inbox,
  ChartColumn,
  Target,
  NotebookPen,
  ArrowUpRight,
  Bell,
  Search,
  Check,
  Contrast,
  Minus,
  CornerUpRight,
  LifeBuoy,
  BatteryCharging,
  Repeat,
  Smartphone,
  Lock,
  Coffee,
  Feather,
  Sparkles,
  Server,
  Dumbbell,
  Languages,
  Briefcase,
};

/** Icon by meaning (core ICONS key), e.g. <KeyIcon name="stuck" />. */
export function KeyIcon({ name, ...rest }: IconProps & { name: IconKey }) {
  const L = BY_NAME[ICONS[name]];
  return <L size={rest.size ?? 20} strokeWidth={rest.strokeWidth ?? 1.75} aria-hidden="true" focusable="false" {...rest} />;
}

/** Icon by lucide name stored on a row (areas.icon); falls back to a dot. */
export function NamedIcon({ name, ...rest }: IconProps & { name: string | null | undefined }) {
  const L = name && name in BY_NAME ? BY_NAME[name as keyof typeof BY_NAME] : Circle;
  return <L size={rest.size ?? 20} strokeWidth={rest.strokeWidth ?? 1.75} aria-hidden="true" focusable="false" {...rest} />;
}

/** App mark (docs/11 §6): charcoal tile, three rising rounded steps — P3, P2, P1. */
export const LogoMark = (p: { size?: number; className?: string }) => (
  <svg width={p.size ?? 40} height={p.size ?? 40} viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={p.className}>
    <rect width="48" height="48" rx="14" fill="#262626" />
    <rect x="12" y="26" width="7" height="10" rx="3.5" fill="#8A8A90" />
    <rect x="20.5" y="20" width="7" height="16" rx="3.5" fill="#A9A3DB" />
    <rect x="29" y="14" width="7" height="22" rx="3.5" fill="#CDE37A" />
  </svg>
);
