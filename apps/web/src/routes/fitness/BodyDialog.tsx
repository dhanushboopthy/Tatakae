import { useState, type FormEvent } from "react";
import type { BodyLog, ISODate } from "@tatakae/core";
import { Modal } from "../../components/Modal";
import { logBody } from "../../lib/hooks";
import { formatDay } from "../../lib/format";
import { parseNum } from "./shared";

/** Edit a day's body log: weight, steps, water, sleep. Blank fields stay empty. */
export function BodyDialog(props: { open: boolean; onClose: () => void; date: ISODate; body: BodyLog | null; previousWeightKg: number | null }) {
  return (
    <Modal open={props.open} onClose={props.onClose} title="Body log" description={formatDay(props.date, { long: true })}>
      <BodyForm {...props} />
    </Modal>
  );
}

function BodyForm({ onClose, date, body, previousWeightKg }: Omit<Parameters<typeof BodyDialog>[0], "open">) {
  const [weight, setWeight] = useState(body?.weightKg != null ? String(body.weightKg) : previousWeightKg != null ? String(previousWeightKg) : "");
  const [steps, setSteps] = useState(body?.steps != null ? String(body.steps) : "");
  const [water, setWater] = useState(body?.waterMl != null ? String(body.waterMl) : "");
  const [sleepH, setSleepH] = useState(body?.sleepMin != null ? String(Math.floor(body.sleepMin / 60)) : "");
  const [sleepM, setSleepM] = useState(body?.sleepMin != null ? String(body.sleepMin % 60) : "");
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const w = parseNum(weight);
    const s = parseNum(steps);
    const wa = parseNum(water);
    const h = parseNum(sleepH);
    const m = parseNum(sleepM);
    if (weight.trim() !== "" && (w == null || w < 20 || w > 400)) return setProblem("Weight should be between 20 and 400 kg.");
    if ((steps.trim() !== "" && s == null) || (water.trim() !== "" && wa == null) || (sleepH.trim() !== "" && h == null) || (sleepM.trim() !== "" && m == null)) {
      return setProblem("Steps, water and sleep should be numbers.");
    }
    const sleepMin = sleepH.trim() === "" && sleepM.trim() === "" ? null : Math.round((h ?? 0) * 60 + (m ?? 0));
    if (sleepMin != null && sleepMin > 1440) return setProblem("Sleep can't be more than 24 hours.");
    await logBody(date, {
      weightKg: w,
      steps: s == null ? null : Math.round(s),
      waterMl: wa == null ? null : Math.round(wa),
      sleepMin,
    });
    onClose();
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <label className="block">
        <span className="label">Morning weight (kg)</span>
        <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" className="input tnum" autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Steps</span>
          <input value={steps} onChange={(e) => setSteps(e.target.value)} inputMode="numeric" className="input tnum" />
        </label>
        <label className="block">
          <span className="label">Water (ml)</span>
          <input value={water} onChange={(e) => setWater(e.target.value)} inputMode="numeric" className="input tnum" />
        </label>
      </div>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="label">Sleep</legend>
        <label className="block">
          <span className="sr-only">Sleep hours</span>
          <input value={sleepH} onChange={(e) => setSleepH(e.target.value)} inputMode="numeric" placeholder="hours" className="input tnum" />
        </label>
        <label className="block">
          <span className="sr-only">Sleep minutes</span>
          <input value={sleepM} onChange={(e) => setSleepM(e.target.value)} inputMode="numeric" placeholder="minutes" className="input tnum" />
        </label>
      </fieldset>
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
      <div className="flex gap-2.5">
        <button type="submit" className="btn-primary">
          Save
        </button>
        <button type="button" className="btn-outline" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
