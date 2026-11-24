import { getSource } from "../core/registry";
import { resolveEpisode } from "../core/resolve";
import type { AnimeRef, Source, Track } from "../core/types";
import { cached } from "./cache";

const METADATA_MS = 10 * 60_000;
const STREAM_MS = 2 * 60_000;

export function sourceById(id: string): Source {
  const source = getSource(id);
  if (!source) throw new Error(`Unknown source "${id}"`);
  return source;
}

const animeKey = (ref: AnimeRef) => `${ref.sourceId}:${ref.siteUrl}:${ref.animeId}`;

export function loadAnime(ref: AnimeRef) {
  const source = sourceById(ref.sourceId);
  return Promise.all([
    cached(`anime:${animeKey(ref)}`, METADATA_MS, () => source.getAnime(ref)),
    cached(`episodes:${animeKey(ref)}`, METADATA_MS, () => source.listEpisodes(ref)),
  ]);
}

export function loadStream(ref: AnimeRef, episodeId: string, track: Track) {
  const source = sourceById(ref.sourceId);
  return cached(`stream:${animeKey(ref)}:${episodeId}:${track}`, STREAM_MS, () =>
    resolveEpisode(source, ref, episodeId, track),
  );
}
