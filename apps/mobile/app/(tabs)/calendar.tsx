import { Text, View } from "react-native";

// Calendar tab (docs/11 §4, refs 01/03): month header ‹ › + "This month" pill, Day/Week/Month SegmentedPills,
// MonthCalendar of DayCircles + legend, then 4 MetricCards (today score, days shown up, 7-day avg, P1 hit rate).
// Week pill → HatchedStackBar + StripeTrend. Tap a day → /day/[date]. Computed locally from SQLite (offline).
export default function Calendar() {
  // TODO(v1)
  return <View><Text>Calendar</Text></View>;
}
