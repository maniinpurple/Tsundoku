import { browser } from "wxt/browser";
import type { AnimeInfo, AnimeRef, Episode, ResolvedEpisode, Track } from "./types";

export type TabInfo =
  | { kind: "anime"; sourceName: string; anime: AnimeRef }
  | { kind: "site-page"; sourceName: string }
  | { kind: "unsupported" };

export interface MessageMap {
  inspectTab: { request: { url: string }; reply: TabInfo };
  loadAnime: { request: { ref: AnimeRef }; reply: { anime: AnimeInfo; episodes: Episode[] } };
  resolveEpisode: { request: { ref: AnimeRef; episodeId: string; track: Track }; reply: ResolvedEpisode };
}

export type MessageName = keyof MessageMap;
export type Request<N extends MessageName> = MessageMap[N]["request"];
export type Reply<N extends MessageName> = MessageMap[N]["reply"];
export type Envelope = { [N in MessageName]: { name: N; payload: Request<N> } }[MessageName];
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function send<N extends MessageName>(name: N, payload: Request<N>): Promise<Reply<N>> {
  const result: Result<Reply<N>> = await browser.runtime.sendMessage({ name, payload });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
