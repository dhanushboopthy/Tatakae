import { useQuery, type QueryClient } from "@tanstack/react-query";
import { passkeyList, passkeySummary, type PasskeySummary } from "@tatakae/core";
import { api } from "./api";

// Settings → Passkeys (v4). Online-only REST, like Devices: passkeys are not synced. Signing in with a
// passkey lives in lib/session.ts (loginWithPasskey).

const KEY = ["rest", "passkeys"] as const;

export function usePasskeys() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<PasskeySummary[]> => passkeyList.parse(await api("/passkeys")).passkeys,
    staleTime: 0,
  });
}

/**
 * Whether this browser can create and use passkeys at all (the same check as simplewebauthn's
 * browserSupportsWebAuthn, done synchronously so the login screen doesn't shift when it resolves).
 */
export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
}

export class PasskeyCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "PasskeyCancelled";
  }
}

/** Create a passkey on this device (the browser asks for a fingerprint, face or PIN) and save it. */
export async function addPasskey(qc: QueryClient, name: string): Promise<PasskeySummary> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const optionsJSON = (await api("/passkeys/register/options", { method: "POST", body: {} })) as Parameters<typeof startRegistration>[0]["optionsJSON"];
  let response;
  try {
    response = await startRegistration({ optionsJSON });
  } catch {
    throw new PasskeyCancelled(); // closed the sheet, or this device already has one (excluded)
  }
  const saved = passkeySummary.parse(await api("/passkeys", { method: "POST", body: { response, name: name.trim() } }));
  await qc.invalidateQueries({ queryKey: KEY });
  return saved;
}

export async function renamePasskey(qc: QueryClient, id: string, name: string): Promise<void> {
  await api(`/passkeys/${encodeURIComponent(id)}`, { method: "PATCH", body: { name: name.trim() } });
  await qc.invalidateQueries({ queryKey: KEY });
}

export async function removePasskey(qc: QueryClient, id: string): Promise<void> {
  await api(`/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" });
  await qc.invalidateQueries({ queryKey: KEY });
}
