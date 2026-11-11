import { api, isNetworkError, statusOf } from "./api";

// Step-up re-auth (security S8): confirm the password, or a passkey, on the current session. The API
// then allows sensitive calls for 10 minutes. A wrong answer is 403, so the session is never lost.

export type ReauthResult = { ok: true } | { ok: false; reason: "wrong" | "cancelled" | "rate-limited" | "offline" | "server" };

function failure(e: unknown): ReauthResult {
  const status = statusOf(e);
  if (status === 403 || status === 400) return { ok: false, reason: "wrong" };
  if (status === 429) return { ok: false, reason: "rate-limited" };
  if (isNetworkError(e)) return { ok: false, reason: "offline" };
  return { ok: false, reason: "server" };
}

export async function confirmWithPassword(password: string): Promise<ReauthResult> {
  try {
    await api("/session/reauth", { method: "POST", body: { password }, skipReauth: true });
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function confirmWithPasskey(): Promise<ReauthResult> {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  try {
    const optionsJSON = (await api("/passkeys/reauth/options", { method: "POST", body: {}, skipReauth: true })) as Parameters<
      typeof startAuthentication
    >[0]["optionsJSON"];
    let response;
    try {
      response = await startAuthentication({ optionsJSON });
    } catch {
      return { ok: false, reason: "cancelled" };
    }
    await api("/passkeys/reauth", { method: "POST", body: { response }, skipReauth: true });
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export const reauthProblemText: Record<Exclude<ReauthResult, { ok: true }>["reason"], string> = {
  wrong: "That didn't match. Try again.",
  cancelled: "No passkey used. Try again, or type your password.",
  "rate-limited": "Too many tries. Wait a few minutes, then try again.",
  offline: "This needs a connection. Try again when you're online.",
  server: "Couldn't check it right now. Try again in a moment.",
};
