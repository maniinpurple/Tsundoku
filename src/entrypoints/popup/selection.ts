import type { Episode } from "../../core/types";

/** "1-12, 15" → ids of episodes 1..12 and 15. Unknown numbers are ignored. */
export function parseRange(text: string, episodes: Episode[]): Set<string> {
  const wanted = new Set<number>();
  for (const part of text.split(/[,\s]+/).filter(Boolean)) {
    const [from, to] = part.split("-").map((n) => Number.parseInt(n, 10));
    if (from === undefined || Number.isNaN(from)) continue;
    const end = to === undefined || Number.isNaN(to) ? from : to;
    for (let n = Math.min(from, end); n <= Math.max(from, end); n++) wanted.add(n);
  }
  return new Set(episodes.filter((e) => wanted.has(e.number)).map((e) => e.id));
}
