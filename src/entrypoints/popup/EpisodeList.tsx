import { useEffect, useRef, useState } from "react";
import type { AnimeInfo, Episode, Track } from "../../core/types";
import { StreamDetails } from "./StreamDetails";

export type EpisodeState = { kind: "saved" } | { kind: "active"; percent: number };

interface Props {
  anime: AnimeInfo;
  episodes: Episode[];
  selected: Set<string>;
  states: Map<string, EpisodeState>;
  advanced: boolean;
  track: Track;
  onToggle: (id: string) => void;
}

export function EpisodeList({ anime, episodes, selected, states, advanced, track, onToggle }: Props) {
  const currentRef = useRef<HTMLLIElement>(null);
  const [openId, setOpenId] = useState<string>();

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, []);

  if (episodes.length === 0) return <p className="muted">No episodes yet.</p>;

  return (
    <ol className="episodes">
      {episodes.map((episode) => {
        const isCurrent = episode.id === anime.ref.episodeId;
        const isOpen = advanced && episode.id === openId;
        const state = states.get(episode.id);
        return (
          <li key={episode.id} ref={isCurrent ? currentRef : undefined} className={isCurrent ? "current" : undefined}>
            <div className="ep-row">
              <label className="ep-main">
                <input type="checkbox" checked={selected.has(episode.id)} onChange={() => onToggle(episode.id)} />
                <span className="ep-number">{episode.number}</span>
                <span className="ep-title" title={episode.altTitle}>
                  {episode.title}
                </span>
              </label>
              {episode.filler && <span className="badge">Filler</span>}
              {state?.kind === "saved" && <span className="badge saved" title="Downloaded">✓</span>}
              {state?.kind === "active" && <span className="badge">{state.percent}%</span>}
              {advanced && (
                <button
                  className="icon-button"
                  aria-expanded={isOpen}
                  aria-label="Show links"
                  onClick={() => setOpenId(isOpen ? undefined : episode.id)}
                >
                  {isOpen ? "▾" : "▸"}
                </button>
              )}
            </div>
            {isOpen && <StreamDetails anime={anime} episode={episode} track={track} />}
          </li>
        );
      })}
    </ol>
  );
}
