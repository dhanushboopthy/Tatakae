import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PasskeySummary } from "@tatakae/core";
import { PasskeyIcon, PencilIcon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { isNetworkError, statusOf } from "../../lib/api";
import { addPasskey, PasskeyCancelled, passkeysSupported, removePasskey, renamePasskey, usePasskeys } from "../../lib/passkeys";
import { Section } from "./Section";

// Settings → Passkeys (v4, R3-8): add a passkey on this laptop (fingerprint, face or PIN, or a phone
// nearby), rename and remove. The password keeps working, so removing the last passkey is safe.

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "never";

export function PasskeysSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const list = usePasskeys();
  const [supported] = useState(passkeysSupported);
  const [name, setName] = useState("This laptop");
  const [adding, setAdding] = useState(false);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const saved = await addPasskey(qc, name);
      toast(`Passkey "${saved.name}" added. Next time, sign in with it.`);
    } catch (err) {
      if (err instanceof PasskeyCancelled) toast("No passkey added. If this device already has one, it's in the list.");
      else if (isNetworkError(err)) toast("Offline. Adding a passkey needs a connection.");
      else if (statusOf(err) === 400) toast("That passkey couldn't be checked. Try again.");
      else toast("Couldn't add the passkey. Try again in a moment.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Section
      id="passkeys"
      title="Passkeys"
      description="Sign in with your fingerprint, face or screen lock instead of typing the password. The password keeps working."
    >
      {!supported && <p className="text-sm text-ink-2">This browser can't create passkeys. Use the password, or try Chrome or Edge.</p>}

      {list.isError ? (
        <p className="text-sm text-ink-2">The passkey list needs a connection.</p>
      ) : (list.data ?? []).length === 0 ? (
        <p className="text-sm text-ink-2">No passkeys yet.</p>
      ) : (
        <ul className="space-y-2">
          {(list.data ?? []).map((p) => (
            <PasskeyRow key={p.id} passkey={p} />
          ))}
        </ul>
      )}

      {supported && (
        <form onSubmit={onAdd} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="passkey-name" className="label">
              Name for the new passkey
            </label>
            <input id="passkey-name" className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={adding || !name.trim()}>
            <PasskeyIcon size={18} /> {adding ? "Waiting for your device…" : "Add a passkey"}
          </button>
        </form>
      )}
    </Section>
  );
}

function PasskeyRow({ passkey: p }: { passkey: PasskeySummary }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [confirming, setConfirming] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await renamePasskey(qc, p.id, name);
      setEditing(false);
    } catch (err) {
      toast(isNetworkError(err) ? "Offline. Try again when connected." : "Couldn't rename it.");
    }
  }

  async function remove() {
    try {
      await removePasskey(qc, p.id);
      toast(`"${p.name}" removed. Your password still works.`);
    } catch (err) {
      toast(isNetworkError(err) ? "Offline. Try again when connected." : "Couldn't remove it.");
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-card-inner bg-surface-2 py-2 pl-4 pr-2">
      {editing ? (
        <form onSubmit={save} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <label htmlFor={`pk-${p.id}`} className="sr-only">
            Passkey name
          </label>
          <input id={`pk-${p.id}`} className="input min-w-0 flex-1" maxLength={40} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn-primary min-h-tap px-4 text-sm">
            Save
          </button>
          <button
            type="button"
            className="btn min-h-tap bg-surface px-4 text-sm"
            onClick={() => {
              setName(p.name);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{p.name}</p>
            <p className="text-xs text-ink-2">
              {p.deviceType === "multiDevice" ? "Synced passkey" : "This device only"} · added {when(p.createdAt)} · last used {when(p.lastUsedAt)}
            </p>
          </div>
          {confirming ? (
            <>
              <button type="button" className="btn-danger min-h-tap px-4 text-sm" onClick={() => void remove()}>
                Remove
              </button>
              <button type="button" className="btn min-h-tap bg-surface px-4 text-sm" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <>
              <button type="button" className="icon-btn-sm bg-surface" aria-label={`Rename ${p.name}`} onClick={() => setEditing(true)}>
                <PencilIcon size={16} />
              </button>
              <button type="button" className="btn min-h-tap bg-surface px-4 text-sm" onClick={() => setConfirming(true)}>
                Remove…
              </button>
            </>
          )}
        </>
      )}
    </li>
  );
}
