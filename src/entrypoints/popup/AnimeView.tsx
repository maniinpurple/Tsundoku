import { useState } from "react";
import { send } from "../../core/messages";
import type { AnimeInfo, AnimeRef, Episode, Track } from "../../core/types";
import { ErrorBox } from "./ErrorBox";
import { EpisodeList } from "./EpisodeList";
import { useAsync } from "./useAsync";

export function AnimeView({ sourceName, animeRef }: { sourceName: string; animeRef: AnimeRef }) {
  const [state, retry] = useAsync(() => send("loadAnime", { ref: animeRef }), [animeRef.siteUrl, animeRef.animeId]);
  const [chosenTrack, setTrack] = useState<Track>();

  if (state.status === "loading") return <p className="muted">Loading episodes…</p>;
  if (state.status === "error") return <ErrorBox message={state.message} onRetry={retry} />;

  const { anime, episodes } = state.data;
  const track = chosenTrack ?? (anime.subCount === 0 && anime.dubCount ? "dub" : "sub");
  return (
    <>
      <AnimeHeader sourceName={sourceName} anime={anime} episodes={episodes} />
      <TrackPicker anime={anime} track={track} onChange={setTrack} />
      <EpisodeList animeRef={animeRef} episodes={episodes} track={track} />
    </>
  );
}

function AnimeHeader({ sourceName, anime, episodes }: { sourceName: string; anime: AnimeInfo; episodes: Episode[] }) {
  const tracks = [
    anime.subCount !== undefined && `Sub ${anime.subCount}`,
    anime.dubCount !== undefined && `Dub ${anime.dubCount}`,
  ].filter(Boolean);

  return (
    <section className="anime-header">
      {anime.posterUrl && <img className="poster" src={anime.posterUrl} alt="" />}
      <div>
        <div className="label">{sourceName}</div>
        <div className="title">{anime.title}</div>
        {anime.altTitle && anime.altTitle !== anime.title && <div className="muted small">{anime.altTitle}</div>}
        <div className="muted small">
          {episodes.length} episodes{tracks.length > 0 && ` · ${tracks.join(" · ")}`}
        </div>
      </div>
    </section>
  );
}

function TrackPicker({ anime, track, onChange }: { anime: AnimeInfo; track: Track; onChange: (track: Track) => void }) {
  const options: { value: Track; label: string; count?: number }[] = [
    { value: "sub", label: "Sub", count: anime.subCount },
    { value: "dub", label: "Dub", count: anime.dubCount },
  ];
  return (
    <div className="segmented" role="radiogroup" aria-label="Audio">
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={track === option.value}
          disabled={option.count === 0}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
