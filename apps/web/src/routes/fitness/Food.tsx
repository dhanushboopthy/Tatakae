import { useState, type FormEvent } from "react";
import { MICRO_INFO, MICRO_KEYS, searchFoods, type Food, type ISODate, type MealSlot, type MicroKey, type Micros } from "@tatakae/core";
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "../../components/icons";
import { SegmentedPills } from "../../components/SegmentedPills";
import { useToast } from "../../components/Toast";
import { logFood, removeFood, saveFood, setFoodFavourite, type FitnessDay } from "../../lib/hooks";
import { MEALS, mealLabel, n0, parseNum } from "./shared";

// Food library + "Add to <meal>" + "New food" (docs/plans/fitness.md: manual entry only, saved for next time).

const foodLine = (f: Food) => `${f.servingLabel} · ${n0(f.kcal)} kcal · P ${Math.round(f.proteinG)} g`;
const recentLabel = (f: Food) => `${f.name} · ${f.servingLabel} · ${n0(f.kcal)}`;

export function FoodAdder(props: {
  data: FitnessDay;
  date: ISODate;
  meal: MealSlot;
  onMeal: (m: MealSlot) => void;
  onEdit: (f: Food) => void;
}) {
  const { data, date, meal } = props;
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [servings, setServings] = useState("1");
  const amount = parseNum(servings);
  const results = searchFoods(data.foods, query);
  const favourites = data.foods.filter((f) => f.favourite);

  async function add(f: Food) {
    if (amount == null || amount <= 0) {
      toast("Enter how many servings first.");
      return;
    }
    await logFood({ date, meal, servings: amount, food: f });
    toast(`Added ${f.name} to ${mealLabel(meal).toLowerCase()}.`);
  }

  async function del(f: Food) {
    await removeFood(f.id);
    toast(`Deleted ${f.name}. Past entries keep their numbers.`);
  }

  return (
    <section aria-labelledby="add-food-title" className="card flex flex-col gap-3.5">
      <h2 id="add-food-title" className="text-xl font-semibold">
        Add to {mealLabel(meal).toLowerCase()}
      </h2>
      <SegmentedPills label="Meal" options={MEALS.map((m) => ({ value: m.slot, label: m.label }))} value={meal} onChange={props.onMeal} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface-2 px-4" style={{ minHeight: 48 }}>
          <SearchIcon size={18} className="shrink-0 text-ink-2" />
          <span className="sr-only">Search your foods</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your foods"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          Servings
          <input
            inputMode="decimal"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            aria-invalid={amount == null || amount <= 0}
            className="input tnum !w-20 text-center"
          />
        </label>
      </div>

      {query.trim() === "" && data.recentFoods.length > 0 && (
        <>
          <p className="text-[13px] font-semibold text-ink-2">Recent</p>
          <div className="flex flex-wrap gap-2">
            {data.recentFoods.map((f, i) => (
              <button
                key={f.id}
                type="button"
                className={`chip text-[13px] text-ink ${i === 0 ? "bg-lime-soft" : "bg-surface-2"}`}
                onClick={() => void add(f)}
              >
                {recentLabel(f)}
              </button>
            ))}
          </div>
        </>
      )}

      {query.trim() === "" && favourites.length > 0 && <p className="text-[13px] font-semibold text-ink-2">Favourites</p>}
      {data.foods.length === 0 ? (
        <p className="text-sm text-ink-2">No saved foods yet. Add your first one with "New food". It is saved for next time.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-ink-2">No saved food matches "{query}". Add it with "New food".</p>
      ) : (
        <ul className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto">
          {(query.trim() === "" ? results.slice(0, 40) : results).map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-card-inner bg-surface-2 py-2 pl-4 pr-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.name}</p>
                <p className="tnum truncate text-xs text-ink-2">{foodLine(f)}</p>
              </div>
              <button
                type="button"
                className="icon-btn-sm bg-surface"
                aria-pressed={f.favourite}
                aria-label={f.favourite ? `Remove ${f.name} from favourites` : `Make ${f.name} a favourite`}
                onClick={() => void setFoodFavourite(f, !f.favourite)}
              >
                <span aria-hidden="true" className={`text-lg leading-none ${f.favourite ? "text-butter-band" : "text-ink-2"}`}>
                  {f.favourite ? "★" : "☆"}
                </span>
              </button>
              <button type="button" className="icon-btn-sm bg-surface" aria-label={`Edit ${f.name}`} onClick={() => props.onEdit(f)}>
                <PencilIcon size={18} />
              </button>
              <button type="button" className="icon-btn-sm bg-surface" aria-label={`Delete ${f.name}`} onClick={() => void del(f)}>
                <TrashIcon size={18} />
              </button>
              <button type="button" className="icon-btn-primary !h-11 !w-11" aria-label={`Add ${f.name}`} onClick={() => void add(f)}>
                <PlusIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface Fields {
  name: string;
  serving: string;
  servingG: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  micros: Partial<Record<MicroKey, string>>;
}

const blank: Fields = { name: "", serving: "", servingG: "", kcal: "", protein: "", carbs: "", fat: "", fibre: "", micros: {} };

function fieldsOf(f: Food | null): Fields {
  if (!f) return blank;
  const micros: Partial<Record<MicroKey, string>> = {};
  for (const k of MICRO_KEYS) if (f.micros[k] != null) micros[k] = String(f.micros[k]);
  return {
    name: f.name,
    serving: f.servingLabel,
    servingG: f.servingG != null ? String(f.servingG) : "",
    kcal: String(f.kcal),
    protein: String(f.proteinG),
    carbs: String(f.carbsG),
    fat: String(f.fatG),
    fibre: f.fibreG != null ? String(f.fibreG) : "",
    micros,
  };
}

/** Manual new / edit food form. Calories and the three macros are required; everything else is optional. */
export function FoodForm(props: { food: Food | null; date: ISODate; meal: MealSlot; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Fields>(() => fieldsOf(props.food));
  const [problem, setProblem] = useState<string | null>(null);
  const editing = props.food !== null;
  const text = (k: Exclude<keyof Fields, "micros">) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  function parse() {
    const kcal = parseNum(f.kcal);
    const proteinG = parseNum(f.protein);
    const carbsG = parseNum(f.carbs);
    const fatG = parseNum(f.fat);
    if (!f.name.trim()) return "Give the food a name.";
    if (kcal == null || proteinG == null || carbsG == null || fatG == null) return "Calories, protein, carbs and fat are needed (0 is fine).";
    if (f.fibre.trim() !== "" && parseNum(f.fibre) == null) return "Fibre should be a number.";
    if (f.servingG.trim() !== "" && parseNum(f.servingG) == null) return "Serving grams should be a number.";
    for (const k of MICRO_KEYS) if ((f.micros[k] ?? "").trim() !== "" && parseNum(f.micros[k] ?? "") == null) return `${MICRO_INFO[k].label} should be a number.`;
    const micros: Micros = {};
    for (const k of MICRO_KEYS) {
      const v = parseNum(f.micros[k] ?? "");
      if (v != null) micros[k] = v;
    }
    return { kcal, proteinG, carbsG, fatG, micros };
  }

  async function save(e: FormEvent | null, andAdd: boolean) {
    e?.preventDefault();
    const p = parse();
    if (typeof p === "string") {
      setProblem(p);
      return;
    }
    setProblem(null);
    const saved = await saveFood({
      id: props.food?.id,
      name: f.name,
      servingLabel: f.serving,
      servingG: parseNum(f.servingG),
      kcal: p.kcal,
      proteinG: p.proteinG,
      carbsG: p.carbsG,
      fatG: p.fatG,
      fibreG: parseNum(f.fibre),
      micros: p.micros,
      favourite: props.food?.favourite ?? false,
    });
    if (andAdd) await logFood({ date: props.date, meal: props.meal, servings: 1, food: saved });
    toast(andAdd ? `Saved ${saved.name} and added it to ${mealLabel(props.meal).toLowerCase()}.` : `Saved ${saved.name}.`);
    setF(blank);
    props.onDone();
  }

  const field = (label: string, key: Exclude<keyof Fields, "micros">, opts: { mode?: "decimal" | "text"; span?: boolean } = {}) => (
    <label className={`flex min-w-0 flex-col gap-1.5 ${opts.span ? "col-span-2" : ""}`}>
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <input value={f[key]} onChange={text(key)} inputMode={opts.mode ?? "decimal"} className="input" />
    </label>
  );

  return (
    <form onSubmit={(e) => void save(e, !editing)} aria-labelledby="new-food-title" className="card flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="new-food-title" className="text-xl font-semibold">
          {editing ? `Edit ${props.food?.name}` : "New food"}
        </h2>
        <span className="text-[13px] text-ink-2">{editing ? "Past entries keep their numbers" : "Saved for next time"}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field("Name", "name", { mode: "text", span: true })}
        {field("Serving (e.g. 1 cup)", "serving", { mode: "text" })}
        {field("Serving in grams (optional)", "servingG")}
        {field("Calories (kcal)", "kcal", { span: true })}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field("Protein g", "protein")}
        {field("Carbs g", "carbs")}
        {field("Fat g", "fat")}
        {field("Fibre g", "fibre")}
      </div>
      <details className="border-t border-line pt-3">
        <summary className="flex min-h-tap cursor-pointer items-center text-sm font-semibold">More nutrients (optional): sodium, iron, calcium, vitamins…</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MICRO_KEYS.filter((k) => k !== "fibre").map((k) => (
            <label key={k} className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">
                {MICRO_INFO[k].label} ({MICRO_INFO[k].unit})
              </span>
              <input
                value={f.micros[k] ?? ""}
                onChange={(e) => setF((s) => ({ ...s, micros: { ...s.micros, [k]: e.target.value } }))}
                inputMode="decimal"
                className="input"
              />
            </label>
          ))}
        </div>
      </details>
      <p className="text-xs text-ink-2">Numbers are for one serving.</p>
      {problem && (
        <p role="alert" className="text-sm font-medium text-ink">
          {problem}
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2.5">
        <button type="submit" className="btn-primary">
          {editing ? "Save changes" : `Save and add to ${mealLabel(props.meal).toLowerCase()}`}
        </button>
        {!editing && (
          <button type="button" className="btn-outline" onClick={() => void save(null, false)}>
            Save only
          </button>
        )}
        {editing && (
          <button type="button" className="btn-outline" onClick={props.onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
