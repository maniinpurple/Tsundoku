import { fetchText } from "./http";
import { parseMasterPlaylist } from "./hls";
import { findPlayer } from "./registry";
import type { AnimeRef, ResolvedEpisode, Source, Track } from "./types";

/** Tries every server of the wanted track that has a supported player, in the site's order. */
export async function resolveEpisode(
  source: Source,
  ref: AnimeRef,
  episodeId: string,
  track: Track,
): Promise<ResolvedEpisode> {
  const servers = (await source.listServers(ref, episodeId)).filter((server) => server.track === track);
  if (servers.length === 0) throw new Error(`No ${track} version of this episode`);

  const failures: string[] = [];
  for (const server of servers) {
    const player = findPlayer(server.embedUrl);
    if (!player) {
      failures.push(`${server.name}: not supported yet`);
      continue;
    }
    try {
      const stream = await player.resolve(server.embedUrl);
      const master = await fetchText(stream.masterUrl, { referer: stream.referer });
      const qualities = parseMasterPlaylist(master, stream.masterUrl);
      return { ...stream, serverName: server.name, playerId: player.id, track, qualities };
    } catch (error) {
      failures.push(`${server.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Could not get the video. ${failures.join("; ")}`);
}
