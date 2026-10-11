import { z } from "zod";

/** All config comes from environment variables (deploy/.env on the VM). */
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8787),
  DATABASE_PATH: z.string().default("./data/tatakae.db"),
  FILES_DIR: z.string().default("./data/files"),
  PUBLIC_ORIGIN: z.string().url().default("http://localhost:5173"),
  TZ: z.string().default("Asia/Kolkata"),

  // Auth (single user)
  OWNER_EMAIL: z.string().email(),
  OWNER_PASSWORD_HASH: z.string(),          // argon2id, generate with deploy/scripts/hash-password.sh
  SESSION_SECRET: z.string().min(32),
  SESSION_DAYS: z.coerce.number().default(90),
  API_TOKEN: z.string().min(32).optional(), // bearer token for scripts (notion import)
  DEV_BYPASS_AUTH: z.enum(["0", "1"]).default("0"),

  // Off-box backups: OCI Object Storage (S3-compatible) or any S3 endpoint
  S3_ENDPOINT: z.string().url().optional(), // https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Web push (v4)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // TODO(phase0): pretty-print missing vars and exit(1)
  return schema.parse(source);
}

export type AppBindings = { Variables: { env: Env; email: string } };
