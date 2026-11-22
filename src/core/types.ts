export interface AnimeRef {
  sourceId: string;
  /** Origin of the mirror the user is on, e.g. "https://hianime.fm". */
  siteUrl: string;
  animeId: string;
  episodeId?: string;
}

export interface AnimeInfo {
  ref: AnimeRef;
  title: string;
  altTitle?: string;
  posterUrl?: string;
  subCount?: number;
  dubCount?: number;
}

export interface Episode {
  id: string;
  number: number;
  title: string;
  altTitle?: string;
  filler: boolean;
}

export interface Source {
  id: string;
  name: string;
  matchesSite(url: URL): boolean;
  parseAnimeUrl(url: URL): AnimeRef | null;
  getAnime(ref: AnimeRef): Promise<AnimeInfo>;
  listEpisodes(ref: AnimeRef): Promise<Episode[]>;
}
