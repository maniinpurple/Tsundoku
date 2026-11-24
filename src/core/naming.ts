import type { Track } from "./types";

export const DEFAULT_FOLDER = "Tsundoku";
export const DEFAULT_TEMPLATE = "{anime}/{anime} - E{episode} [{quality}] [{track}]";
export const TEMPLATE_TOKENS = ["anime", "episode", "title", "quality", "track"] as const;

export function safeName(text: string): string {
  return text
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120);
}

export interface EpisodeNameParts {
  animeTitle: string;
  episodeNumber: number;
  episodeCount: number;
  episodeTitle: string;
  quality: string;
  track: Track;
}

/** Path inside the Downloads folder, without extension, e.g. "Tsundoku/Frieren/Frieren - E01 [1080p] [Sub]". */
export function episodePath(parts: EpisodeNameParts, folder = DEFAULT_FOLDER, template = DEFAULT_TEMPLATE): string {
  const values: Record<(typeof TEMPLATE_TOKENS)[number], string> = {
    anime: safeName(parts.animeTitle) || "Anime",
    episode: String(parts.episodeNumber).padStart(Math.max(2, String(parts.episodeCount).length), "0"),
    title: safeName(parts.episodeTitle),
    quality: parts.quality,
    track: parts.track === "sub" ? "Sub" : "Dub",
  };
  const rendered = (template.trim() || DEFAULT_TEMPLATE).replace(
    /\{(\w+)\}/g,
    (match, token: string) => values[token as keyof typeof values] ?? match,
  );
  const segments = [...folder.split(/[\\/]/), ...rendered.split(/[\\/]/)].map(safeName).filter(Boolean);
  return segments.join("/") || values.anime;
}
