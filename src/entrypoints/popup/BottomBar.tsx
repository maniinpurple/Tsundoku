import { useMemo, useState } from "react";
import { commonSubtitleLanguages } from "../../core/languages";
import { send } from "../../core/messages";
import type { QualityPreference, Settings, SubtitleMode } from "../../core/settings";
import { ALL_LANGUAGES } from "../../core/subtitles";
import type { AnimeInfo, Episode, Track } from "../../core/types";
import { useAsync } from "./useAsync";

interface Props {
  anime: AnimeInfo;
  firstEpisode?: Episode;
  settings: Settings;
  onChange: (changes: Partial<Settings>) => void;
  count: number;
  again: number;
  onDownload: () => Promise<void>;
}

const QUALITIES: { value: QualityPreference; label: string }[] = [
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
  { value: "360p", label: "360p" },
  { value: "best", label: "Best" },
];

const SUBTITLE_MODES: { value: SubtitleMode; label: string }[] = [
  { value: "embed", label: "In the video" },
  { value: "srt", label: "Separate .srt" },
  { value: "both", label: "Both" },
  { value: "none", label: "No subtitles" },
];

export function BottomBar({ anime, firstEpisode, settings, onChange, count, again, onDownload }: Props) {
  const [busy, setBusy] = useState(false);
  const available = useAsync(
    async () => (firstEpisode ? send("resolveEpisode", { ref: anime.ref, episodeId: firstEpisode.id, track: settings.track }) : null),
    [firstEpisode?.id, settings.track],
  )[0];

  const languages = useMemo(() => {
    const found = available.status === "ready" ? (available.data?.subtitles ?? []) : [];
    const options = found.map((s) => ({ code: s.lang, name: s.label }));
    if (options.length === 0) options.push(...commonSubtitleLanguages.map(({ code, name }) => ({ code, name })));
    if (!options.some((o) => o.code === settings.subtitleLanguage) && settings.subtitleLanguage !== ALL_LANGUAGES) {
      const saved = commonSubtitleLanguages.find((l) => l.code === settings.subtitleLanguage);
      options.unshift({ code: settings.subtitleLanguage, name: saved?.name ?? settings.subtitleLanguage });
    }
    return [...new Map(options.map((o) => [o.code, o])).values()];
  }, [available, settings.subtitleLanguage]);

  const start = async () => {
    setBusy(true);
    try {
      await onDownload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="bottom-bar">
      <div className="options">
        <div className="segmented" role="radiogroup" aria-label="Audio">
          {(["sub", "dub"] as Track[]).map((track) => (
            <button
              key={track}
              role="radio"
              aria-checked={settings.track === track}
              disabled={(track === "sub" ? anime.subCount : anime.dubCount) === 0}
              onClick={() => onChange({ track })}
            >
              {track === "sub" ? "Sub" : "Dub"}
            </button>
          ))}
        </div>
        <select
          aria-label="Quality"
          value={settings.quality}
          onChange={(e) => onChange({ quality: e.target.value as QualityPreference })}
        >
          {QUALITIES.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
            </option>
          ))}
        </select>
      </div>
      <div className="options">
        <label className="field">
          <span className="muted small">Subtitles</span>
          <select
            value={settings.subtitleMode}
            onChange={(e) => onChange({ subtitleMode: e.target.value as SubtitleMode })}
          >
            {SUBTITLE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="muted small">Language</span>
          <select
            value={settings.subtitleLanguage}
            disabled={settings.subtitleMode === "none"}
            onChange={(e) => onChange({ subtitleLanguage: e.target.value })}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
            <option value={ALL_LANGUAGES}>All available</option>
          </select>
        </label>
      </div>
      <button className="primary download-button" disabled={count === 0 || busy} onClick={start}>
        {count === 0 ? "Select episodes to download" : `Download ${count} episode${count === 1 ? "" : "s"}`}
      </button>
      {again > 0 && (
        <p className="muted small again">
          {again === count
            ? `Already downloaded before, will be downloaded again.`
            : `${again} of these ${again === 1 ? "was" : "were"} downloaded before and will be downloaded again.`}
        </p>
      )}
    </footer>
  );
}

