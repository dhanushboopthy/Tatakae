import { z } from "zod";
import type { Db } from "./lib/db";

/** All config comes from environment variables (deploy/.env on the VM). */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8787),
    DATABASE_PATH: z.string().min(1).default("./data/tatakae.db"),
    /** Folder with drizzle migrations; defaults to the repo's db/migrations (found from this file). */
    MIGRATIONS_DIR: z.string().min(1).optional(),
    FILES_DIR: z.string().default("./data/files"),
    PUBLIC_ORIGIN: z.string().url().default("http://localhost:5173"),
    TZ: z.string().default("Asia/Kolkata"),

    // Auth (single user)
    OWNER_EMAIL: z.string().email(),
    OWNER_PASSWORD_HASH: z.string().min(1), // argon2id, generate with deploy/scripts/hash-password.sh
    SESSION_SECRET: z.string().min(32),
    SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(90),
    API_TOKEN: z.string().min(32).optional(), // bearer token for scripts (curl, one-off maintenance)
    DEV_BYPASS_AUTH: z.enum(["0", "1"]).default("0"),
    // Passkeys (v4). Default: RP ID = PUBLIC_ORIGIN's host, allowed origin = PUBLIC_ORIGIN.
    // WEBAUTHN_ORIGINS is a comma-separated list, e.g. a second dev port.
    WEBAUTHN_RP_ID: z.string().min(1).optional(),
    WEBAUTHN_ORIGINS: z.string().min(1).optional(),

    // Idle-reclaim guard (see cron/keepWarm.ts). Kept a no-op on purpose.
    KEEP_WARM: z.enum(["0", "1"]).default("0"),

    // Off-box backups: OCI Object Storage (S3-compatible) or any S3 endpoint
    S3_ENDPOINT: z.string().url().optional(), // https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    // Nightly JSON backup: local copies (newest 7) live here; defaults to <DATABASE_PATH dir>/backups.
    BACKUP_DIR: z.string().min(1).optional(),

    // Phone update check (GET /api/app/version, public). The phone warns, never blocks.
    MIN_MOBILE_VERSION: z.string().regex(/^\d+\.\d+\.\d+$/).default("0.1.0"),
    LATEST_APK_URL: z.string().url().optional(),

    // Web push (v4)
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== "production") return;
    if (!e.OWNER_PASSWORD_HASH.startsWith("$argon2")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OWNER_PASSWORD_HASH"],
        message: "must be an argon2 hash (run deploy/scripts/hash-password.sh; single-quote it in .env)",
      });
    }
    if (e.SESSION_SECRET === DEV_DEFAULTS.SESSION_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SESSION_SECRET"], message: "dev default is not allowed in production" });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Filled in only when NODE_ENV=development so `pnpm dev` starts without a .env.
 * The dev password hash is empty-ish on purpose: login fails until OWNER_PASSWORD_HASH is set
 * (or use DEV_BYPASS_AUTH=1).
 */
const DEV_DEFAULTS = {
  OWNER_EMAIL: "owner@example.com",
  OWNER_PASSWORD_HASH: "unset",
  SESSION_SECRET: "dev-only-session-secret-0000000000000000",
} as const;

/** Parse env without side effects (tests use this). */
export function parseEnv(
  source: Record<string, string | undefined>,
): { ok: true; env: Env } | { ok: false; message: string } {
  const nodeEnv = source["NODE_ENV"] ?? "development";
  const input: Record<string, string | undefined> = { ...source };
  if (nodeEnv === "development") {
    for (const [k, v] of Object.entries(DEV_DEFAULTS)) {
      if (input[k] === undefined || input[k] === "") input[k] = v;
    }
  }
  // Empty strings in .env files mean "not set".
  for (const k of Object.keys(input)) if (input[k] === "") input[k] = undefined;

  const res = envSchema.safeParse(input);
  if (res.success) return { ok: true, env: res.data };
  const lines = res.error.issues.map((i) => {
    const key = i.path.join(".") || "(env)";
    const missing = i.code === z.ZodIssueCode.invalid_type && i.received === "undefined";
    return `  - ${key}: ${missing ? "missing" : i.message}`;
  });
  return { ok: false, message: `Invalid environment (NODE_ENV=${nodeEnv}):\n${lines.join("\n")}` };
}

/** Parse env or print every missing/invalid variable and exit(1). */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const res = parseEnv(source);
  if (!res.ok) {
    console.error(res.message);
    console.error("Set these in /opt/tatakae/.env (production) or your shell (development).");
    process.exit(1);
  }
  return res.env;
}

/** The authenticated session; null for API_TOKEN scripts and DEV_BYPASS_AUTH. */
export interface SessionInfo {
  id: string;
  client: "web" | "mobile";
  deviceName: string;
  expiresAt: string;
}

export type AppBindings = {
  Variables: {
    env: Env;
    db: Db;
    session: SessionInfo | null;
    email: string;
  };
};
