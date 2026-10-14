import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, weekdayOf, type ISODate, type JapaneseKind } from "@tatakae/core";
import { BlockBarChart, type BlockSeries } from "../components/BlockBarChart";
import { TrashIcon } from "../components/icons";
import { Kural } from "../components/Kural";
import { LibraryTabs } from "../components/LibraryTabs";
import { PageHeader } from "../components/PageHeader";
import { SegmentedPills } from "../components/SegmentedPills";
import { useToast } from "../components/Toast";
import { AREA_COLORS } from "../lib/colors";
import { formatDay } from "../lib/format";
import { useToday } from "../lib/hooks";
import { japaneseApi, restErrorText } from "../lib/rest";

// Japanese practice log (v3, REST only): a one-line logger (≤ 10 s: kind, minutes, Log), minutes per
// week for the last 8 weeks as butter blocks (the Japanese area colour, docs/10), and recent entries.

const KINDS: readonly { value: JapaneseKind; label: string }[] = [
  { value: "anki", label: "Anki" },
  { value: "reading", label: "Reading" },
  { value: "listening", label: "Listening" },
  { value: "speaking", label: "Speaking" },
  { value: "writing", label: "Writing" },
];
const MINUTES = [10, 15, 25, 45] as const;
const WEEKS = 8;
const SERIES: readonly BlockSeries[] = [{ key: "min", label: "Minutes", fill: AREA_COLORS.butter.fill, deep: AREA_COLORS.butter.deep }];

const mondayOf = (d: ISODate): ISODate => addDays(d, -((weekdayOf(d) + 6) % 7));

export function Japanese() {
  const today = useToday();
  const qc = useQueryClient();
  const toast = useToast();
  const thisMonday = mondayOf(today);
  const from = addDays(thisMonday, -7 * (WEEKS - 1));
  const list = japaneseApi.useList({ from });
  const [kind, setKind] = useState<JapaneseKind>("anki");
  const [minutes, setMinutes] = useState("15");
  const [date, setDate] = useState<ISODate>(today);
  const [note, setNote] = useState("");

  const items = list.data ?? [];
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(from, 7 * i));
  const columns = weeks.map((start) => {
    const end = addDays(start, 6);
    const min = items.filter((e) => e.date >= start && e.date <= end).reduce((s, e) => s + e.minutes, 0);
    return { label: start === thisMonday ? "This wk" : formatDay(start).replace(/^\w+ /, ""), values: { min } };
  });
  const weekTotal = items.filter((e) => e.date >= thisMonday).reduce((s, e) => s + e.minutes, 0);

  async function onLog(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(minutes, 10);
    if (!Number.isFinite(n) || n < 1 || n > 600) return;
    try {
      await japaneseApi.create(qc, { date, minutes: n, kind, note: note.trim() || null });
      setNote("");
      toast(`Logged ${n} min of ${kind}.`, { durationMs: 2000 });
    } catch (err) {
      toast(restErrorText(err, "Logging"));
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Library" title="Japanese" />
      <LibraryTabs />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form onSubmit={onLog} className="card space-y-4" aria-labelledby="jp-log-title">
          <h2 id="jp-log-title" className="text-base font-semibold">
            Log practice
          </h2>
          <SegmentedPills<JapaneseKind> label="Kind" value={kind} onChange={setKind} options={KINDS} />
          <div>
            <p className="label" id="jp-min-label">
              Minutes
            </p>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-labelledby="jp-min-label">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === String(m)}
                  onClick={() => setMinutes(String(m))}
                  className={`chip tnum ${minutes === String(m) ? "bg-lime text-on-accent" : "bg-surface-2 font-medium hover:bg-line"}`}
                >
                  {m}
                </button>
              ))}
              <label htmlFor="jp-min" className="sr-only">
                Other minutes
              </label>
              <input
                id="jp-min"
                className="input tnum w-24"
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="jp-date" className="label">
                Day
              </label>
              <input id="jp-date" type="date" className="input" max={today} value={date} onChange={(e) => setDate(e.target.value || today)} />
            </div>
            <div>
              <label htmlFor="jp-note" className="label">
                Note (optional)
              </label>
              <input id="jp-note" className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full">
            Log
          </button>
        </form>

        <section aria-labelledby="jp-weeks-title" className="card space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="jp-weeks-title" className="text-base font-semibold">
              Minutes per week
            </h2>
            <p className="tnum text-sm text-ink-2">
              This week: <span className="font-semibold text-ink">{weekTotal} min</span>
            </p>
          </div>
          {list.isError ? (
            <p className="text-sm text-ink-2">{restErrorText(list.error, "The log")}</p>
          ) : (
            <BlockBarChart
              columns={columns}
              series={SERIES}
              unit={15}
              unitLabel="15 min"
              label={`Japanese minutes per week, last ${WEEKS} weeks: ${columns.map((c) => `${c.label} ${c.values.min}`).join(", ")}.`}
            />
          )}
        </section>
      </div>

      <section aria-labelledby="jp-recent-title" className="card space-y-3">
        <h2 id="jp-recent-title" className="text-base font-semibold">
          Recent
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-ink-2">{list.isLoading ? "Opening…" : "Nothing logged in the last 8 weeks."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.slice(0, 30).map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span className="tnum w-24 shrink-0 text-sm text-ink-2">{formatDay(e.date)}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold capitalize">{e.kind}</span>
                  {e.note && <span className="text-ink-2"> · {e.note}</span>}
                </span>
                <span className="tnum text-sm font-semibold">{e.minutes} min</span>
                <button
                  type="button"
                  className="icon-btn-sm"
                  aria-label={`Remove ${e.minutes} min of ${e.kind} on ${formatDay(e.date)}`}
                  onClick={() => void japaneseApi.remove(qc, e.id).catch((err: unknown) => toast(restErrorText(err, "Removing")))}
                >
                  <TrashIcon size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Kural n={396} size="sm" className="max-w-read" />
    </div>
  );
}
