/** "Soft Bento" design system — see docs/10-design-system.md. Light by day, dark (class) from ritual time.
 *  Text on lime/lavender/pastels is ALWAYS ink. Chart marks use *-deep. No red except destructive. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: { DEFAULT: "#F1F1EF", cream: "#FAF4E8", dark: "#0E0E10" },
        surface: { DEFAULT: "#FFFFFF", 2: "#F4F4F2", dark: "#1B1B1F", "2-dark": "#25252A" },
        line: { DEFAULT: "#E6E6E3", dark: "#2F2F35" },
        ink: { DEFAULT: "#1C1C1E", 2: "#66666B", dark: "#ECECF1", "2-dark": "#A1A1AA" },
        charcoal: "#262626",
        lime: { DEFAULT: "#CDE37A", soft: "#EEF5D3", deep: "#7E9A1E" },
        lavender: { DEFAULT: "#A9A3DB", soft: "#E9E7F8", deep: "#6E66B8" },
        missed: { DEFAULT: "#8A8A90", dark: "#74747C" },
        area: { sage: "#A3B56B", rose: "#F7A8D3", butter: "#F4D978", sky: "#B9CBF0" },
        danger: "#C2410C", // destructive actions only

        // LEGACY ("Night forge", docs/design/legacy-night-forge.md): the dark tokens the overnight v1 screens use,
        // as `*-legacy-*` classes. Don't use in new code; remove once those screens move to Soft Bento in v1.
        legacy: {
          ink: { DEFAULT: "#0b0b0f", 2: "#14141a", 3: "#1c1c24" },
          line: { DEFAULT: "#2a2a33", strong: "#6a6a76" },
          paper: "#ececf1",
          muted: "#8a8a96",
          ember: { DEFAULT: "#f2a33a", soft: "#2e2215" },
          jade: { DEFAULT: "#4fbf8f", soft: "#152622" },
          danger: "#d9776f",
          ritual: { DEFAULT: "#120f0c", 2: "#1a1612" },
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        hero: ["4rem", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "600" }],
        title: ["2.5rem", { lineHeight: "1.15", fontWeight: "600" }],
        // legacy screens
        p1: ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        timer: ["4.5rem", { lineHeight: "1", fontWeight: "600" }],
      },
      borderRadius: {
        card: "24px",
        "card-inner": "20px",
        // legacy screens
        control: "8px",
        "legacy-card": "12px",
      },
      boxShadow: {
        float: "0 8px 24px rgba(0,0,0,.12)",
        overlay: "0 12px 32px rgb(0 0 0 / 0.55)", // legacy screens
      },
      transitionDuration: { fast: "120ms", base: "160ms", slow: "200ms" },
      transitionTimingFunction: { out: "cubic-bezier(0.2, 0, 0, 1)" },
      minHeight: { tap: "44px" },
      minWidth: { tap: "44px" },
      maxWidth: { read: "720px", wide: "960px" },
    },
  },
};
