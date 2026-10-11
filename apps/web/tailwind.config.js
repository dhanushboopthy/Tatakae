/** Dark-first palette. Misses are grey, never red. Check contrast: text 4.5:1, UI 3:1. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#0b0b0f",
        paper: "#ececf1",
        muted: "#8a8a96",   // missed / grey states
        ember: "#f2a33a",   // primary action
        jade: "#4fbf8f",    // done
      },
      minHeight: { tap: "44px" },
      minWidth: { tap: "44px" },
    },
  },
};
