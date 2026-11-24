import type { MessageName, Reply, Request, TabInfo } from "../core/messages";
import { findSource } from "../core/registry";
import {
  cancelAll,
  cancelDownload,
  clearFinished,
  clearHistory,
  listDownloads,
  retryDownload,
  startDownloads,
} from "./downloads";
import { historyFor } from "./jobs";
import { loadAnime, loadStream } from "./streams";

type Handlers = { [N in MessageName]: (payload: Request<N>) => Promise<Reply<N>> };

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
    const [anime, episodes] = await loadAnime(ref);
    return { anime: { ...anime, ref }, episodes };
  },

  resolveEpisode: ({ ref, episodeId, track }) => loadStream(ref, episodeId, track),
  startDownloads: ({ requests }) => startDownloads(requests),
  listDownloads: () => listDownloads(),
  retryDownload: ({ id }) => retryDownload(id),
  cancelDownload: ({ id }) => cancelDownload(id),
  cancelAll: () => cancelAll(),
  clearFinished: () => clearFinished(),
  downloadHistory: ({ ref }) => historyFor(ref),
  clearHistory: () => clearHistory(),
};
