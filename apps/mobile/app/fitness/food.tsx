import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { istTimeHHMM, mealForTime, remaining, searchFoods, type Food, type MealSlot } from "@tatakae/core";
import { copyFoodLogs, logFood, saveFood, useFitnessDay } from "../../src/lib/fitness";
import { useToday } from "../../src/lib/hooks";
import { Choice } from "../../src/components/Choice";
import { Toast } from "../../src/components/Toast";
import { MiniBar, PillButton, SheetHeader, fill, n0, parseNum } from "../../src/components/fitnessUi";
import { tapDone } from "../../src/haptics";
import { colors, legacyRadius, minTarget, space, text, tnum, type, ui } from "../../src/theme";

// Log food (design canvas "Phone · Log food"): meal slot preselected by the time of day, search your saved foods,
// copy yesterday's meal, recents and favourites one tap each, and "New food (enter by hand)". Manual entry only,
// saved for next time; nothing leaves the phone except through the outbox. Target: ≤ 60 s for a meal.

const MEALS: readonly { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "snack", label: "Snack" },
  { value: "dinner", label: "Dinner" },
];

const line = (f: Food) => `${f.servingLabel} · ${n0(f.kcal)} kcal · P ${Math.round(f.proteinG)} g`;

export default function LogFood() {
  const today = useToday();
  const { data } = useFitnessDay(today);
  const [meal, setMeal] = useState<MealSlot>(() => mealForTime(istTimeHHMM()));
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState({ message: "", token: 0 });
  const say = (message: string) => setToast((t) => ({ message, token: t.token + 1 }));

  const list = useMemo(() => {
    if (!data) return [];
    if (query.trim() !== "") return searchFoods(data.foods, query);
    const seen = new Set<string>();
    const out: Food[] = [];
    for (const f of [...data.recentFoods, ...data.foods.filter((x) => x.favourite)]) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        out.push(f);
      }
    }
    return out;
  }, [data, query]);

  if (!data) return <SafeAreaView style={ui.screen} edges={["top"]} />;

  const eaten = data.totals.kcal;
  const target = data.targets?.kcal ?? data.maintenance.kcal;
  const kcal = remaining(eaten, target);
  const proteinTarget = data.targets?.proteinG ?? null;
  const protein = Math.round(data.totals.proteinG);
  const yesterdayMeal = data.yesterdayLogs.filter((l) => l.meal === meal);
  const todayMeal = data.logs.filter((l) => l.meal === meal);
  const yKcal = Math.round(yesterdayMeal.reduce((s, l) => s + l.kcal * l.servings, 0));
  const yProtein = Math.round(yesterdayMeal.reduce((s, l) => s + l.proteinG * l.servings, 0));

  async function add(f: Food) {
    await logFood({ date: today, meal, food: f });
    tapDone();
    say(`Added ${f.name}`);
  }

  return (
    <SafeAreaView style={ui.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SheetHeader title={creating ? "New food" : "Add food"} onClose={() => (creating ? setCreating(false) : router.back())} />
        {creating ? (
          <NewFood
            meal={meal}
            onSaved={async (food, addIt) => {
              if (addIt) await logFood({ date: today, meal, food });
              tapDone();
              say(addIt ? `Saved and added ${food.name}` : `Saved ${food.name}`);
              setCreating(false);
            }}
          />
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Choice options={MEALS} value={meal} onChange={setMeal} accessibilityLabel="Meal" />

              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search your foods"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Search your foods"
                returnKeyType="search"
                style={[ui.input, styles.search]}
              />

              {query.trim() === "" && yesterdayMeal.length > 0 && todayMeal.length === 0 ? (
                <Pressable
                  onPress={async () => {
                    const n = await copyFoodLogs(data.yesterdayLogs, today, meal);
                    tapDone();
                    say(`Copied ${n} ${n === 1 ? "entry" : "entries"}`);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Copy yesterday's ${meal}`}
                  style={({ pressed }) => [styles.copy, pressed && styles.pressed]}
                >
                  <View style={styles.copyText}>
                    <Text style={styles.copyTitle}>Copy yesterday's {meal}</Text>
                    <Text style={[styles.copySub, tnum]}>
                      {yesterdayMeal.map((l) => l.name).slice(0, 2).join(" + ")}
                      {yesterdayMeal.length > 2 ? ` + ${yesterdayMeal.length - 2}` : ""} · {n0(yKcal)} kcal · P {yProtein} g
                    </Text>
                  </View>
                  <Text style={styles.copyGlyph}>⧉</Text>
                </Pressable>
              ) : null}

              <Text style={text.label}>{query.trim() === "" ? "Recent and favourites" : "Your foods"}</Text>
              {list.length === 0 ? (
                <Text style={text.small}>
                  {data.foods.length === 0 ? "No saved foods yet. Add your first one by hand below. It is saved for next time." : `No saved food matches "${query}".`}
                </Text>
              ) : (
                list.map((f) => (
                  <View key={f.id} style={styles.item}>
                    <View style={styles.itemText}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {f.favourite ? "★ " : ""}
                        {f.name}
                      </Text>
                      <Text style={[text.small, tnum]} numberOfLines={1}>
                        {line(f)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void add(f)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${f.name}`}
                      style={({ pressed }) => [styles.add, pressed && styles.pressed]}
                    >
                      <Text style={styles.addGlyph}>+</Text>
                    </Pressable>
                  </View>
                ))
              )}

              <Pressable
                onPress={() => setCreating(true)}
                accessibilityRole="button"
                accessibilityLabel="New food, enter by hand"
                style={({ pressed }) => [styles.newFood, pressed && styles.pressed]}
              >
                <Text style={styles.newFoodText}>New food (enter by hand)</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.totals}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Today</Text>
                <Text style={[text.body, tnum]}>
                  <Text style={styles.bold}>{n0(eaten)}</Text> / {n0(target)} kcal
                  {proteinTarget != null ? (
                    <>
                      {" "}
                      · <Text style={styles.bold}>{protein}</Text> / {proteinTarget} g P
                    </>
                  ) : null}
                </Text>
              </View>
              <View style={styles.totalsBars}>
                <MiniBar pct={kcal.pct} color={colors.paper} label="Calories eaten" style={styles.fill} />
                {proteinTarget != null ? <MiniBar pct={proteinTarget > 0 ? (protein / proteinTarget) * 100 : 0} color={colors.paper} label="Protein eaten" style={styles.fill} /> : null}
              </View>
              {kcal.over ? <Text style={text.small}>{n0(Math.abs(kcal.left))} kcal over today's target.</Text> : null}
            </View>
          </>
        )}
        <View style={styles.toast} pointerEvents="none">
          <Toast message={toast.message} token={toast.token} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Manual new-food form. Calories and the three macros are needed (0 is fine); fibre is optional. */
function NewFood({ meal, onSaved }: { meal: MealSlot; onSaved: (food: Food, addIt: boolean) => Promise<void> }) {
  const [f, setF] = useState({ name: "", serving: "", kcal: "", protein: "", carbs: "", fat: "", fibre: "" });
  const [problem, setProblem] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save(addIt: boolean) {
    const kcal = parseNum(f.kcal);
    const proteinG = parseNum(f.protein);
    const carbsG = parseNum(f.carbs);
    const fatG = parseNum(f.fat);
    if (!f.name.trim()) return setProblem("Give the food a name.");
    if (kcal == null || proteinG == null || carbsG == null || fatG == null) return setProblem("Calories, protein, carbs and fat are needed (0 is fine).");
    if (f.fibre.trim() !== "" && parseNum(f.fibre) == null) return setProblem("Fibre should be a number.");
    setProblem(null);
    const food = await saveFood({ name: f.name, servingLabel: f.serving, kcal, proteinG, carbsG, fatG, fibreG: parseNum(f.fibre) });
    await onSaved(food, addIt);
  }

  const field = (label: string, key: keyof typeof f, numeric: boolean, flex = false) => (
    <View style={[styles.field, flex && styles.fill]}>
      <Text style={text.label}>{label}</Text>
      <TextInput
        value={f[key]}
        onChangeText={set(key)}
        keyboardType={numeric ? "decimal-pad" : "default"}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[ui.input, numeric && tnum]}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {field("Name", "name", false)}
      {field("Serving (e.g. 1 cup)", "serving", false)}
      {field("Calories (kcal)", "kcal", true)}
      <View style={styles.macros}>
        {field("Protein g", "protein", true, true)}
        {field("Carbs g", "carbs", true, true)}
      </View>
      <View style={styles.macros}>
        {field("Fat g", "fat", true, true)}
        {field("Fibre g", "fibre", true, true)}
      </View>
      <Text style={text.small}>Numbers are for one serving. More nutrients can be added on the laptop.</Text>
      {problem ? (
        <Text accessibilityRole="alert" style={text.body}>
          {problem}
        </Text>
      ) : null}
      <PillButton label={`Save and add to ${meal}`} tone="primary" onPress={() => void save(true)} style={styles.tall} />
      <PillButton label="Save only" tone="neutral" onPress={() => void save(false)} style={styles.tall} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space(2), paddingBottom: space(3), gap: space(1.5) },
  search: { borderRadius: legacyRadius.pill, minHeight: 48 },
  copy: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.5),
    minHeight: minTarget + 12,
    paddingHorizontal: space(2),
    paddingVertical: space(1.25),
    backgroundColor: fill.lavenderSoft,
    borderRadius: legacyRadius.card,
  },
  copyText: { flex: 1 },
  copyTitle: { color: fill.ink, fontSize: type.small, fontWeight: "600" },
  copySub: { color: fill.inkMuted, fontSize: 12 },
  copyGlyph: { color: fill.ink, fontSize: 20 },
  item: { flexDirection: "row", alignItems: "center", gap: space(1.5), minHeight: minTarget + 8 },
  itemText: { flex: 1 },
  itemName: { color: colors.paper, fontSize: type.body, fontWeight: "600" },
  add: { width: minTarget, height: minTarget, borderRadius: legacyRadius.pill, backgroundColor: colors.ember, alignItems: "center", justifyContent: "center" },
  addGlyph: { color: fill.ink, fontSize: 26, fontWeight: "600", marginTop: -2 },
  newFood: { minHeight: 52, borderRadius: legacyRadius.pill, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
  newFoodText: { color: colors.paper, fontSize: type.body, fontWeight: "600" },
  totals: { paddingHorizontal: space(2), paddingVertical: space(1.5), gap: space(1), backgroundColor: colors.ink2, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space(1), flexWrap: "wrap" },
  totalsLabel: { color: colors.paper, fontSize: type.small, fontWeight: "600" },
  totalsBars: { flexDirection: "row", gap: space(1) },
  bold: { fontWeight: "700" },
  field: { gap: 6 },
  macros: { flexDirection: "row", gap: space(1.5) },
  tall: { minHeight: 52 },
  pressed: { opacity: 0.85 },
  toast: { position: "absolute", bottom: 140, left: 0, right: 0 },
});
