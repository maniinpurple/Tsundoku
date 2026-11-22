import type { MessageName, Reply, Request, TabInfo } from "../core/messages";
import { findSource, getSource } from "../core/registry";
import type { Source } from "../core/types";

type Handlers = { [N in MessageName]: (payload: Request<N>) => Promise<Reply<N>> };

const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { expires: Date.now() + CACHE_MS, value });
  value.catch(() => cache.delete(key));
  return value;
}

function sourceById(id: string): Source {
  const source = getSource(id);
  if (!source) throw new Error(`Unknown source "${id}"`);
  return source;
}

export const handlers: Handlers = {
  async inspectTab({ url: rawUrl }): Promise<TabInfo> {
    if (!URL.canParse(rawUrl)) return { kind: "unsupported" };
    const url = new URL(rawUrl);
    const source = findSource(url);
    if (!source) return { kind: "unsupported" };
    const anime = source.parseAnimeUrl(url);
    if (!anime) return { kind: "site-page", sourceName: source.name };
    return { kind: "anime", sourceName: source.name, anime };
  },

  async loadAnime({ ref }) {
    const source = sourceById(ref.sourceId);
    const key = `${ref.sourceId}:${ref.siteUrl}:${ref.animeId}`;
    const [anime, episodes] = await Promise.all([
      cached(`anime:${key}`, () => source.getAnime(ref)),
      cached(`episodes:${key}`, () => source.listEpisodes(ref)),
    ]);
    return { anime: { ...anime, ref }, episodes };
  },
};
