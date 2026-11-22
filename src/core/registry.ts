import { hianime } from "../sources/hianime";
import type { Source } from "./types";

const sources: Source[] = [hianime];

export function findSource(url: URL): Source | undefined {
  return sources.find((source) => source.matchesSite(url));
}

export function getSource(id: string): Source | undefined {
  return sources.find((source) => source.id === id);
}
