import { send } from "../../core/messages";
import type { AnimeInfo, AnimeRef, Episode } from "../../core/types";
import { ErrorBox } from "./ErrorBox";
import { EpisodeList } from "./EpisodeList";
import { useAsync } from "./useAsync";

export function AnimeView({ sourceName, animeRef }: { sourceName: string; animeRef: AnimeRef }) {
  const [state, retry] = useAsync(() => send("loadAnime", { ref: animeRef }), [animeRef.siteUrl, animeRef.animeId]);

  if (state.status === "loading") return <p className="muted">Loading episodes…</p>;
  if (state.status === "error") return <ErrorBox message={state.message} onRetry={retry} />;

  const { anime, episodes } = state.data;
  return (
    <>
      <AnimeHeader sourceName={sourceName} anime={anime} episodes={episodes} />
      <EpisodeList episodes={episodes} currentId={animeRef.episodeId} />
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
