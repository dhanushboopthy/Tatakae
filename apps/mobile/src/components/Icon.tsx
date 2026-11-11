import {
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  Bell,
  Briefcase,
  CalendarDays,
  ChartColumn,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Contrast,
  CornerUpRight,
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
  Share2,
  Smartphone,
  Sparkles,
  Sun,
  Target,
  Timer,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react-native";
import type { IconKey } from "@tatakae/core";

/** One component per key of core ICONS (docs/11 §6), so web and phone use the same names. */
const CORE: Record<IconKey, LucideIcon> = {
  today: Sun,
  calendar: CalendarDays,
  focus: Timer,
  capture: Plus,
  settings: Settings2,
  ritual: Moon,
  inbox: Inbox,
  review: ChartColumn,
  cycle: Target,
  notes: NotebookPen,
  open: ArrowUpRight,
  reminders: Bell,
  search: Search,
  done: Check,
  minimum: Contrast,
  missed: Minus,
  reschedule: CornerUpRight,
  stuck: LifeBuoy,
  recharge: BatteryCharging,
  habit: Repeat,
  screen: Smartphone,
  locked: Lock,
  rest: Coffee,
  writeOff: Feather,
  story: Sparkles,
  areaCareer: Server,
  areaHealth: Dumbbell,
  areaJapanese: Languages,
  areaFreelance: Briefcase,
};

/** Phone-only controls that core ICONS doesn't name. */
const EXTRA = {
  close: X,
  back: ChevronLeft,
  forward: ChevronRight,
  start: ArrowRight,
  play: Play,
  pause: Pause,
  share: Share2,
  offline: WifiOff,
  sync: RefreshCw,
  logout: LogOut,
  edit: Pencil,
  info: Info,
} satisfies Record<string, LucideIcon>;

export type AppIcon = IconKey | keyof typeof EXTRA;

const ALL: Record<AppIcon, LucideIcon> = { ...CORE, ...EXTRA };

/** Lucide line icon, 1.75 stroke, 22 by default. Decorative: the control around it carries the label. */
export function Icon({ name, size = 22, color, strokeWidth = 1.75 }: { name: AppIcon; size?: number; color: string; strokeWidth?: number }) {
  const Glyph = ALL[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} accessibilityElementsHidden importantForAccessibility="no" />;
}
