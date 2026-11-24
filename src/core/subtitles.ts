import type { Subtitle } from "./types";

export interface Cue {
  /** Milliseconds. */
  start: number;
  end: number;
  text: string;
}

export const ALL_LANGUAGES = "all";

/** The wanted language, falling back to English, then the site's default. "all" keeps every track. */
export function pickSubtitles(subtitles: Subtitle[], language: string): Subtitle[] {
  if (language === ALL_LANGUAGES) {
    const rank = (s: Subtitle) => (s.lang === "en" ? 0 : s.default ? 1 : 2);
    return [...subtitles].sort((a, b) => rank(a) - rank(b));
  }
  const one =
    subtitles.find((s) => s.lang === language) ??
    subtitles.find((s) => s.lang === "en") ??
    subtitles.find((s) => s.default) ??
    subtitles[0];
  return one ? [one] : [];
}

export function parseVtt(vtt: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of vtt.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const timing = lines.findIndex((line) => line.includes("-->"));
    if (timing === -1) continue;
    const [start, end] = lines[timing]!.split("-->").map((part) => parseTime(part.trim().split(/\s+/)[0]!));
    const text = lines
      .slice(timing + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .trim();
    if (text && end! > start!) cues.push({ start: start!, end: end!, text });
  }
  return cues.sort((a, b) => a.start - b.start);
}

export function toSrt(cues: Cue[]): string {
  return cues.map((cue, i) => `${i + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}`).join("\n\n") + "\n";
}

function parseTime(text: string): number {
  const parts = text.split(":").map((part) => Number.parseFloat(part.replace(",", ".")));
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  return Math.round(((h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0)) * 1000);
}

function srtTime(ms: number): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}
