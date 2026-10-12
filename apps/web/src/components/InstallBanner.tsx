import { useInstallPrompt } from "../lib/install";
import { CloseIcon, DownloadIcon } from "./icons";

/** "Install app" offer after login (Chrome/Edge desktop). Dismissible; never shown again once dismissed. */
export function InstallBanner() {
  const { available, install, dismiss } = useInstallPrompt();
  if (!available) return null;
  return (
    <div role="region" aria-label="Install Tatakae" className="mb-6 flex items-center gap-3 rounded-legacy-card border border-legacy-line bg-legacy-ink-2 p-3">
      <DownloadIcon className="shrink-0 text-legacy-ember" />
      <p className="flex-1 text-sm">Install Tatakae as an app on this laptop. It opens in its own window and works offline.</p>
      <button type="button" className="btn-secondary" onClick={() => void install()}>
        Install app
      </button>
      <button type="button" className="btn-ghost" aria-label="Dismiss install offer" onClick={dismiss}>
        <CloseIcon />
      </button>
    </div>
  );
}
