// hianime adapter. Logic ported from ani-box/ani-resolver/src/hianime.
import type { AnimeRef, Source } from "../../core/types";
import { hianimeConfig } from "./config";

// Anime pages look like:
//   /frieren-beyond-journeys-end-481            (detail page)
//   /watch/frieren-beyond-journeys-end-481?ep=9227  (watch page)
// The id always ends with "-<number>"; that number is what hianime's APIs want.
const animePath = /^\/(?:watch\/)?([a-z0-9-]+-\d+)\/?$/i;

export const hianime: Source = {
  id: "hianime",
  name: "HiAnime",

  matchesSite(url) {
    return hianimeConfig.hostPattern.test(url.hostname);
  },

  parseAnimeUrl(url): AnimeRef | null {
    const match = url.pathname.match(animePath);
    if (!match?.[1]) return null;
    return {
      sourceId: this.id,
      animeId: match[1],
      episodeId: url.searchParams.get("ep") ?? undefined,
    };
  },
};
