import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import type { PasskeyAuthenticationResponse, PasskeyRegistrationResponse, PasskeySummary } from "@tatakae/core";
import { passkeys } from "../../../../db/schema";
import type { Env } from "../env";
import type { Db } from "./db";
import { BadRequest, NotFound, Unauthorized } from "./errors";

// Passkeys (v4, R2-12 / R3-8): WebAuthn login for the website, password login stays as the fallback.
// One user, so every passkey belongs to the owner. Challenges are one-time, kept in memory for
// 5 minutes (one process, like the login rate limiter). Never synced; part of the nightly export.

export type PasskeyRow = typeof passkeys.$inferSelect;

const RP_NAME = "Tatakae";
const CHALLENGE_TTL_MS = 5 * 60_000;
export const MAX_PASSKEYS = 10;

/** RP ID and allowed origins: WEBAUTHN_* when set, else PUBLIC_ORIGIN's host / PUBLIC_ORIGIN. */
export function webauthnConfig(env: Env): { rpID: string; origins: string[] } {
  const origins = env.WEBAUTHN_ORIGINS
    ? env.WEBAUTHN_ORIGINS.split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean)
    : [env.PUBLIC_ORIGIN.replace(/\/$/, "")];
  return { rpID: env.WEBAUTHN_RP_ID ?? new URL(env.PUBLIC_ORIGIN).hostname, origins };
}

type ChallengeKind = "register" | "login";

/** One-time WebAuthn challenges. `take` consumes a challenge, so a response can't be replayed. */
export function createChallengeStore(now: () => number = Date.now) {
  const open = new Map<string, { kind: ChallengeKind; expires: number }>();
  return {
    add(challenge: string, kind: ChallengeKind): void {
      const t = now();
      for (const [k, v] of open) if (v.expires <= t) open.delete(k);
      open.set(challenge, { kind, expires: t + CHALLENGE_TTL_MS });
    },
    take(challenge: string, kind: ChallengeKind): boolean {
      const entry = open.get(challenge);
      open.delete(challenge);
      return !!entry && entry.kind === kind && entry.expires > now();
    },
  };
}
export type ChallengeStore = ReturnType<typeof createChallengeStore>;

const toB64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(Buffer.from(s, "base64url"));

/** A stable WebAuthn user handle for the single owner (not the email itself). */
function userHandle(email: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(createHash("sha256").update(`tatakae:${email.trim().toLowerCase()}`).digest().subarray(0, 16));
}

export function listPasskeys(db: Db): PasskeyRow[] {
  return db
    .select()
    .from(passkeys)
    .where(isNull(passkeys.deletedAt))
    .all()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function toSummary(row: PasskeyRow): PasskeySummary {
  return { id: row.id, name: row.name, createdAt: row.createdAt, lastUsedAt: row.lastUsedAt, deviceType: row.deviceType, backedUp: row.backedUp };
}

function parseTransports(json: string | null): string[] | undefined {
  if (!json) return undefined;
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : undefined;
  } catch {
    return undefined;
  }
}

export async function registrationOptions(db: Db, env: Env, challenges: ChallengeStore): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = listPasskeys(db);
  if (existing.length >= MAX_PASSKEYS) throw new BadRequest(`Up to ${MAX_PASSKEYS} passkeys. Remove one first.`, "passkey_limit");
  const { rpID } = webauthnConfig(env);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: env.OWNER_EMAIL,
    userID: userHandle(env.OWNER_EMAIL),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: parseTransports(p.transports) })),
    // Discoverable, so sign-in needs no email; the device decides how to verify (fingerprint, PIN).
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  challenges.add(options.challenge, "register");
  return options;
}

export async function registerPasskey(
  db: Db,
  env: Env,
  challenges: ChallengeStore,
  input: { response: PasskeyRegistrationResponse; name: string },
  now: Date = new Date(),
): Promise<PasskeyRow> {
  const { rpID, origins } = webauthnConfig(env);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: input.response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: (c) => challenges.take(c, "register"),
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (e) {
    throw new BadRequest(`The passkey could not be checked: ${(e as Error).message}`, "passkey_invalid");
  }
  if (!verification.verified) throw new BadRequest("The passkey could not be checked.", "passkey_invalid");
  const info = verification.registrationInfo;
  const at = now.toISOString();
  const row: PasskeyRow = {
    id: info.credential.id,
    publicKey: toB64(info.credential.publicKey),
    counter: info.credential.counter,
    transports: info.credential.transports ? JSON.stringify(info.credential.transports) : null,
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
    name: input.name.trim(),
    createdAt: at,
    lastUsedAt: null,
    updatedAt: at,
    deletedAt: null,
  };
  // A removed passkey re-registered on the same device gets its row back.
  db.insert(passkeys).values(row).onConflictDoUpdate({ target: passkeys.id, set: row }).run();
  return row;
}

export async function loginOptions(env: Env, challenges: ChallengeStore): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = webauthnConfig(env);
  // No allowCredentials: the browser offers the owner's discoverable passkeys.
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
  challenges.add(options.challenge, "login");
  return options;
}

/** Verify a sign-in assertion and record its use. Any failure is a plain 401 (no detail leaks). */
export async function verifyPasskeyLogin(
  db: Db,
  env: Env,
  challenges: ChallengeStore,
  response: PasskeyAuthenticationResponse,
  now: Date = new Date(),
): Promise<PasskeyRow> {
  const fail = () => new Unauthorized("That passkey didn't work. Try again, or use your password.", "passkey_failed");
  const row = db
    .select()
    .from(passkeys)
    .where(and(eq(passkeys.id, response.id), isNull(passkeys.deletedAt)))
    .get();
  if (!row) {
    challenges.take(clientChallenge(response), "login"); // still consume it
    throw fail();
  }
  const { rpID, origins } = webauthnConfig(env);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: (c) => challenges.take(c, "login"),
      expectedOrigin: origins,
      expectedRPID: rpID,
      credential: { id: row.id, publicKey: fromB64(row.publicKey), counter: row.counter, transports: parseTransports(row.transports) },
      requireUserVerification: false,
    });
  } catch {
    throw fail();
  }
  if (!verification.verified) throw fail();
  const at = now.toISOString();
  const info = verification.authenticationInfo;
  db.update(passkeys)
    .set({ counter: info.newCounter, backedUp: info.credentialBackedUp, lastUsedAt: at, updatedAt: at })
    .where(eq(passkeys.id, row.id))
    .run();
  return { ...row, counter: info.newCounter, lastUsedAt: at };
}

/** The challenge inside clientDataJSON ("" if unreadable). */
function clientChallenge(response: PasskeyAuthenticationResponse): string {
  try {
    const data: unknown = JSON.parse(Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8"));
    return typeof data === "object" && data !== null && "challenge" in data && typeof data.challenge === "string" ? data.challenge : "";
  } catch {
    return "";
  }
}

export function renamePasskey(db: Db, id: string, name: string, now: Date = new Date()): PasskeyRow {
  const at = now.toISOString();
  const res = db
    .update(passkeys)
    .set({ name: name.trim(), updatedAt: at })
    .where(and(eq(passkeys.id, id), isNull(passkeys.deletedAt)))
    .run();
  if (res.changes === 0) throw new NotFound("No such passkey.");
  const row = db.select().from(passkeys).where(eq(passkeys.id, id)).get();
  if (!row) throw new NotFound("No such passkey.");
  return row;
}

/** Soft delete; the password still works, so removing the last passkey is fine. */
export function removePasskey(db: Db, id: string, now: Date = new Date()): void {
  const at = now.toISOString();
  const res = db
    .update(passkeys)
    .set({ deletedAt: at, updatedAt: at })
    .where(and(eq(passkeys.id, id), isNull(passkeys.deletedAt)))
    .run();
  if (res.changes === 0) throw new NotFound("No such passkey.");
}
