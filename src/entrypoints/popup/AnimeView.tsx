import { useMemo, useState } from "react";
import { send } from "../../core/messages";
import type { AnimeInfo, AnimeRef, DownloadJob, Episode } from "../../core/types";
import { BottomBar } from "./BottomBar";
import { EpisodeList, type EpisodeState } from "./EpisodeList";
import { ErrorBox } from "./ErrorBox";
import { parseRange } from "./selection";
import { useAsync } from "./useAsync";
import { ACTIVE_STATUSES } from "./useDownloads";
import { useSettings } from "./useSettings";

interface Props {
  sourceName: string;
  animeRef: AnimeRef;
  jobs: DownloadJob[];
  onQueued: () => void;
}

export function AnimeView({ sourceName, animeRef, jobs, onQueued }: Props) {
  const [state, retry] = useAsync(async () => {
    const [anime, history] = await Promise.all([
      send("loadAnime", { ref: animeRef }),
      send("downloadHistory", { ref: animeRef }),
    ]);
    return { ...anime, history };
  }, [animeRef.siteUrl, animeRef.animeId]);

  if (state.status === "loading") return <p className="muted">Loading episodes…</p>;
  if (state.status === "error") return <ErrorBox message={state.message} onRetry={retry} />;
  return <LoadedAnime sourceName={sourceName} {...state.data} jobs={jobs} onQueued={onQueued} />;
}

interface LoadedProps {
  sourceName: string;
  anime: AnimeInfo;
  episodes: Episode[];
  history: { episodeId: string; track: string }[];
  jobs: DownloadJob[];
  onQueued: () => void;
}

function LoadedAnime({ sourceName, anime, episodes, history, jobs, onQueued }: LoadedProps) {
  const [settings, updateSettings] = useSettings();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(anime.ref.episodeId ? [anime.ref.episodeId] : []));
  const [range, setRange] = useState("");

  const states = useMemo(() => {
    const map = new Map<string, EpisodeState>();
    for (const entry of history) if (entry.track === settings.track) map.set(entry.episodeId, { kind: "saved" });
    for (const job of jobs) {
      if (job.ref.animeId !== anime.ref.animeId || job.track !== settings.track) continue;
      if (job.status === "done") map.set(job.episode.id, { kind: "saved" });
      else if (ACTIVE_STATUSES.includes(job.status)) {
        const percent = job.segmentsTotal ? Math.floor((job.segmentsDone / job.segmentsTotal) * 100) : 0;
        map.set(job.episode.id, { kind: "active", percent });
      }
    }
    return map;
  }, [history, jobs, settings.track, anime.ref.animeId]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = episodes.length > 0 && selected.size === episodes.length;

  const saved = (id: string) => states.get(id)?.kind === "saved";
  const toDownload = episodes.filter((e) => selected.has(e.id));
  const again = toDownload.filter((e) => saved(e.id)).length;

  const download = async () => {
    const requests = toDownload
      .map((episode) => ({
        ref: anime.ref,
        animeTitle: anime.title,
        episodeCount: episodes.length,
        episode: { id: episode.id, number: episode.number, title: episode.title },
        track: settings.track,
        quality: settings.quality,
        subtitleMode: settings.subtitleMode,
        subtitleLanguage: settings.subtitleLanguage,
      }));
    await send("startDownloads", { requests });
    setSelected(new Set());
    onQueued();
  };

  return (
    <div className="anime-layout">
      <AnimeHeader sourceName={sourceName} anime={anime} episodes={episodes} />
      <div className="selection-bar">
        <label className="check">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = selected.size > 0 && !allSelected;
            }}
            onChange={() => setSelected(allSelected ? new Set() : new Set(episodes.map((e) => e.id)))}
          />
          All
        </label>
        <input
          className="range"
          placeholder="Episodes, e.g. 1-12, 15"
          value={range}
          onChange={(event) => {
            setRange(event.target.value);
            if (event.target.value.trim()) setSelected(parseRange(event.target.value, episodes));
          }}
        />
        <span className="muted small">{selected.size} selected</span>
      </div>
      <EpisodeList
        anime={anime}
        episodes={episodes}
        selected={selected}
        states={states}
        advanced={settings.advanced}
        track={settings.track}
        onToggle={toggle}
      />
      <BottomBar
        anime={anime}
        firstEpisode={episodes[0]}
        settings={settings}
        onChange={updateSettings}
        count={toDownload.length}
        again={again}
        onDownload={download}
      />
    </div>
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
