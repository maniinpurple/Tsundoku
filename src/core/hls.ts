import { FetchError } from "./http";
import type { Quality } from "./types";

function parseAttributes(text: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const [, key, value] of text.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
    attrs[key!] = value!.replace(/^"|"$/g, "");
  }
  return attrs;
}

/** Qualities of a master playlist, best first. A media playlist counts as one "auto" quality. */
export function parseMasterPlaylist(text: string, masterUrl: string): Quality[] {
  if (!text.trimStart().startsWith("#EXTM3U")) throw new FetchError(`Not an HLS playlist: ${masterUrl}`);
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const qualities: Quality[] = [];

  lines.forEach((line, i) => {
    if (!line.startsWith("#EXT-X-STREAM-INF:")) return;
    const attrs = parseAttributes(line.slice("#EXT-X-STREAM-INF:".length));
    const uri = lines.slice(i + 1).find((next) => next && !next.startsWith("#"));
    if (!uri) return;
    const height = Number(attrs.RESOLUTION?.split("x")[1] ?? 0);
    qualities.push({
      label: height ? `${height}p` : "auto",
      height,
      bandwidth: attrs.BANDWIDTH ? Number(attrs.BANDWIDTH) : undefined,
      playlistUrl: new URL(uri, masterUrl).href,
    });
  });

  if (qualities.length === 0 && lines.some((line) => line.startsWith("#EXTINF"))) {
    qualities.push({ label: "auto", height: 0, playlistUrl: masterUrl });
  }
  return qualities.sort((a, b) => b.height - a.height || (b.bandwidth ?? 0) - (a.bandwidth ?? 0));
}

export function pickQuality(qualities: Quality[], wanted: string): Quality | undefined {
  const height = Number.parseInt(wanted, 10);
  if (!height) return qualities[0];
  return qualities.find((q) => q.height === height) ?? qualities.find((q) => q.height < height) ?? qualities.at(-1);
}

export interface MediaSegment {
  url: string;
  duration: number;
}

export function parseMediaPlaylist(text: string, playlistUrl: string): MediaSegment[] {
  if (!text.trimStart().startsWith("#EXTM3U")) throw new FetchError(`Not an HLS playlist: ${playlistUrl}`);
  const segments: MediaSegment[] = [];
  let duration = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#EXT-X-KEY:") && !/METHOD=NONE/.test(line)) {
      throw new FetchError("This video is encrypted, which Tsundoku does not support yet");
    }
    if (line.startsWith("#EXT-X-MAP:")) {
      throw new FetchError("This video uses fMP4 segments, which Tsundoku does not support yet");
    }
    if (line.startsWith("#EXTINF:")) duration = Number.parseFloat(line.slice(8)) || 0;
    else if (line && !line.startsWith("#")) {
      segments.push({ url: new URL(line, playlistUrl).href, duration });
      duration = 0;
    }
  }
  if (segments.length === 0) throw new FetchError("The playlist has no video segments");
  return segments;
}
