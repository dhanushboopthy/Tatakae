import { useEffect, useRef, useState, type FormEvent } from "react";
import { setReauthHandler } from "../lib/api";
import { passkeysSupported } from "../lib/passkeys";
import { confirmWithPasskey, confirmWithPassword, reauthProblemText, type ReauthResult } from "../lib/reauth";
import { PasskeyIcon } from "./icons";
import { Modal } from "./Modal";

/**
 * "Confirm it's you" (security S8). Mounted once in Shell; lib/api opens it when a sensitive call
 * (full export, adding a passkey, signing out other devices) answers 403 reauth_required, then
 * retries the call once it is confirmed. Cancelling just leaves things as they were.
 */
export function ReauthDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "passkey" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const [canPasskey] = useState(passkeysSupported);

  useEffect(() => {
    setReauthHandler(
      () =>
        new Promise<boolean>((resolve) => {
          resolver.current?.(false); // a second request while open replaces the first
          resolver.current = resolve;
          setPassword("");
          setProblem(null);
          setBusy(null);
          setOpen(true);
        }),
    );
    return () => setReauthHandler(null);
  }, []);

  function finish(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
    setPassword("");
  }

  function settle(result: ReauthResult) {
    setBusy(null);
    if (result.ok) finish(true);
    else setProblem(reauthProblemText[result.reason]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy("password");
    setProblem(null);
    settle(await confirmWithPassword(password));
  }

  async function onPasskey() {
    if (busy) return;
    setBusy("passkey");
    setProblem(null);
    settle(await confirmWithPasskey());
  }

  return (
    <Modal
      open={open}
      onClose={() => finish(false)}
      title="Confirm it's you"
      description="This change needs your password or a passkey. It stays confirmed for 10 minutes."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate aria-describedby={problem ? "reauth-problem" : undefined}>
        <div>
          <label htmlFor="reauth-password" className="label">
            Password
          </label>
          <input
            id="reauth-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            maxLength={256}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {problem && (
          <p id="reauth-problem" role="alert" className="card-inner text-sm font-medium">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-primary min-h-tap flex-1" disabled={busy !== null || !password}>
            {busy === "password" ? "Checking…" : "Confirm"}
          </button>
          {canPasskey && (
            <button type="button" className="btn-secondary min-h-tap flex-1" disabled={busy !== null} onClick={() => void onPasskey()}>
              <PasskeyIcon size={18} /> {busy === "passkey" ? "Waiting for your passkey…" : "Use a passkey"}
            </button>
          )}
        </div>
        <button type="button" className="btn min-h-tap w-full bg-surface-2 text-sm" onClick={() => finish(false)}>
          Not now
        </button>
      </form>
    </Modal>
  );
}
