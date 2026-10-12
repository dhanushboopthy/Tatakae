import { StyleSheet, type TextStyle } from "react-native";

/**
 * "Night forge" tokens, mirrored from docs/10-design-system.md (web: apps/web/tailwind.config.js).
 * Misses are grey, never red. `danger` only on the confirm step of destructive actions.
 * One accent (ember) per screen. Min target 44dp.
 */
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

export const radius = { control: 8, card: 12, pill: 999 } as const;
export const type = { p1: 30, h1: 24, h2: 18, body: 16, small: 14, timer: 72 } as const;
export const lineHeight = 1.5;
export const motion = { fast: 120, base: 160, slow: 200 } as const;

export const minTarget = 44;
/** 8-pt grid: space(1) = 8, space(2) = 16 … */
export const space = (n: number): number => n * 8;

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
    borderRadius: radius.card,
    padding: space(2),
    gap: space(1),
  },
  input: {
    minHeight: minTarget + 4,
    backgroundColor: colors.ink3,
    borderColor: colors.lineStrong,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space(1.5),
    paddingVertical: space(1),
    color: colors.paper,
    fontSize: type.body,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space(1) },
  link: { minHeight: minTarget, justifyContent: "center", paddingHorizontal: space(1) },
  linkText: { color: colors.paper, fontSize: type.body, textDecorationLine: "underline" },
});
