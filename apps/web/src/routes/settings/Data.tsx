import { useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { api, isNetworkError } from "../../lib/api";
import { Section } from "./Section";

// Data (v4): full JSON export (GET /api/export) and the backup job log (GET /api/system/jobs).

interface JobRun {
  id: string;
  job: string;
  startedAt: string;
  ok: boolean;
  detail: string | null;
}

function parseJobs(body: unknown): JobRun[] {
  if (typeof body !== "object" || body === null) return [];
  const list = (body as { runs?: unknown }).runs;
  return Array.isArray(list) ? (list as JobRun[]) : [];
}

export function DataSettings() {
  const toast = useToast();
  const jobs = useQuery({ queryKey: ["rest", "jobs"], queryFn: async () => parseJobs(await api("/system/jobs")), retry: false });

  async function exportAll() {
    try {
      const body = await api("/export");
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tatakae-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(isNetworkError(e) ? "Export needs a connection." : "Export failed. Try again.");
    }
  }

  return (
    <Section id="data" title="Data" description="Everything is yours. Litestream streams the database off the VM; a JSON copy is made every night.">
      <button type="button" className="btn-secondary" onClick={() => void exportAll()}>
        <DownloadIcon size={18} /> Download everything (JSON)
      </button>
      <div>
        <p className="mb-2 font-semibold">System jobs</p>
        {jobs.isError ? (
          <p className="text-sm text-ink-2">The job log needs a connection.</p>
        ) : (jobs.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-2">No job runs yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(jobs.data ?? []).slice(0, 10).map((j) => (
              <li key={j.id} className="flex flex-wrap justify-between gap-3">
                <span className="font-medium">{j.job}</span>
                <span className="tnum text-ink-2">
                  {new Date(j.startedAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {j.ok ? "ok" : `not ok${j.detail ? `: ${j.detail}` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
