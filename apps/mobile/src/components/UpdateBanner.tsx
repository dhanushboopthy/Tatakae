import { Linking, StyleSheet, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { dismissUpdate, useUpdateNotice } from "../lib/appUpdate";
import { f, space } from "../theme";
import { useStyles, type Theme } from "../lib/theme";
import { BigButton } from "./BigButton";
import { Card } from "./Screen";

/**
 * Calm "a newer version is ready" card (v4.3). Never blocks: the app keeps working. On Today it has
 * "Later" (hidden until the next version); in Settings (`persistent`) it stays while it applies.
 */
export function UpdateBanner({ persistent = false }: { persistent?: boolean }) {
  const s = useStyles(makeStyles);
  const notice = useUpdateNotice({ ignoreDismiss: persistent });
  if (!notice) return null;
  return (
    <Card>
      <Text style={s.title} accessibilityRole="header">
        Version {notice.version} is ready
      </Text>
      <Text style={s.body}>Download the new app when it suits you. Everything here keeps working until then.</Text>
      <View style={s.row}>
        <BigButton label="Download" size="compact" icon="open" onPress={() => void Linking.openURL(notice.url)} accessibilityHint="Opens the release page in the browser" />
        {!persistent ? <BigButton label="Later" size="compact" variant="quiet" onPress={() => void dismissUpdate(notice.version)} accessibilityHint="Hides this until the next version" /> : null}
      </View>
    </Card>
  );
}

/** Settings only: a JS fix (EAS Update) has downloaded and applies on the next launch. */
export function PendingFixNote() {
  const s = useStyles(makeStyles);
  const { isUpdatePending } = Updates.useUpdates();
  if (!Updates.isEnabled || !isUpdatePending) return null;
  return (
    <Card>
      <Text style={s.body} accessibilityLiveRegion="polite">
        A small fix has downloaded. It applies the next time the app opens.
      </Text>
      <View style={s.row}>
        <BigButton label="Restart now" size="compact" variant="secondary" icon="sync" onPress={() => void Updates.reloadAsync()} />
      </View>
    </Card>
  );
}

const makeStyles = ({ c }: Theme) =>
  StyleSheet.create({
    title: { ...f(600, 16, 22), color: c.ink },
    body: { ...f(500, 14, 20), color: c.ink2 },
    row: { flexDirection: "row", alignItems: "center", gap: space(1) },
  });
