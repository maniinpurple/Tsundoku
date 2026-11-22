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
  listServers(ref: AnimeRef, episodeId: string): Promise<Server[]>;
}

export type Track = "sub" | "dub";

export interface Server {
  name: string;
  track: Track;
  embedUrl: string;
}

export interface Subtitle {
  lang: string;
  label: string;
  url: string;
  default: boolean;
}

export interface PlayerStream {
  masterUrl: string;
  /** Sent as Referer on playlist requests; the stream hosts refuse them without it. */
  referer: string;
  subtitles: Subtitle[];
}

export interface Player {
  id: string;
  name: string;
  matches(embedUrl: URL): boolean;
  resolve(embedUrl: string): Promise<PlayerStream>;
}

export interface Quality {
  label: string;
  height: number;
  bandwidth?: number;
  playlistUrl: string;
}

export interface ResolvedEpisode extends PlayerStream {
  serverName: string;
  playerId: string;
  track: Track;
  /** Best first. */
  qualities: Quality[];
}
