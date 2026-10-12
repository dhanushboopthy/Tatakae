import { useRecharge } from "../lib/hooks";
import { RechargeIcon } from "./icons";
import { useToast } from "./Toast";

/** After a focus block: pick a recharge (walk / music / call / stretch / sketch, from recharge_items). */
export function RechargeMenu(props: { onDone?: () => void; title?: string }) {
  const { data: items = [] } = useRecharge();
  const toast = useToast();

  function choose(name: string) {
    toast(`${name}. Come back when you're ready.`);
    props.onDone?.();
  }

  return (
    <section aria-labelledby="recharge-title" className="card">
      <div className="flex items-start gap-4">
        <span className="icon-btn-soft pointer-events-none" aria-hidden="true">
          <RechargeIcon />
        </span>
        <div>
          <h2 id="recharge-title">{props.title ?? "Recharge before the next block"}</h2>
          <p className="mt-1 text-sm text-ink-2">Pick one. Five to fifteen minutes, away from the screen.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {items.map((r) => (
          <button key={r.id} type="button" className="chip bg-surface-2 hover:bg-line" onClick={() => choose(r.name)}>
            {r.name}
          </button>
        ))}
        {props.onDone && (
          <button type="button" className="btn-ghost" onClick={props.onDone}>
            Skip
          </button>
        )}
      </div>
    </section>
  );
}
