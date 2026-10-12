import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { P1Card, P1QuickPlan } from "../components/P1Card";
import { greeting, useDisplayName } from "../lib/profile";
import { updateDay, useDay, useIstTime, useToday } from "../lib/hooks";

// Morning (docs/02, docs/05): ONE screen — intention question, the P1 hero (Minimum + if-then, Start
// 25 / 50 / 90), nothing else until P1 is started. Never a story line here. Mainly the phone's screen;
// the laptop shows the same for mornings at the desk.
export function Morning() {
  const today = useToday();
  const now = useIstTime();
  const name = useDisplayName();
  const { data: day } = useDay(today);
  const p1 = day?.slots.P1;

  return (
    <div className="page-read">
      <div>
        <p className="eyebrow">{greeting(now, name)}</p>
        <h1 className="mt-1 text-title-sm md:text-title">What would make today a win?</h1>
      </div>
      {day && <Intention date={today} initial={day.day?.intention ?? ""} />}
      {!day ? null : p1 ? (
        <P1Card mission={p1} forged={day.forged} />
      ) : (
        <section className="card space-y-4">
          <h2 className="text-xl">No plan locked. Pick one Minimum now.</h2>
          <P1QuickPlan date={today} />
        </section>
      )}
      <Link to="/today" className="btn-ghost">
        Show P2 and P3
      </Link>
    </div>
  );
}

function Intention({ date, initial }: { date: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial !== "");
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await updateDay(date, { intention: text.trim() || null });
    setSaved(true);
  }
  return (
    <form onSubmit={onSubmit} className="card flex gap-2">
      <label htmlFor="intention" className="sr-only">
        Today's intention
      </label>
      <input
        id="intention"
        className="input"
        maxLength={200}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        placeholder="One line"
      />
      <button type="submit" className="btn-secondary" disabled={saved}>
        {saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}
