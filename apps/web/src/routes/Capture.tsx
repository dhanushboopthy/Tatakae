import { useNavigate, useSearchParams } from "react-router-dom";
import { CaptureForm } from "../components/CaptureDialog";
import { PageHeader } from "../components/PageHeader";

// Laptop quick capture page: also the PWA share target (?title=&text=&url= prefill the field).
// The same form opens as a dialog from the "+" in any header or the "c" key.
export function Capture() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const shared = [params.get("title"), params.get("text"), params.get("url")]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s)
    .join(" — ");
  return (
    <div className="page-read">
      <PageHeader eyebrow="Capture" title="What's on your mind?" quiet />
      <section className="card space-y-3">
        <CaptureForm initial={shared} onDone={() => shared && navigate("/inbox", { replace: true })} />
        <p className="text-sm text-ink-2">It goes to the inbox. No sorting now.</p>
      </section>
    </div>
  );
}
