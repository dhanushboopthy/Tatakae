/** "Soft Bento" design system — see docs/10-design-system.md. Light by day, dark (class) from ritual time.
 *  Tokens are CSS variables (src/index.css) so `.dark` swaps them; constant accents are plain hex.
 *  Text on lime/lavender/pastels is ALWAYS `text-on-accent` (ink). Chart marks use *-deep. No red except destructive. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: { DEFAULT: v("canvas"), cream: v("canvas-cream") },
        surface: { DEFAULT: v("surface"), 2: v("surface-2") },
        line: v("line"),
        ink: { DEFAULT: v("ink"), 2: v("ink-2") },
        charcoal: { DEFAULT: v("charcoal"), line: v("charcoal-line") },
        "on-charcoal": { DEFAULT: v("on-charcoal"), 2: v("on-charcoal-2") },
        "on-accent": "#1C1C1E",
        lime: { DEFAULT: "#CDE37A", soft: v("lime-soft"), deep: "#7E9A1E" },
        lavender: { DEFAULT: "#A9A3DB", soft: v("lavender-soft"), deep: "#6E66B8", hatch: "#C8C3EA" },
        missed: v("missed"),
        butter: { band: "#C9A227" }, // stripe trend 120–180 band (3:1 on white)
        area: {
          sage: "#A3B56B",
          rose: "#F7A8D3",
          butter: "#F4D978",
          sky: "#B9CBF0",
          "sage-deep": "#6E7F35",
          "rose-deep": "#C2508F",
          "butter-deep": "#B38F12",
          "sky-deep": "#4E6FB5",
        },
        danger: v("danger"), // destructive actions only
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        hero: ["4rem", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "600" }],
        "hero-sm": ["3.5rem", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "600" }],
        title: ["2.5rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "500" }],
        "title-sm": ["2rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "600" }],
        p1: ["1.875rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        timer: ["5.5rem", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "600" }],
      },
      borderRadius: {
        card: "28px",
        "card-inner": "20px",
        field: "16px",
      },
      boxShadow: {
        float: "0 8px 24px rgba(0,0,0,.12)",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { rise: "rise 220ms cubic-bezier(0.2, 0, 0, 1)" },
      transitionDuration: { fast: "150ms", base: "180ms", slow: "220ms" },
      transitionTimingFunction: { out: "cubic-bezier(0.2, 0, 0, 1)" },
      minHeight: { tap: "44px" },
      minWidth: { tap: "44px" },
      maxWidth: { read: "720px", wide: "960px", dash: "1360px" },
    },
  },
};
