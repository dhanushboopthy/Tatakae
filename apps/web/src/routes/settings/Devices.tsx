import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { securityEventList, type SecurityEventKind } from "@tatakae/core";
import { useNavigate } from "react-router-dom";
import { LogOutIcon, RefreshIcon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { api, isNetworkError, statusOf } from "../../lib/api";
import { syncLabel, useSyncStatus } from "../../lib/hooks";
import { logout } from "../../lib/session";
import { flushNow } from "../../sync/engine";
import { Section } from "./Section";

interface Device {
  id: string;
  client: "web" | "mobile";
  deviceName: string;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  current: boolean;
}

function parseDevices(body: unknown): Device[] {
  if (typeof body !== "object" || body === null) return [];
  const list = (body as { devices?: unknown }).devices;
  return Array.isArray(list) ? (list as Device[]) : [];
}

const EVENT_LABEL: Record<SecurityEventKind, string> = {
  login: "Signed in with the password",
  login_failed: "Sign-in didn't go through",
  passkey_login: "Signed in with a passkey",
  passkey_login_failed: "Passkey sign-in didn't go through",
  reauth: "Confirmed it's you",
  reauth_failed: "Confirmation didn't go through",
  passkey_added: "Passkey added",
  passkey_removed: "Passkey removed",
  device_signed_out: "Signed out another device",
  others_signed_out: "Signed out every other device",
  password_changed: "Password changed, every device signed out",
  export: "Downloaded the full export",
};
const SHOWN = 8;

/**
 * Recent sign-ins and security changes (S9), newest first, so a sign-in that wasn't you stands out.
 * Words carry the meaning (no red): what happened, which device, when and from where.
 */
function SecurityActivity() {
  const [all, setAll] = useState(false);
  const events = useQuery({
    queryKey: ["rest", "security-events"],
    queryFn: async () => securityEventList.parse(await api("/system/security")).events,
    retry: false,
    staleTime: 0,
  });
  const list = events.data ?? [];
  return (
    <div>
      <p className="mb-1 font-semibold">Recent sign-ins and changes</p>
      <p className="mb-2 text-xs text-ink-2">If something here wasn't you, sign that device out and change the password.</p>
      {events.isError ? (
        <p className="text-sm text-ink-2">The activity list needs a connection.</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-ink-2">Nothing yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {(all ? list : list.slice(0, SHOWN)).map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-x-3 rounded-card-inner bg-surface-2 px-4 py-2">
              <span className="min-w-0">
                <span className="font-medium">{EVENT_LABEL[e.kind]}</span>
                {(e.device || e.detail) && <span className="text-ink-2"> · {[e.device, e.detail].filter(Boolean).join(" · ")}</span>}
              </span>
              <span className="tnum text-ink-2">
                {when(e.at)}
                {e.ip ? ` · ${e.ip}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {list.length > SHOWN && (
        <button type="button" className="btn mt-2 min-h-tap bg-surface-2 px-4 text-sm" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${list.length}`}
        </button>
      )}
    </div>
  );
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—";

export function DevicesSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const status = useSyncStatus();
  const devices = useQuery({
    queryKey: ["rest", "devices"],
    queryFn: async () => parseDevices(await api("/session/devices")),
    retry: false,
  });

  const [confirmOthers, setConfirmOthers] = useState(false);
  async function signOutOthers() {
    try {
      const body = (await api("/session/devices/sign-out-others", { method: "POST", body: {} })) as { signedOut?: number };
      const n = body.signedOut ?? 0;
      toast(n === 0 ? "No other devices were signed in." : `Signed out ${n} other ${n === 1 ? "device" : "devices"}.`);
      await qc.invalidateQueries({ queryKey: ["rest"] });
    } catch (e) {
      toast(
        isNetworkError(e)
          ? "Offline. Try again when connected."
          : statusOf(e) === 403
            ? "Nothing changed. This needs your password first."
            : "Couldn't sign the other devices out.",
      );
    } finally {
      setConfirmOthers(false);
    }
  }

  async function revoke(d: Device) {
    try {
      await api(`/session/devices/${encodeURIComponent(d.id)}`, { method: "DELETE" });
      toast(`${d.deviceName} is signed out.`);
      await qc.invalidateQueries({ queryKey: ["rest", "devices"] });
    } catch (e) {
      toast(
        isNetworkError(e)
          ? "Offline. Try again when connected."
          : statusOf(e) === 403
            ? "Not signed out. Signing out another device needs your password first."
            : "Couldn't sign that device out.",
      );
    }
  }

  return (
    <Section id="devices" title="Devices and sync" description="Every signed-in laptop and phone. Sign out a lost device here.">
      <div className="flex flex-wrap items-center gap-3 rounded-card-inner bg-surface-2 p-3 pl-4">
        <p className="flex-1 text-sm font-medium" role="status">
          {syncLabel(status)}
          {status.lastSyncAt && <span className="font-normal text-ink-2"> · last {when(status.lastSyncAt)}</span>}
        </p>
        <button type="button" className="btn min-h-tap bg-surface px-4 text-sm" onClick={() => void flushNow()}>
          <RefreshIcon size={16} /> Sync now
        </button>
      </div>

      {devices.isError ? (
        <p className="text-sm text-ink-2">The device list needs a connection.</p>
      ) : (
        <ul className="space-y-2">
          {(devices.data ?? []).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-card-inner bg-surface-2 py-2 pl-4 pr-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {d.deviceName}
                  {d.current && <span className="pill ml-2 bg-lime text-on-accent">This device</span>}
                </p>
                <p className="text-xs text-ink-2">
                  {d.client === "web" ? "Laptop" : "Phone"} · last seen {when(d.lastSeenAt ?? d.createdAt)}
                </p>
              </div>
              {!d.current && (
                <button type="button" className="btn-danger min-h-tap px-4 text-sm" onClick={() => void revoke(d)}>
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {(devices.data ?? []).some((d) => !d.current) && (
        <div className="flex flex-wrap items-center gap-3">
          {confirmOthers ? (
            <>
              <button type="button" className="btn-danger min-h-tap px-4 text-sm" onClick={() => void signOutOthers()}>
                Sign them all out
              </button>
              <button type="button" className="btn min-h-tap bg-surface-2 px-4 text-sm" onClick={() => setConfirmOthers(false)}>
                Keep them
              </button>
            </>
          ) : (
            <button type="button" className="btn min-h-tap bg-surface-2 px-4 text-sm" onClick={() => setConfirmOthers(true)}>
              Sign out every other device…
            </button>
          )}
          <p className="text-xs text-ink-2">After a lost device or a password change. This laptop stays signed in.</p>
        </div>
      )}

      <SecurityActivity />

      <button
        type="button"
        className="btn-outline"
        onClick={async () => {
          await logout();
          qc.clear();
          navigate("/login", { replace: true });
        }}
      >
        <LogOutIcon size={18} /> Sign out of this laptop
      </button>
      <p className="text-xs text-ink-2">Signing out keeps your local data and anything waiting to sync.</p>
    </Section>
  );
}
