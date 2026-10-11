import { useRecharge } from "../lib/hooks";
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
      <h2 id="recharge-title">{props.title ?? "Recharge before the next block"}</h2>
      <p className="mt-1 text-sm text-muted">Pick one. Five to fifteen minutes, away from the screen.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((r) => (
          <button key={r.id} type="button" className="btn-secondary" onClick={() => choose(r.name)}>
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
