import { zoko } from "../players/zoko";
import { hianime } from "../sources/hianime";
import type { Player, Source } from "./types";

const sources: Source[] = [hianime];
const players: Player[] = [zoko];

export function findSource(url: URL): Source | undefined {
  return sources.find((source) => source.matchesSite(url));
}

export function getSource(id: string): Source | undefined {
  return sources.find((source) => source.id === id);
}

export function findPlayer(embedUrl: string): Player | undefined {
  if (!URL.canParse(embedUrl)) return undefined;
  const url = new URL(embedUrl);
  return players.find((player) => player.matches(url));
}
