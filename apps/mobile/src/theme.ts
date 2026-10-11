/** Same tokens as apps/web/tailwind.config.js. Misses grey, never red. Min target 44dp. */
export const colors = {
  ink: "#0b0b0f",
  paper: "#ececf1",
  muted: "#8a8a96",
  ember: "#f2a33a",
  jade: "#4fbf8f",
} as const;
export const minTarget = 44;
export const space = (n: number) => n * 8;
