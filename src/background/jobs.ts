import { browser } from "wxt/browser";
import type { AnimeRef, DownloadJob } from "../core/types";

const JOBS_KEY = "jobs";
const HISTORY_KEY = "history";
const JOB_LIMIT = 300;
const HISTORY_LIMIT = 5000;
const SAVE_DELAY_MS = 1000;

export const FINISHED = ["done", "failed", "cancelled"];
export const isFinished = (job: DownloadJob) => FINISHED.includes(job.status);

export interface Part {
  quality: string;
  segmentsTotal: number;
  segmentSizes: number[];
}

export interface HistoryEntry {
  sourceId: string;
  animeId: string;
  episodeId: string;
  track: string;
  fileName: string;
  downloadId?: number;
  at: number;
}

export const jobs: DownloadJob[] = [];
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export async function loadJobs(): Promise<DownloadJob[]> {
  const saved = ((await browser.storage.local.get(JOBS_KEY))[JOBS_KEY] ?? []) as DownloadJob[];
  jobs.splice(0, jobs.length, ...saved);
  return jobs;
}

export function saveJobsSoon() {
  saveTimer ??= setTimeout(() => {
    saveTimer = undefined;
    void saveJobsNow();
  }, SAVE_DELAY_MS);
}

export async function saveJobsNow() {
  const keep = jobs.filter((job) => !isFinished(job));
  const finished = jobs.filter(isFinished).slice(-Math.max(0, JOB_LIMIT - keep.length));
  const kept = new Set([...keep, ...finished]);
  await browser.storage.local.set({ [JOBS_KEY]: jobs.filter((job) => kept.has(job)) });
}

export function update(job: DownloadJob, changes: Partial<DownloadJob>) {
  Object.assign(job, changes);
  saveJobsSoon();
}

const partKey = (id: string) => `part:${id}`;

export async function loadPart(id: string): Promise<Part | undefined> {
  return (await browser.storage.local.get(partKey(id)))[partKey(id)] as Part | undefined;
}

export async function savePart(id: string, part: Part) {
  await browser.storage.local.set({ [partKey(id)]: part });
}

export async function removePart(id: string) {
  await browser.storage.local.remove(partKey(id));
}

async function readHistory(): Promise<HistoryEntry[]> {
  return ((await browser.storage.local.get(HISTORY_KEY))[HISTORY_KEY] ?? []) as HistoryEntry[];
}

export async function historyFor(ref: AnimeRef): Promise<HistoryEntry[]> {
  return (await readHistory()).filter((e) => e.sourceId === ref.sourceId && e.animeId === ref.animeId);
}

export async function addHistory(entry: HistoryEntry) {
  const history = (await readHistory()).filter(
    (e) => !(e.sourceId === entry.sourceId && e.episodeId === entry.episodeId && e.track === entry.track),
  );
  history.push(entry);
  await browser.storage.local.set({ [HISTORY_KEY]: history.slice(-HISTORY_LIMIT) });
}

export async function clearHistory() {
  await browser.storage.local.remove(HISTORY_KEY);
}
