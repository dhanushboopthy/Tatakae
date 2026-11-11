import type { TextStyle } from "react-native";

/**
 * "Soft Bento" design system — mirrors apps/web/tailwind.config.js. See docs/10-design-system.md.
 * Light by day; dark from ritual time to wake time (and always in Quick close after ritual time).
 * Text on lime/lavender/pastels is ALWAYS ink (`onFill`). Chart marks use *Deep. No red except destructive.
 * Screens read the active palette through `useTheme()` / `useStyles()` in src/lib/theme.tsx.
 */
const shared = {
  charcoal: "#262626",
  lime: "#CDE37A",
  limeSoft: "#EEF5D3",
  limeDeep: "#7E9A1E",
  lavender: "#A9A3DB",
  lavenderSoft: "#E9E7F8",
  lavenderDeep: "#6E66B8",
  area: { sage: "#A3B56B", rose: "#F7A8D3", butter: "#F4D978", sky: "#B9CBF0" },
  danger: "#C2410C",
  butter: "#F4D978",
  butterDeep: "#B38F12",
  /** Text and icons on every pastel / lime / lavender fill, in both themes (docs/10 §2 accessibility). */
  onFill: "#1C1C1E",
  /** Secondary text on pastel fills (8.8:1 on rose, 8.6:1 on lime-soft). */
  onFillMuted: "#4A4A50",
  white: "#FFFFFF",
  /** Darker rose for the tag pill on the rose fitness card. */
  roseDeep: "#E57FB8",
  /** Faint ink edge so white chips still show on white cards. */
  chipEdge: "rgba(28,28,30,0.16)",
  /** Bar track on a pastel card. */
  onFillTrack: "rgba(255,255,255,0.6)",
} as const;

export const light = {
  ...shared,
  canvas: "#F1F1EF",
  surface: "#FFFFFF",
  surface2: "#F4F4F2",
  line: "#E6E6E3",
  ink: "#1C1C1E",
  ink2: "#66666B",
  missed: "#8A8A90",
  /** P1 hero card: charcoal by day. */
  hero: "#262626",
  onHero: "#FFFFFF",
  onHeroMuted: "#B8B8BE",
  heroLine: "#4A4A4F",
  /** Floating bottom nav. */
  nav: "#262626",
  navIcon: "#B8B8BE",
  scrim: "rgba(28,28,30,0.4)",
} as const;

export const dark = {
  ...shared,
  canvas: "#0E0E10",
  surface: "#1B1B1F",
  surface2: "#25252A",
  line: "#2F2F35",
  ink: "#ECECF1",
  ink2: "#A1A1AA",
  missed: "#74747C",
  /** Charcoal becomes a light inverted card at night (docs/10 §2). */
  hero: "#ECECF1",
  onHero: "#121214",
  onHeroMuted: "#4A4A50",
  heroLine: "#B8B8BE",
  nav: "#25252A",
  navIcon: "#A1A1AA",
  scrim: "rgba(0,0,0,0.6)",
} as const;

export type Palette = { [K in keyof typeof light]: (typeof light)[K] extends string ? string : (typeof light)[K] };

export const radius = { card: 28, inner: 20, pill: 999 } as const;
export const minTarget = 44;
export const iconCircle = 48;
export const space = (n: number) => n * 8;
export const floatShadow = { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 } as const;

/** Plus Jakarta Sans files loaded in app/_layout.tsx. Android needs one family per weight. */
export const fontFamily = {
  400: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
} as const;

export type Weight = keyof typeof fontFamily;

/** Font family + size (+ line height) for one weight. Never set fontWeight with a custom font on Android. */
export function f(weight: Weight, size: number, lineHeight?: number): TextStyle {
  return { fontFamily: fontFamily[weight], fontSize: size, ...(lineHeight ? { lineHeight } : {}) };
}
