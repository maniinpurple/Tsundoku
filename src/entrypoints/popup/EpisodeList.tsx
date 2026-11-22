import { useEffect, useRef, useState } from "react";
import type { AnimeRef, Episode, Track } from "../../core/types";
import { StreamDetails } from "./StreamDetails";

interface Props {
  animeRef: AnimeRef;
  episodes: Episode[];
  track: Track;
}

export function EpisodeList({ animeRef, episodes, track }: Props) {
  const currentRef = useRef<HTMLLIElement>(null);
  const [openId, setOpenId] = useState<string>();

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, []);

  if (episodes.length === 0) return <p className="muted">No episodes yet.</p>;

  return (
    <ol className="episodes">
      {episodes.map((episode) => {
        const isCurrent = episode.id === animeRef.episodeId;
        const isOpen = episode.id === openId;
        return (
          <li key={episode.id} ref={isCurrent ? currentRef : undefined} className={isCurrent ? "current" : undefined}>
            <button className="ep-row" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? undefined : episode.id)}>
              <span className="ep-number">{episode.number}</span>
              <span className="ep-title" title={episode.altTitle}>
                {episode.title}
              </span>
              {episode.filler && <span className="badge">Filler</span>}
            </button>
            {isOpen && <StreamDetails animeRef={animeRef} episodeId={episode.id} track={track} />}
          </li>
        );
      })}
    </ol>
  );
}
