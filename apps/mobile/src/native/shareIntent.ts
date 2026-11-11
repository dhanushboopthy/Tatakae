import { useEffect } from "react";
import { router } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { sharedText } from "./shareText";

// Android share sheet → Capture (v2.5): text and links shared from any app open the capture sheet
// prefilled, so saving to the inbox is one tap. Files and images are not accepted (text/* only).
// The app is wrapped in <ShareIntentProvider> in app/_layout.tsx.

/** While signed in, open Capture with whatever was shared, once per share. */
export function useShareToCapture(signedIn: boolean): void {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (!signedIn || !hasShareIntent) return;
    const text = sharedText(shareIntent);
    resetShareIntent();
    if (text) router.push({ pathname: "/capture", params: { text } });
  }, [signedIn, hasShareIntent, shareIntent, resetShareIntent]);
}
