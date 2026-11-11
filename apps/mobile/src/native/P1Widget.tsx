import { FlexWidget, TextWidget, type ColorProp } from "react-native-android-widget";
import { light } from "../theme";

// Home-screen widget (v2.5): today's P1 with Start and Done on the charcoal hero style (docs/10 §5).
// Widgets render natively from this JSX in a background task, so they use the day palette only and
// the system font. Text on lime / white pills is ink.

const hex = (c: string) => c as ColorProp;

export interface P1WidgetProps {
  /** null = nothing planned for today yet. */
  missionId: string | null;
  title: string | null;
  minimum: string | null;
  status: "open" | "done" | "minimum" | "missed" | "rescheduled" | "backlog" | null;
}

export function P1Widget({ missionId, title, minimum, status }: P1WidgetProps) {
  const open = status === "open";
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: hex(light.hero),
        borderRadius: 28,
        padding: 16,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      clickAction="OPEN_APP"
      accessibilityLabel={title ? `P1: ${title}` : "Tatakae: no P1 yet"}
    >
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 8 }}>
        <FlexWidget style={{ backgroundColor: hex(light.lime), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <TextWidget text="P1" style={{ fontSize: 12, fontWeight: "700", color: hex(light.onFill) }} />
        </FlexWidget>
        {status && !open ? (
          <TextWidget text={status === "done" ? "Done ✓" : status === "minimum" ? "Minimum ◐" : "Not this time"} style={{ fontSize: 12, fontWeight: "600", color: hex(light.onHeroMuted) }} />
        ) : null}
      </FlexWidget>

      <FlexWidget style={{ flexDirection: "column", flexGap: 2 }}>
        <TextWidget text={title ?? "No P1 yet today"} maxLines={2} truncate="END" style={{ fontSize: 17, fontWeight: "600", color: hex(light.onHero) }} />
        <TextWidget
          text={title ? (minimum ? `Minimum · ${minimum}` : " ") : "Tap to plan one mission."}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 12, color: hex(light.onHeroMuted) }}
        />
      </FlexWidget>

      {missionId && open ? (
        <FlexWidget style={{ flexDirection: "row", flexGap: 8 }}>
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: `tatakae://focus?start=${encodeURIComponent(missionId)}` }}
            accessibilityLabel="Start focus on P1"
            style={{ backgroundColor: hex(light.lime), borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}
          >
            <TextWidget text="Start" style={{ fontSize: 14, fontWeight: "600", color: hex(light.onFill) }} />
          </FlexWidget>
          <FlexWidget
            clickAction="DONE"
            clickActionData={{ missionId }}
            accessibilityLabel="Mark P1 done"
            style={{ backgroundColor: hex(light.white), borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}
          >
            <TextWidget text="Done" style={{ fontSize: 14, fontWeight: "600", color: hex(light.onFill) }} />
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
