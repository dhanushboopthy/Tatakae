// App entry: Expo Router, plus the Android widget's background task handler, which must be
// registered before the app starts (react-native-android-widget).
import "expo-router/entry";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./src/native/widget";

registerWidgetTaskHandler(widgetTaskHandler);
