import { useEffect, useRef } from "react";
import type { Episode } from "../../core/types";

export function EpisodeList({ episodes, currentId }: { episodes: Episode[]; currentId?: string }) {
  const currentRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, []);

  if (episodes.length === 0) return <p className="muted">No episodes yet.</p>;

  return (
    <ol className="episodes">
      {episodes.map((episode) => {
        const isCurrent = episode.id === currentId;
        return (
          <li key={episode.id} ref={isCurrent ? currentRef : undefined} className={isCurrent ? "current" : undefined}>
            <span className="ep-number">{episode.number}</span>
            <span className="ep-title" title={episode.altTitle}>
              {episode.title}
            </span>
            {episode.filler && <span className="badge">Filler</span>}
          </li>
        );
      })}
    </ol>
  );
}
