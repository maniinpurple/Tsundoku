import { FetchError, fetchBytes } from "../http";
import type { MediaSegment } from "../hls";
import { Mp4Flattener } from "../mp4/flatten";
import type { TextTrackInput } from "../mp4/text-track";
import { createTransmuxer } from "../mp4/transmux";
import type { Sink } from "./sink";

const RETRIES = 7;
const SEGMENT_TIMEOUT_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

export interface SegmentDownloadOptions {
  segments: MediaSegment[];
  /** Segments before this index are already in the sink (resume). */
  startIndex: number;
  referer?: string;
  sink: Sink;
  signal: AbortSignal;
  concurrency?: number;
  onSegment: (index: number, size: number) => Promise<void> | void;
}

export async function downloadSegments(options: SegmentDownloadOptions): Promise<void> {
  const { segments, startIndex, referer, sink, signal, concurrency = 4, onSegment } = options;
  let index = startIndex;
  for await (const bytes of fetchInOrder(segments.slice(startIndex), concurrency, signal, referer)) {
    await sink.write(bytes);
    await onSegment(index++, bytes.length);
  }
}

export interface RemuxOptions {
  source: Blob;
  segmentSizes: number[];
  textTracks: TextTrackInput[];
  sink: Sink;
  signal: AbortSignal;
  onProgress?: (segmentsDone: number) => void;
}

/** Rewrites the downloaded TS as a regular MP4. Returns false if the stream cannot be remuxed. */
export async function remuxToMp4({ source, segmentSizes, textTracks, sink, signal, onProgress }: RemuxOptions) {
  const transmuxer = createTransmuxer();
  const mp4 = new Mp4Flattener(sink);
  let offset = 0;
  for (const [i, size] of segmentSizes.entries()) {
    signal.throwIfAborted();
    const segment = new Uint8Array(await source.slice(offset, offset + size).arrayBuffer());
    offset += size;
    for (const fragment of transmuxer.push(segment)) {
      if (!mp4.hasInit) await mp4.start(fragment.initSegment);
      await mp4.addFragments(fragment.data);
    }
    if (i === 0 && !mp4.hasInit) return false;
    onProgress?.(i + 1);
  }
  await mp4.finish(textTracks);
  return true;
}

async function* fetchInOrder(segments: MediaSegment[], concurrency: number, signal: AbortSignal, referer?: string) {
  const pending: Promise<Uint8Array>[] = [];
  let next = 0;
  const launch = () => {
    if (next >= segments.length) return;
    const promise = fetchSegment(segments[next++]!.url, signal, referer);
    promise.catch(() => {});
    pending.push(promise);
  };
  for (let i = 0; i < concurrency; i++) launch();
  while (pending.length > 0) {
    const bytes = await pending.shift()!;
    launch();
    yield bytes;
  }
}

// CDNs answer 403/429 when hit too fast, so those get a longer pause than other errors.
async function fetchSegment(url: string, signal: AbortSignal, referer?: string): Promise<Uint8Array> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchBytes(url, { signal, referer, timeoutMs: SEGMENT_TIMEOUT_MS });
    } catch (error) {
      if (signal.aborted || attempt >= RETRIES) throw error;
      const throttled = error instanceof FetchError && (error.status === 403 || error.status === 429);
      const base = throttled ? 4000 : 1000;
      await sleep(Math.min(MAX_BACKOFF_MS, base * 2 ** (attempt - 1)), signal);
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });
}
