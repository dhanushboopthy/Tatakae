import { Pressable, StyleSheet, Text, View } from "react-native";
import { RANKED_SLOTS, type Mission, type MissionStatus, type RankedSlot, type Slot } from "@tatakae/core";
import { f, minTarget, radius, space } from "../theme";
import { pressedStyle, useStyles, type Theme } from "../lib/theme";
import { STATUS_GLYPH, STATUS_LABEL, StatusChips } from "./StatusChips";
import { Icon, type AppIcon } from "./Icon";

export const SLOT_LABEL: Record<Slot, string> = {
  ...(Object.fromEntries(RANKED_SLOTS.map((s) => [s, s])) as Record<RankedSlot, string>),
  side: "Side quest",
  backlog: "Backlog",
};

export interface MissionCardProps {
  mission: Mission;
  /** Day is forged: editing locked fields asks for a reason. */
  locked?: boolean;
  onStatus: (next: MissionStatus) => void;
  onStuck?: () => void;
  onEdit?: () => void;
  onFocus?: () => void;
}

type Tone = "lavender" | "limeSoft" | "plain";

/** P2 lavender, P3 lime-soft, P4–P9 and the side quest on surface-2 (docs/10 §5). */
function toneOf(slot: Slot): Tone {
  if (slot === "P2") return "lavender";
  if (slot === "P3") return "limeSoft";
  return "plain";
}

/**
 * One mission with one-tap status chips. Missed and rescheduled render grey, never red. Pastel
 * cards carry ink text in both themes; plain cards follow the theme.
 */
export function MissionCard({ mission: m, locked = false, onStatus, onStuck, onEdit, onFocus }: MissionCardProps) {
  const s = useStyles(makeStyles);
  const grey = m.status === "missed" || m.status === "rescheduled";
  const tone: Tone = grey ? "plain" : toneOf(m.slot);
  const pastel = tone !== "plain";
  const ink = pastel ? s.onFill : s.ink;
  const ink2 = pastel ? s.onFillMuted : s.ink2;
  return (
    <View style={[s.card, s[tone]]}>
      <View style={s.head}>
        <View style={[s.rank, pastel ? s.rankOnFill : s.rankPlain]}>
          <Text style={[s.rankText, pastel ? s.rankTextOnFill : s.rankTextPlain]}>{SLOT_LABEL[m.slot]}</Text>
        </View>
        {m.estMin ? (
          <View style={[s.est, pastel ? s.estOnFill : s.estPlain]}>
            <Text style={[s.estText, ink]}>{m.estMin} min</Text>
          </View>
        ) : null}
        {m.slot === "side" ? <Text style={[s.small, ink2]}>unscored</Text> : null}
        {locked ? <Icon name="locked" size={16} color={ink2.color} /> : null}
        <View style={s.flex} />
        {m.status !== "open" ? (
          <Text style={[s.statusTag, ink2]}>
            {STATUS_GLYPH[m.status]} {STATUS_LABEL[m.status]}
          </Text>
        ) : null}
      </View>

      <Text style={[s.title, grey ? s.ink2 : ink]} accessibilityRole="header">
        {m.title}
      </Text>
      {m.minimum ? <Text style={[s.small, ink2]}>Minimum · {m.minimum}</Text> : null}
      {m.resumeNote ? <Text style={[s.small, ink2]}>Resume · {m.resumeNote}</Text> : null}

      {m.status === "rescheduled" ? (
        <Text style={[s.small, s.ink2]}>Moved to the backlog. Pick it up in the night ritual.</Text>
      ) : (
        <StatusChips status={m.status} onChange={onStatus} missionTitle={m.title} />
      )}

      {m.status !== "rescheduled" && (onFocus || onStuck || onEdit) ? (
        <View style={s.links}>
          {onFocus && m.status === "open" ? <CardAction icon="play" label="Focus" onPress={onFocus} hint="Start a focus block on this mission" pastel={pastel} /> : null}
          {onStuck && m.status === "open" ? <CardAction icon="stuck" label="Stuck" onPress={onStuck} hint="Name what is in the way" pastel={pastel} /> : null}
          {onEdit ? (
            <CardAction icon="edit" label="Edit" onPress={onEdit} hint={locked ? "Plan is locked. A change needs a short reason" : undefined} pastel={pastel} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function CardAction({ icon, label, onPress, hint, pastel }: { icon: AppIcon; label: string; onPress: () => void; hint?: string; pastel: boolean }) {
  const s = useStyles(makeStyles);
  const color = pastel ? s.onFill.color : s.ink.color;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [s.action, { borderColor: color }, pressed && pressedStyle]}
    >
      <Icon name={icon} size={16} color={color} strokeWidth={2} />
      <Text style={[s.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    card: { borderRadius: radius.card, paddingHorizontal: space(2.5), paddingVertical: space(2.25), gap: space(1.25) },
    lavender: { backgroundColor: c.lavender },
    limeSoft: { backgroundColor: c.limeSoft },
    plain: { backgroundColor: c.surface2 },
    head: { flexDirection: "row", alignItems: "center", gap: space(1) },
    flex: { flex: 1 },
    rank: { borderRadius: radius.pill, paddingHorizontal: space(1.25), paddingVertical: 5 },
    rankOnFill: { backgroundColor: c.onFill },
    rankPlain: { backgroundColor: c.ink },
    rankText: { ...f(700, 12, 16) },
    rankTextOnFill: { color: c.white },
    rankTextPlain: { color: c.surface },
    est: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space(1.25), paddingVertical: 4 },
    estOnFill: { borderColor: c.onFill },
    estPlain: { borderColor: c.ink2 },
    estText: { ...f(600, 12, 16), fontVariant: ["tabular-nums"] },
    statusTag: { ...f(600, 13, 18) },
    title: { ...f(600, 19, 25) },
    small: { ...f(500, 13, 18) },
    onFill: { color: c.onFill },
    onFillMuted: { color: c.onFillMuted },
    ink: { color: c.ink },
    ink2: { color: c.ink2 },
    links: { flexDirection: "row", flexWrap: "wrap", gap: space(0.75) },
    action: {
      minHeight: minTarget,
      paddingHorizontal: space(1.5),
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    actionText: { ...f(600, 13) },
  });
