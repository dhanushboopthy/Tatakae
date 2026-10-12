import { useState, type FormEvent } from "react";
import { CloseIcon } from "../../components/icons";
import { removeRecharge, saveRecharge, useRecharge } from "../../lib/hooks";
import { Section } from "./Section";

export function RechargeSettings() {
  const { data: items = [] } = useRecharge();
  const [name, setName] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await saveRecharge({ name });
    setName("");
  }

  return (
    <Section id="recharge" title="Recharge menu" description="Offered after each focus block. Five to fifteen minutes, away from the screen.">
      <ul className="flex flex-wrap gap-2">
        {items.map((r) => (
          <li key={r.id} className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-4 pr-1 text-sm font-semibold">
            {r.name}
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-line"
              aria-label={`Remove ${r.name}`}
              onClick={() => void removeRecharge(r.id)}
            >
              <CloseIcon size={16} />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} className="flex max-w-md gap-2">
        <label htmlFor="recharge-new" className="sr-only">
          New recharge
        </label>
        <input id="recharge-new" className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tea on the balcony" />
        <button type="submit" className="btn-secondary" disabled={!name.trim()}>
          Add
        </button>
      </form>
    </Section>
  );
}
