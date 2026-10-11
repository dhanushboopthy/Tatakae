/** localStorage / sessionStorage that never throws (private mode, quota, disabled storage). */
function wrap(get: () => Storage | undefined) {
  return {
    get(key: string): string | null {
      try {
        return get()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key: string, value: string): void {
      try {
        get()?.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    remove(key: string): void {
      try {
        get()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    /** JSON helpers; returns `fallback` on missing or malformed values. */
    getJson<T>(key: string, fallback: T): T {
      const raw = this.get(key);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    setJson(key: string, value: unknown): void {
      this.set(key, JSON.stringify(value));
    },
  };
}

export const storage = wrap(() => (typeof localStorage === "undefined" ? undefined : localStorage));
export const sessionStore = wrap(() => (typeof sessionStorage === "undefined" ? undefined : sessionStorage));
