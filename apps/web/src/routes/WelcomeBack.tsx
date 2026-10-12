import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Kural } from "../components/Kural";
import { P1QuickPlan } from "../components/P1Card";
import { useToast } from "../components/Toast";
import { formatDay, weekdayInitial, welcomeBackSeenKey } from "../lib/format";
import { useDay, useRecentHistory, useToday, useWriteOffs, writeOff } from "../lib/hooks";
import { storage } from "../lib/storage";
import { announceMoment } from "../lib/story";

// Welcome back (docs/02 lapse protocol, docs/05): calm line, grey history (no red, no count), Restart
// plans only P1 for today, or write today off (max 2 a month, with a reason). Shown once per day.

export function WelcomeBack() {
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: history = [] } = useRecentHistory(7);
  const { data: day } = useDay(today);
  const { data: writeOffs } = useWriteOffs(today);
  const [mode, setMode] = useState<"choose" | "restart" | "writeoff">("choose");

  useEffect(() => storage.set(welcomeBackSeenKey(today), "1"), [today]);

  return (
    <div className="page-read">
      <section className="card space-y-6 p-8">
        <div>
          <p className="eyebrow">{formatDay(today, { long: true })}</p>
          <h1 className="mt-2 text-title-sm md:text-title">Welcome back.</h1>
          <p className="mt-3 text-lg">One mission today — that's the whole plan.</p>
        </div>

        <Kural n={621} />

        <figure className="m-0">
          <ol className="flex gap-2" aria-label="Last seven days">
            {history.map((h) => {
              const label = h.beforeStart ? "before you started" : h.kind !== "normal" ? "rest" : h.missed ? "grey" : "shown up";
              return (
                <li key={h.date} className="flex flex-col items-center gap-1.5">
                  <span
                    aria-label={`${formatDay(h.date)}: ${label}`}
                    role="img"
                    className={`h-10 w-10 rounded-full ${
                      h.beforeStart
                        ? "shadow-[inset_0_0_0_2px_rgb(var(--line))]"
                        : h.kind !== "normal"
                          ? "shadow-[inset_0_0_0_2px_rgb(var(--missed))]"
                          : h.missed
                            ? "bg-surface-2"
                            : "bg-lime"
                    }`}
                  />
                  <span aria-hidden="true" className="text-xs font-semibold text-ink-2">
                    {weekdayInitial(h.date)}
                  </span>
                </li>
              );
            })}
          </ol>
          <figcaption className="mt-3 text-sm text-ink-2">Misses turn grey. Nothing resets. Don't miss twice.</figcaption>
        </figure>

        {mode === "choose" && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-accent min-h-[52px] px-6" onClick={() => setMode("restart")}>
              Restart with one mission
            </button>
            {writeOffs && writeOffs.remaining > 0 && day?.day?.kind !== "write_off" && (
              <button type="button" className="btn-secondary min-h-[52px]" onClick={() => setMode("writeoff")}>
                Write today off
              </button>
            )}
            <button type="button" className="btn-ghost min-h-[52px]" onClick={() => navigate("/today")}>
              Just go to Today
            </button>
          </div>
        )}
      </section>

      {mode === "restart" && (
        <P1QuickPlan
          date={today}
          existing={day?.slots.P1}
          submitLabel="Restart"
          onDone={() => {
            void announceMoment("comeback");
            toast("P1 locked. Do the Minimum and it counts.");
            navigate("/today");
          }}
        />
      )}
      {mode === "writeoff" && writeOffs && (
        <WriteOffForm
          remaining={writeOffs.remaining}
          limit={writeOffs.limit}
          onCancel={() => setMode("choose")}
          onDone={async (reason) => {
            await writeOff(today, reason);
            toast("Today is written off. Rest, and come back tomorrow.");
            navigate("/today");
          }}
        />
      )}
    </div>
  );
}

function WriteOffForm(props: { remaining: number; limit: number; onCancel: () => void; onDone: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const ok = reason.trim().length >= 3;
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (ok) void props.onDone(reason.trim());
  }
  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <label htmlFor="wo-reason" className="label">
          Why today? (a few words)
        </label>
        <input id="wo-reason" className="input" autoFocus maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fever" />
        <p className="mt-1.5 text-sm text-ink-2">
          {props.remaining} of {props.limit} write-offs left this month. A written-off day doesn't count against any average.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={props.onCancel}>
          Back
        </button>
        <button type="submit" className="btn-primary" disabled={!ok}>
          Write today off
        </button>
      </div>
    </form>
  );
}
