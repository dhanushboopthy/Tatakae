import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Application, ApplicationStatus } from "@tatakae/core";
import { EmptyState } from "../components/EmptyState";
import { OpenIcon, PencilIcon, PlusIcon, TrashIcon } from "../components/icons";
import { LibraryTabs } from "../components/LibraryTabs";
import { SceneCard } from "../components/SceneCard";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";
import { formatDay } from "../lib/format";
import { useToday } from "../lib/hooks";
import { applicationsApi, restErrorText } from "../lib/rest";

// Job applications (v3, REST only): one list, open ones first, next step and its date up front.
// Status reads by label and shape; closed ones turn grey (never red).

const STATUS: Record<ApplicationStatus, { label: string; cls: string }> = {
  wishlist: { label: "Wishlist", cls: "border border-missed text-ink" },
  applied: { label: "Applied", cls: "bg-surface-2 text-ink" },
  interview: { label: "Interview", cls: "bg-lavender text-on-accent" },
  offer: { label: "Offer", cls: "bg-lime text-on-accent" },
  rejected: { label: "Not this time", cls: "bg-surface-2 text-ink-2" },
  withdrawn: { label: "Withdrawn", cls: "bg-surface-2 text-ink-2" },
};
const STATUSES = Object.keys(STATUS) as ApplicationStatus[];
const isOpen = (a: Application) => a.status !== "rejected" && a.status !== "withdrawn";

export function Applications() {
  const list = applicationsApi.useList();
  const [editing, setEditing] = useState<Application | "new" | null>(null);
  const items = list.data ?? [];
  const open = items.filter(isOpen);
  const closed = items.filter((a) => !isOpen(a));
  const counts = STATUSES.map((s) => [s, items.filter((a) => a.status === s).length] as const).filter(([, n]) => n > 0);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Library"
        title="Applications"
        actions={
          <button type="button" className="btn-secondary" onClick={() => setEditing("new")}>
            <PlusIcon size={18} /> Add application
          </button>
        }
      />
      <LibraryTabs />
      <SceneCard scene="applications" className="max-w-read" />
      {list.isError ? (
        <EmptyState title="Applications didn't load." body={restErrorText(list.error, "Applications")} />
      ) : items.length === 0 ? (
        <EmptyState
          title={list.isLoading ? "Opening…" : "No applications yet."}
          body="Track each one with its next step, so nothing waits on memory."
        />
      ) : (
        <>
          <p className="tnum flex flex-wrap gap-2 text-sm">
            {counts.map(([s, n]) => (
              <span key={s} className={`pill ${STATUS[s].cls}`}>
                {STATUS[s].label} · {n}
              </span>
            ))}
          </p>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {open.map((a) => (
              <ApplicationCard key={a.id} app={a} onEdit={() => setEditing(a)} />
            ))}
          </ul>
          {closed.length > 0 && (
            <details className="card">
              <summary className="flex min-h-tap cursor-pointer items-center font-semibold">Closed ({closed.length})</summary>
              <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {closed.map((a) => (
                  <ApplicationCard key={a.id} app={a} onEdit={() => setEditing(a)} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add application" : "Edit application"} wide>
        {editing !== null && <ApplicationForm app={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function ApplicationCard({ app, onEdit }: { app: Application; onEdit: () => void }) {
  const today = useToday();
  const s = STATUS[app.status];
  const due = app.nextStepOn != null && app.nextStepOn <= today && isOpen(app);
  return (
    <li className="card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{app.company}</p>
          <p className="truncate text-sm text-ink-2">{app.role}</p>
        </div>
        <span className={`pill shrink-0 ${s.cls}`}>{s.label}</span>
      </div>
      {app.nextStep && (
        <p className={`rounded-card-inner px-3 py-2 text-sm ${due ? "bg-lime-soft" : "bg-surface-2"}`}>
          <span className="font-semibold">Next: </span>
          {app.nextStep}
          {app.nextStepOn && <span className="tnum text-ink-2"> · {formatDay(app.nextStepOn)}</span>}
        </p>
      )}
      <div className="mt-auto flex items-center gap-2 text-xs text-ink-2">
        <span className="tnum flex-1">
          {app.appliedOn ? `Applied ${formatDay(app.appliedOn)}` : "Not applied yet"}
          {app.source ? ` · ${app.source}` : ""}
        </span>
        {app.url && (
          <a href={app.url} target="_blank" rel="noreferrer" className="icon-btn-sm" aria-label={`Open the ${app.company} posting`}>
            <OpenIcon size={18} />
          </a>
        )}
        <button type="button" className="icon-btn-sm" aria-label={`Edit ${app.company}`} onClick={onEdit}>
          <PencilIcon size={18} />
        </button>
      </div>
    </li>
  );
}

function ApplicationForm({ app, onDone }: { app: Application | null; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    company: app?.company ?? "",
    role: app?.role ?? "",
    status: app?.status ?? ("applied" as ApplicationStatus),
    appliedOn: app?.appliedOn ?? "",
    url: app?.url ?? "",
    source: app?.source ?? "",
    nextStep: app?.nextStep ?? "",
    nextStepOn: app?.nextStepOn ?? "",
    notes: app?.notes ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = {
      company: f.company.trim(),
      role: f.role.trim(),
      status: f.status,
      appliedOn: f.appliedOn || null,
      url: f.url.trim() || null,
      source: f.source.trim() || null,
      nextStep: f.nextStep.trim() || null,
      nextStepOn: f.nextStepOn || null,
      notes: f.notes.trim() || null,
    };
    try {
      if (app) await applicationsApi.update(qc, app.id, body);
      else await applicationsApi.create(qc, body);
      onDone();
    } catch (err) {
      toast(restErrorText(err, "Saving"));
    }
  }

  async function onDelete() {
    if (!app) return;
    try {
      await applicationsApi.remove(qc, app.id);
      onDone();
    } catch (err) {
      toast(restErrorText(err, "Deleting"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field id="ap-company" label="Company">
        <input id="ap-company" className="input" autoFocus required maxLength={200} value={f.company} onChange={(e) => set("company", e.target.value)} />
      </Field>
      <Field id="ap-role" label="Role">
        <input id="ap-role" className="input" required maxLength={200} value={f.role} onChange={(e) => set("role", e.target.value)} />
      </Field>
      <Field id="ap-status" label="Status">
        <select id="ap-status" className="input" value={f.status} onChange={(e) => set("status", e.target.value as ApplicationStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="ap-applied" label="Applied on">
        <input id="ap-applied" type="date" className="input" value={f.appliedOn} onChange={(e) => set("appliedOn", e.target.value)} />
      </Field>
      <Field id="ap-next" label="Next step">
        <input id="ap-next" className="input" maxLength={300} placeholder="Follow up with the recruiter" value={f.nextStep} onChange={(e) => set("nextStep", e.target.value)} />
      </Field>
      <Field id="ap-next-on" label="Next step on">
        <input id="ap-next-on" type="date" className="input" value={f.nextStepOn} onChange={(e) => set("nextStepOn", e.target.value)} />
      </Field>
      <Field id="ap-url" label="Posting link">
        <input id="ap-url" type="url" className="input" placeholder="https://" value={f.url} onChange={(e) => set("url", e.target.value)} />
      </Field>
      <Field id="ap-source" label="Source">
        <input id="ap-source" className="input" maxLength={100} placeholder="Referral, LinkedIn…" value={f.source} onChange={(e) => set("source", e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field id="ap-notes" label="Notes">
          <textarea id="ap-notes" className="input min-h-[88px] py-3" maxLength={5000} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        {app && (
          <button type="button" className="btn-ghost" onClick={() => void onDelete()}>
            <TrashIcon size={18} /> Delete
          </button>
        )}
        <span className="flex-1" />
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!f.company.trim() || !f.role.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}

export function Field(props: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={props.id} className="label">
        {props.label}
      </label>
      {props.children}
    </div>
  );
}
