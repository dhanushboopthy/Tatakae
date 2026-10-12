import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogoMark } from "../components/icons";
import { login, rememberedDeviceName, type LoginResult } from "../lib/session";

// Phase 0.10. Email + password + device name (remembered) → POST /api/session/login {client: "web"}.
// The desktop install prompt is offered in the Shell after login (see InstallBanner).

const MESSAGES: Record<Exclude<LoginResult, { ok: true }>["reason"], string> = {
  credentials: "That email and password don't match. Try again.",
  "rate-limited": "Too many attempts. Wait a few minutes, then try again.",
  offline: "You're offline. Signing in needs a connection.",
  server: "The server didn't answer properly. Try again in a moment.",
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
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await login({ email, password, deviceName });
    setBusy(false);
    if (!res.ok) {
      setError(MESSAGES[res.reason]);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["session"] });
    navigate(safeNext(params.get("next")), { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <LogoMark size={40} />
          <div>
            <h1>Tatakae</h1>
            <p className="text-sm text-legacy-muted">Plan the night before. Start strict. Show up.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4" noValidate aria-describedby={error ? "login-error" : undefined}>
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
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
            <p id="device-hint" className="mt-1 text-sm text-legacy-muted">
              Shown in Settings → Devices, so you can sign this laptop out later.
            </p>
          </div>

          {error && (
            <p id="login-error" role="alert" className="text-sm text-legacy-paper">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy || !email || password.length < 1}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
