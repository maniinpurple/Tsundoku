import { browser } from "wxt/browser";
import { listStoredFiles, removeStoredFile } from "../core/download/sink";
import { loadSettings } from "../core/settings";
import type { DownloadJob, DownloadRequest } from "../core/types";
import { clearHistory, isFinished, jobs, loadJobs, saveJobsNow, update } from "./jobs";
import { discardJobFiles, runJob } from "./runner";

// Firefox may unload the background while it looks idle. The alarm wakes it up again, and
// unfinished jobs then continue from their last downloaded segment.
const WATCHDOG = "tsundoku-watchdog";

const controllers = new Map<string, AbortController>();
let workers = 0;
let ready: Promise<void> | undefined;

export function initDownloads() {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === WATCHDOG) void ensureReady().then(pump);
  });
  void ensureReady().then(pump);
}

function ensureReady(): Promise<void> {
  ready ??= (async () => {
    await loadJobs();
    for (const job of jobs) {
      if (!isFinished(job) && job.status !== "queued") {
        update(job, { status: "queued", note: "Resumed after the browser stopped the extension" });
      }
    }
    await removeOrphanFiles();
  })();
  return ready;
}

async function removeOrphanFiles() {
  const known = new Set(jobs.filter((job) => job.status !== "done" && job.status !== "cancelled").map((job) => job.id));
  for (const name of await listStoredFiles()) {
    if (!known.has(name.replace(/\.(ts|mp4)$/, ""))) await removeStoredFile(name);
  }
}

export async function listDownloads(): Promise<DownloadJob[]> {
  await ensureReady();
  return jobs;
}

export async function startDownloads(requests: DownloadRequest[]): Promise<number> {
  await ensureReady();
  let added = 0;
  for (const request of requests) {
    const existing = jobs.find(
      (j) => !isFinished(j) && j.episode.id === request.episode.id && j.track === request.track,
    );
    if (existing) continue;
    jobs.push({
      ...request,
      id: crypto.randomUUID(),
      status: "queued",
      createdAt: Date.now(),
      segmentsDone: 0,
      segmentsTotal: 0,
      bytes: 0,
    });
    added++;
  }
  await saveJobsNow();
  void pump();
  return added;
}

export async function retryDownload(id: string) {
  await ensureReady();
  const job = jobs.find((j) => j.id === id);
  if (!job || !isFinished(job) || job.status === "done") return;
  update(job, { status: "queued", error: undefined, note: undefined });
  void pump();
}

export async function cancelDownload(id: string) {
  await ensureReady();
  const job = jobs.find((j) => j.id === id);
  if (!job || isFinished(job)) return;
  const controller = controllers.get(id);
  if (controller) controller.abort(new DOMException("Cancelled", "AbortError"));
  else {
    update(job, { status: "cancelled" });
    await discardJobFiles(id);
  }
}

export async function cancelAll() {
  for (const job of [...jobs]) if (!isFinished(job)) await cancelDownload(job.id);
}

export async function clearFinished() {
  await ensureReady();
  for (let i = jobs.length - 1; i >= 0; i--) {
    const job = jobs[i]!;
    if (!isFinished(job)) continue;
    if (job.status !== "done") await discardJobFiles(job.id);
    jobs.splice(i, 1);
  }
  await saveJobsNow();
}

export { clearHistory };

async function pump() {
  await ensureReady();
  const { parallelDownloads } = await loadSettings();
  const limit = Math.min(3, Math.max(1, parallelDownloads));
  while (workers < limit && jobs.some((j) => j.status === "queued")) void worker();
  if (jobs.some((j) => !isFinished(j))) await browser.alarms.create(WATCHDOG, { periodInMinutes: 0.5 });
}

async function worker() {
  workers++;
  const keepAlive = setInterval(() => void browser.runtime.getPlatformInfo(), 20_000);
  try {
    for (let job = nextJob(); job; job = nextJob()) {
      const controller = new AbortController();
      controllers.set(job.id, controller);
      try {
        await runJob(job, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) {
          update(job, { status: "cancelled" });
          await discardJobFiles(job.id);
        } else {
          update(job, { status: "failed", error: error instanceof Error ? error.message : String(error) });
        }
      } finally {
        controllers.delete(job.id);
        await saveJobsNow();
      }
    }
  } finally {
    clearInterval(keepAlive);
    workers--;
    if (workers === 0 && !jobs.some((j) => !isFinished(j))) await browser.alarms.clear(WATCHDOG);
  }
}

function nextJob(): DownloadJob | undefined {
  const job = jobs.find((j) => j.status === "queued");
  if (job) update(job, { status: "resolving" });
  return job;
}
