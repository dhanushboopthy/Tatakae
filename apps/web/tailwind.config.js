/**
 * "Night forge" tokens — see docs/10-design-system.md (contrast ratios computed there).
 * Dark-first. Misses are grey, never red; `danger` only on the confirm step of destructive actions.
 * Keep apps/mobile/src/theme.ts in sync (values listed in the doc).
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0b0b0f", 2: "#14141a", 3: "#1c1c24" },
        line: { DEFAULT: "#2a2a33", strong: "#6a6a76" },
        paper: "#ececf1",
        muted: "#8a8a96", // secondary text + missed / grey states (5.76:1 on ink)
        ember: { DEFAULT: "#f2a33a", soft: "#2e2215" }, // primary action, focus ring
        jade: { DEFAULT: "#4fbf8f", soft: "#152622" }, // done
        danger: "#d9776f", // destructive confirm only
        ritual: { DEFAULT: "#120f0c", 2: "#1a1612" }, // warmer, dimmer night ritual surfaces
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        p1: ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        timer: ["4.5rem", { lineHeight: "1", fontWeight: "600" }],
      },
      borderRadius: { control: "8px", card: "12px" },
      boxShadow: { overlay: "0 12px 32px rgb(0 0 0 / 0.55)" },
      transitionDuration: { fast: "120ms", base: "160ms", slow: "200ms" },
      transitionTimingFunction: { out: "cubic-bezier(0.2, 0, 0, 1)" },
      minHeight: { tap: "44px" },
      minWidth: { tap: "44px" },
      maxWidth: { read: "720px", wide: "960px" },
    },
  },
};
