// Site-agnostic types. Nothing in src/core knows that hianime exists.
//
// Big picture (ports & adapters):
//   Source  = one streaming site (hianime, later others). Knows the site's pages and APIs.
//   Player  = one embed host (Zoko, megaplay, ...). Many sites reuse the same players,
//             so they live in src/players and are shared. (Added in M2.)
//   core    = everything that works the same for every site: messages, HLS download,
//             MP4 conversion, queue, file naming.

/** Points at one anime on one site. Plain data, so it can travel in messages. */
export interface AnimeRef {
  /** Which Source understood the page, e.g. "hianime". */
  sourceId: string;
  /** The site's own id for the anime, e.g. "frieren-beyond-journeys-end-481". */
  animeId: string;
  /** The site's id of the episode the page is showing, if the URL says so (watch pages). */
  episodeId?: string;
}

/**
 * Contract every site adapter fulfils. Like a C++ abstract class: core code only
 * talks to this interface, and each site provides one object implementing it.
 * It grows one method per milestone (episode list in M1, servers in M2).
 */
export interface Source {
  id: string;
  /** Human name shown in the popup. */
  name: string;
  /** Is this URL on this site at all? (any page, any domain mirror) */
  matchesSite(url: URL): boolean;
  /** If this URL is an anime page, which anime? null for home, search, etc. */
  parseAnimeUrl(url: URL): AnimeRef | null;
}
