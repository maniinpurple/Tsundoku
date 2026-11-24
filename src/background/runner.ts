import { browser } from "wxt/browser";
import { downloadSegments, remuxToMp4 } from "../core/download/hls-download";
import { createOpfsSink, readStoredFile, removeStoredFile, storedFileSize } from "../core/download/sink";
import { parseMediaPlaylist, pickQuality } from "../core/hls";
import { fetchText } from "../core/http";
import { languageByCode } from "../core/languages";
import type { TextTrackInput } from "../core/mp4/text-track";
import { episodePath } from "../core/naming";
import { loadSettings } from "../core/settings";
import { parseVtt, pickSubtitles, toSrt, type Cue } from "../core/subtitles";
import type { DownloadJob, Subtitle } from "../core/types";
import { addHistory, loadPart, removePart, savePart, update, type Part } from "./jobs";
import { loadStream } from "./streams";

export const tsFileName = (id: string) => `${id}.ts`;
export const mp4FileName = (id: string) => `${id}.mp4`;

export async function discardJobFiles(id: string) {
  await Promise.all([removeStoredFile(tsFileName(id)), removeStoredFile(mp4FileName(id)), removePart(id)]);
}

export async function runJob(job: DownloadJob, signal: AbortSignal) {
  update(job, { status: "resolving", error: undefined });
  const stream = await loadStream(job.ref, job.episode.id, job.track);
  const quality = pickQuality(stream.qualities, job.quality);
  if (!quality) throw new Error("No video quality available");
  const playlist = await fetchText(quality.playlistUrl, { referer: stream.referer, signal });
  const segments = parseMediaPlaylist(playlist, quality.playlistUrl);

  const part = await resumablePart(job.id, quality.label, segments.length);
  const keepBytes = sum(part.segmentSizes);
  update(job, {
    status: "downloading",
    segmentsTotal: segments.length,
    segmentsDone: part.segmentSizes.length,
    bytes: keepBytes,
  });

  const tsSink = await createOpfsSink(tsFileName(job.id), keepBytes);
  try {
    await downloadSegments({
      segments,
      startIndex: part.segmentSizes.length,
      referer: stream.referer,
      sink: tsSink,
      signal,
      onSegment: async (index, size) => {
        part.segmentSizes[index] = size;
        await savePart(job.id, part);
        update(job, { segmentsDone: index + 1, bytes: job.bytes + size });
      },
    });
  } finally {
    await tsSink.close().catch(() => {});
  }

  const settings = await loadSettings();
  const wanted = job.subtitleMode === "none" ? [] : pickSubtitles(stream.subtitles, job.subtitleLanguage);
  const subtitles = await loadSubtitles(wanted);
  const embed = job.subtitleMode === "embed" || job.subtitleMode === "both";
  const ts = await readStoredFile(tsFileName(job.id));

  update(job, { status: "converting", segmentsDone: 0 });
  const mp4Sink = await createOpfsSink(mp4FileName(job.id));
  let converted: boolean;
  try {
    converted = await remuxToMp4({
      source: ts,
      segmentSizes: part.segmentSizes,
      textTracks: embed ? subtitles.map(toTextTrack) : [],
      sink: mp4Sink,
      signal,
      onProgress: (done) => update(job, { segmentsDone: done }),
    });
  } catch (error) {
    await mp4Sink.discard();
    throw error;
  }

  update(job, { status: "saving", segmentsDone: segments.length });
  const path = episodePath(
    {
      animeTitle: job.animeTitle,
      episodeNumber: job.episode.number,
      episodeCount: job.episodeCount,
      episodeTitle: job.episode.title,
      quality: quality.label,
      track: job.track,
    },
    settings.folder,
    settings.fileNameTemplate,
  );
  const video = converted ? await mp4Sink.close() : (await mp4Sink.discard(), ts);
  const saved = await saveFile(video, `${path}.${converted ? "mp4" : "ts"}`);

  const separate = job.subtitleMode === "srt" || job.subtitleMode === "both" || (embed && !converted);
  if (separate) {
    for (const { subtitle, cues } of subtitles) {
      await saveFile(new Blob([toSrt(cues)], { type: "application/x-subrip" }), `${path}.${subtitle.lang}.srt`);
    }
  }

  await discardJobFiles(job.id);
  await addHistory({
    sourceId: job.ref.sourceId,
    animeId: job.ref.animeId,
    episodeId: job.episode.id,
    track: job.track,
    fileName: saved.fileName,
    downloadId: saved.id,
    at: Date.now(),
  });
  update(job, {
    status: "done",
    quality: quality.label,
    fileName: saved.fileName,
    downloadId: saved.id,
    note: converted ? undefined : "Saved as .ts with separate subtitles: this stream could not be converted to MP4",
  });
}

/** Keeps what an earlier attempt downloaded, as long as it is the same playlist. */
async function resumablePart(id: string, quality: string, segmentsTotal: number): Promise<Part> {
  const saved = await loadPart(id);
  if (!saved || saved.quality !== quality || saved.segmentsTotal !== segmentsTotal) {
    await removeStoredFile(tsFileName(id));
    return { quality, segmentsTotal, segmentSizes: [] };
  }
  const onDisk = await storedFileSize(tsFileName(id));
  const sizes: number[] = [];
  let total = 0;
  for (const size of saved.segmentSizes) {
    if (size === undefined || total + size > onDisk) break;
    sizes.push(size);
    total += size;
  }
  return { quality, segmentsTotal, segmentSizes: sizes };
}

async function loadSubtitles(subtitles: Subtitle[]): Promise<{ subtitle: Subtitle; cues: Cue[] }[]> {
  const loaded = await Promise.all(
    subtitles.map(async (subtitle) => {
      try {
        return { subtitle, cues: parseVtt(await fetchText(subtitle.url)) };
      } catch {
        return undefined;
      }
    }),
  );
  return loaded.filter((entry) => entry !== undefined && entry.cues.length > 0) as { subtitle: Subtitle; cues: Cue[] }[];
}

function toTextTrack({ subtitle, cues }: { subtitle: Subtitle; cues: Cue[] }, index: number): TextTrackInput {
  return { language: languageByCode(subtitle.lang), cues, isDefault: index === 0 };
}

async function saveFile(file: Blob, filename: string): Promise<{ id: number; fileName: string }> {
  const url = URL.createObjectURL(file);
  try {
    const id = await browser.downloads.download({ url, filename, conflictAction: "uniquify", saveAs: false });
    await waitForDownload(id);
    const [item] = await browser.downloads.search({ id });
    return { id, fileName: item?.filename ?? filename };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function waitForDownload(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const listener = (delta: Parameters<Parameters<typeof browser.downloads.onChanged.addListener>[0]>[0]) => {
      if (delta.id !== id || !delta.state) return;
      if (delta.state.current === "complete") done(resolve);
      if (delta.state.current === "interrupted") {
        done(() => reject(new Error(`Saving failed (${delta.error?.current ?? "interrupted"})`)));
      }
    };
    const done = (finish: () => void) => {
      browser.downloads.onChanged.removeListener(listener);
      finish();
    };
    browser.downloads.onChanged.addListener(listener);
  });
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
