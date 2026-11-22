import { FetchError, fetchJson, fetchText, parseHtml } from "../../core/http";
import type { Source } from "../../core/types";
import { hianimeConfig } from "./config";
import { parseAnimePage, parseEpisodeList, parseServerList } from "./parse";

type HtmlResponse = { status: boolean; html?: string };

export const hianime: Source = {
  id: "hianime",
  name: "HiAnime",

  matchesSite(url) {
    return hianimeConfig.hostPattern.test(url.hostname);
  },

  parseAnimeUrl(url) {
    const animeId = url.pathname.match(hianimeConfig.animePath)?.[1];
    if (!animeId) return null;
    return {
      sourceId: this.id,
      siteUrl: url.origin,
      animeId,
      episodeId: url.searchParams.get("ep") ?? undefined,
    };
  },

  async getAnime(ref) {
    const html = await fetchText(`${ref.siteUrl}/${ref.animeId}`);
    return parseAnimePage(parseHtml(html), ref);
  },

  async listEpisodes(ref) {
    const numericId = ref.animeId.split("-").at(-1)!;
    const data = await fetchJson<HtmlResponse>(hianimeConfig.episodeListApi(ref.siteUrl, numericId));
    if (!data.status || !data.html) throw new FetchError("HiAnime has no episode list for this anime");
    return parseEpisodeList(parseHtml(data.html));
  },

  async listServers(ref, episodeId) {
    const data = await fetchJson<HtmlResponse>(hianimeConfig.serversApi(ref.siteUrl, episodeId));
    if (!data.status || !data.html) throw new FetchError("HiAnime has no servers for this episode");
    return parseServerList(parseHtml(data.html));
  },
};
