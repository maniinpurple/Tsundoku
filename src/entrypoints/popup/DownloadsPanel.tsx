import { browser } from "wxt/browser";
import { send } from "../../core/messages";
import type { DownloadJob } from "../../core/types";
import { ACTIVE_STATUSES } from "./useDownloads";

export function DownloadsPanel({ jobs }: { jobs: DownloadJob[] }) {
  if (jobs.length === 0) return <p className="muted">No downloads yet. Pick episodes on an anime page.</p>;
  const hasActive = jobs.some((job) => ACTIVE_STATUSES.includes(job.status));
  const hasFinished = jobs.some((job) => !ACTIVE_STATUSES.includes(job.status));

  return (
    <section className="downloads">
      <div className="downloads-header">
        {hasActive && (
          <button className="small-button" onClick={() => send("cancelAll", {})}>
            Cancel all
          </button>
        )}
        {hasFinished && (
          <button className="small-button" onClick={() => send("clearFinished", {})}>
            Clear finished
          </button>
        )}
      </div>
      <ul>
        {[...jobs].reverse().map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </ul>
    </section>
  );
}

function JobRow({ job }: { job: DownloadJob }) {
  const active = ACTIVE_STATUSES.includes(job.status);
  const percent = job.segmentsTotal ? Math.floor((job.segmentsDone / job.segmentsTotal) * 100) : 0;
  const showProgress = job.status === "downloading" || job.status === "converting";

  return (
    <li className={`job job-${job.status}`}>
      <div className="job-line">
        <span className="job-title">
          E{job.episode.number} · {job.animeTitle}
        </span>
        {active && (
          <button className="small-button" onClick={() => send("cancelDownload", { id: job.id })}>
            Cancel
          </button>
        )}
        {(job.status === "failed" || job.status === "cancelled") && (
          <button className="small-button" onClick={() => send("retryDownload", { id: job.id })}>
            Retry
          </button>
        )}
        {job.status === "done" && job.downloadId !== undefined && <FileButtons downloadId={job.downloadId} />}
      </div>
      {showProgress && <progress max={100} value={percent} />}
      <div className="muted small">{describe(job, percent)}</div>
      {job.note && <div className="muted small note">{job.note}</div>}
    </li>
  );
}

function FileButtons({ downloadId }: { downloadId: number }) {
  const run = (action: () => Promise<unknown>) => () => void action().catch(() => {});
  return (
    <>
      <button className="small-button" onClick={run(() => browser.downloads.open(downloadId) as Promise<unknown>)}>
        Open
      </button>
      <button className="small-button" onClick={run(async () => browser.downloads.show(downloadId))} title="Show in folder">
        Folder
      </button>
    </>
  );
}

function describe(job: DownloadJob, percent: number): string {
  const tags = `${job.quality} · ${job.track === "sub" ? "Sub" : "Dub"}`;
  switch (job.status) {
    case "queued":
      return `Waiting · ${tags}`;
    case "resolving":
      return `Finding the video · ${tags}`;
    case "downloading":
      return `${percent}% · ${formatBytes(job.bytes)} · ${tags}`;
    case "converting":
      return `Converting to MP4 ${percent}%`;
    case "saving":
      return `Saving to Downloads · ${formatBytes(job.bytes)}`;
    case "done":
      return `Saved · ${formatBytes(job.bytes)} · ${job.fileName?.split(/[\\/]/).pop() ?? ""}`;
    case "failed":
      return `Failed: ${job.error ?? "unknown error"}${job.segmentsDone ? " · Retry continues where it stopped" : ""}`;
    case "cancelled":
      return "Cancelled";
    default:
      return "";
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  return `${Math.round(bytes / 1e6)} MB`;
}
