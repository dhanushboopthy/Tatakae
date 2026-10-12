import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LogOutIcon, RefreshIcon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { api, isNetworkError } from "../../lib/api";
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

  async function revoke(d: Device) {
    try {
      await api(`/session/devices/${encodeURIComponent(d.id)}`, { method: "DELETE" });
      toast(`${d.deviceName} is signed out.`);
      await qc.invalidateQueries({ queryKey: ["rest", "devices"] });
    } catch (e) {
      toast(isNetworkError(e) ? "Offline. Try again when connected." : "Couldn't sign that device out.");
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
