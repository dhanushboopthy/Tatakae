import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { addDays, formatIsoWeek, isoWeek, isoWeekRange, type ISODate } from "@tatakae/core";
import { useToast } from "../../components/Toast";
import { setMaintenance, useFitnessWeek } from "../../lib/hooks";
import { n0, parseNum } from "./shared";

/**
 * Fitness block for the Weekly Review: one plain sentence on the week (informational only, it never changes
 * maintenance) and the natural place to set next week's maintenance. Hidden until there is something to say.
 */
export function FitnessCheckIn({ week, today }: { week: { year: number; week: number }; today: ISODate }) {
  const key = formatIsoWeek(week);
  const { end } = isoWeekRange(week.year, week.week);
  const nextKey = formatIsoWeek(isoWeek(addDays(end, 1)));
  const { data } = useFitnessWeek(key, today);
  const { data: next } = useFitnessWeek(nextKey, today);
  if (!data || !next) return null;
  if (data.summary.daysLogged === 0 && data.summary.weighIns === 0 && !data.phase) return null;

  return (
    <section aria-labelledby="fit-check-title" className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fit-check-title" className="text-base font-semibold">
          Fitness check-in
        </h2>
        <Link to={`/fitness?tab=week&d=${end > today ? today : end}`} className="link text-sm">
          Open Fitness
        </Link>
      </div>
      <p className="max-w-read text-[15px] leading-relaxed">{data.checkIn}</p>
      <NextWeek key={`${nextKey}-${next.summary.maintenanceKcal}`} nextKey={nextKey} kcal={next.summary.maintenanceKcal} fromThisWeek={data.summary.maintenanceKcal} set={next.summary.maintenanceSetForWeek} />
    </section>
  );
}

function NextWeek({ nextKey, kcal, fromThisWeek, set }: { nextKey: string; kcal: number; fromThisWeek: number; set: boolean }) {
  const toast = useToast();
  const [text, setText] = useState(String(set ? kcal : fromThisWeek));
  const [problem, setProblem] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    const n = parseNum(text);
    if (n == null || n < 800 || n > 8000) return setProblem("Enter a number between 800 and 8,000.");
    setProblem(null);
    await setMaintenance(nextKey, n);
    toast(`Maintenance for W${nextKey.slice(-2)} is ${n0(n)} kcal.`);
  }

  return (
    <form onSubmit={(e) => void save(e)} className="flex flex-col gap-1.5">
      <label htmlFor="next-maint" className="text-[13px] font-semibold text-ink-2">
        Maintenance for next week (kcal){set ? " · set" : " · carries over if you leave it"}
      </label>
      <div className="flex max-w-xs gap-2">
        <input id="next-maint" value={text} onChange={(e) => setText(e.target.value)} inputMode="numeric" aria-invalid={problem != null} className="input tnum" />
        <button type="submit" className="btn-primary">
          Save
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
    </form>
  );
}
