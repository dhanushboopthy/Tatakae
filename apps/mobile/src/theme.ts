import { StyleSheet, type TextStyle } from "react-native";

/**
 * "Soft Bento" design system — mirrors apps/web/tailwind.config.js. See docs/10-design-system.md.
 * Light by day; dark from ritual time to wake time (and always in Quick close after ritual time).
 * Text on lime/lavender/pastels is ALWAYS ink. Chart marks use *Deep. No red except destructive.
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
  /** Text and icons on every pastel / lime / lavender fill, in both themes (docs/10 §2 accessibility). */
  onFill: "#1C1C1E",
  /** Secondary text on pastel fills (8.8:1 on rose, 8.6:1 on lime-soft). */
  onFillMuted: "#4A4A50",
  white: "#FFFFFF",
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
export const font = { family: "PlusJakartaSans", hero: 64, title: 32, card: 24, body: 16, label: 14, micro: 12 } as const;
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

// ───────────────────────────── LEGACY ("Night forge") ─────────────────────────────
// Dark tokens the overnight v1 screens were built with (spec: docs/design/legacy-night-forge.md).
// Kept only so those screens compile and look unchanged until they are restyled to Soft Bento in v1.
// Don't use in new code; delete this block once nothing imports it.

export const colors = {
  ink: "#0b0b0f",
  ink2: "#14141a",
  ink3: "#1c1c24",
  line: "#2a2a33", // decorative only
  lineStrong: "#6a6a76", // control boundaries (inputs, chip outlines)
  paper: "#ececf1",
  muted: "#8a8a96",
  ember: "#f2a33a",
  emberSoft: "#2e2215",
  jade: "#4fbf8f",
  jadeSoft: "#152622",
  danger: "#d9776f",
  ritual: "#120f0c",
  ritual2: "#1a1612",
  backdrop: "rgba(0,0,0,0.6)",
} as const;

export const legacyRadius = { control: 8, card: 12, pill: 999 } as const;
export const type = { p1: 30, h1: 24, h2: 18, body: 16, small: 14, timer: 72 } as const;
export const lineHeight = 1.5;
export const motion = { fast: 120, base: 160, slow: 200 } as const;

/** Tabular figures for anything that changes (timers, counts, minutes). */
export const tnum: TextStyle = { fontVariant: ["tabular-nums"] };

export const text = StyleSheet.create({
  body: { color: colors.paper, fontSize: type.body, lineHeight: type.body * lineHeight },
  small: { color: colors.muted, fontSize: type.small, lineHeight: type.small * 1.43 },
  h1: { color: colors.paper, fontSize: type.h1, lineHeight: 32, fontWeight: "600" },
  h2: { color: colors.paper, fontSize: type.h2, lineHeight: 28, fontWeight: "600" },
  p1: { color: colors.paper, fontSize: type.p1, lineHeight: 36, fontWeight: "600", letterSpacing: -0.3 },
  label: { color: colors.muted, fontSize: type.small, lineHeight: 20, fontWeight: "500" },
});

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { paddingHorizontal: space(2), paddingBottom: space(4), gap: space(2) },
  card: {
    backgroundColor: colors.ink2,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: legacyRadius.card,
    padding: space(2),
    gap: space(1),
  },
  input: {
    minHeight: minTarget + 4,
    backgroundColor: colors.ink3,
    borderColor: colors.lineStrong,
    borderWidth: 1,
    borderRadius: legacyRadius.control,
    paddingHorizontal: space(1.5),
    paddingVertical: space(1),
    color: colors.paper,
    fontSize: type.body,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space(1) },
  link: { minHeight: minTarget, justifyContent: "center", paddingHorizontal: space(1) },
  linkText: { color: colors.paper, fontSize: type.body, textDecorationLine: "underline" },
});
