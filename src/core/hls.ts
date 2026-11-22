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
