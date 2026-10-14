import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogoMark, PasskeyIcon } from "../components/icons";
import { Kural } from "../components/Kural";
import { passkeysSupported } from "../lib/passkeys";
import { login, loginWithPasskey, rememberedDeviceName, type LoginResult, type PasskeyLoginResult } from "../lib/session";

// Phase 0.10 + v4. Passkey first (POST /api/passkeys/login), then email + password + device name
// (remembered) → POST /api/session/login {client: "web"} as the fallback. Browsers without WebAuthn
// see only the password form. The desktop install prompt is offered in the Shell after login.

const MESSAGES: Record<Exclude<LoginResult, { ok: true }>["reason"], string> = {
  credentials: "That email and password don't match. Try again.",
  "rate-limited": "Too many attempts. Wait a few minutes, then try again.",
  offline: "You're offline. Signing in needs a connection.",
  server: "The server didn't answer properly. Try again in a moment.",
};

const PASSKEY_MESSAGES: Record<Exclude<PasskeyLoginResult, { ok: true }>["reason"], string | null> = {
  cancelled: null, // closing the sheet is a choice, not an error
  unsupported: "This browser can't use passkeys. Use your password below.",
  credentials: "That passkey didn't work here. Use your password below, then add a passkey in Settings.",
  "rate-limited": MESSAGES["rate-limited"],
  offline: MESSAGES.offline,
  server: MESSAGES.server,
};

/** Only allow same-app paths as the post-login target. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

export function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deviceName, setDeviceName] = useState(rememberedDeviceName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"password" | "passkey" | null>(null);
  const [canPasskey] = useState(passkeysSupported);

  async function done() {
    await qc.invalidateQueries({ queryKey: ["session"] });
    navigate(safeNext(params.get("next")), { replace: true });
  }

  async function onPasskey() {
    setBusy("passkey");
    setError(null);
    const res = await loginWithPasskey({ deviceName });
    setBusy(null);
    if (!res.ok) {
      setError(PASSKEY_MESSAGES[res.reason]);
      return;
    }
    await done();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy("password");
    setError(null);
    const res = await login({ email, password, deviceName });
    setBusy(null);
    if (!res.ok) {
      setError(MESSAGES[res.reason]);
      return;
    }
    await done();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-4">
          <LogoMark size={56} />
          <div>
            <h1 className="text-title-sm">Tatakae</h1>
            <p className="text-ink-2">Plan the night before. Start strict. Show up.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="card space-y-5 p-8" noValidate aria-describedby={error ? "login-error" : undefined}>
          {canPasskey && (
            <>
              <button
                type="button"
                className="btn-primary min-h-[52px] w-full"
                onClick={() => void onPasskey()}
                disabled={busy !== null}
                autoFocus
              >
                <PasskeyIcon size={20} />
                {busy === "passkey" ? "Waiting for your passkey…" : "Sign in with a passkey"}
              </button>
              <p className="flex items-center gap-3 text-sm text-ink-2" aria-hidden="true">
                <span className="h-px flex-1 bg-line" />
                or use your password
                <span className="h-px flex-1 bg-line" />
              </p>
            </>
          )}
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              autoFocus={!canPasskey}
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="device" className="label">
              Device name
            </label>
            <input
              id="device"
              type="text"
              maxLength={40}
              className="input"
              aria-describedby="device-hint"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
            <p id="device-hint" className="mt-1.5 text-sm text-ink-2">
              Shown in Settings → Devices, so you can sign this laptop out later.
            </p>
          </div>

          {error && (
            <p id="login-error" role="alert" className="card-inner text-sm font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            className={`${canPasskey ? "btn-secondary" : "btn-primary"} min-h-[52px] w-full`}
            disabled={busy !== null || !email || password.length < 1}
          >
            {busy === "password" ? "Signing in…" : canPasskey ? "Sign in with password" : "Sign in"}
          </button>
        </form>
        <Kural className="mt-8" meaning={false} />
      </div>
    </main>
  );
}
