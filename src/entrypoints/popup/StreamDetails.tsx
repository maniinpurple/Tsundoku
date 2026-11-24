import { useState } from "react";
import { send } from "../../core/messages";
import type { AnimeInfo, Episode, Track } from "../../core/types";
import { ErrorBox } from "./ErrorBox";
import { useAsync } from "./useAsync";

interface Props {
  anime: AnimeInfo;
  episode: Episode;
  track: Track;
}

export function StreamDetails({ anime, episode, track }: Props) {
  const [state, retry] = useAsync(
    () => send("resolveEpisode", { ref: anime.ref, episodeId: episode.id, track }),
    [episode.id, track],
  );

  if (state.status === "loading") return <div className="stream muted small">Finding the video…</div>;
  if (state.status === "error") return <ErrorBox message={state.message} onRetry={retry} />;

  const stream = state.data;
  return (
    <div className="stream">
      <div className="muted small">
        {stream.serverName} · {track === "sub" ? "Sub" : "Dub"}
      </div>
      <ul className="link-list">
        {stream.qualities.map((quality) => (
          <li key={quality.playlistUrl}>
            <span className="quality">{quality.label}</span>
            {quality.bandwidth && <span className="muted small">{(quality.bandwidth / 1e6).toFixed(1)} Mbps</span>}
            <CopyButton text={quality.playlistUrl} />
          </li>
        ))}
        {stream.subtitles.map((subtitle) => (
          <li key={subtitle.url}>
            <span className="quality">{subtitle.label}</span>
            <span className="muted small">subtitle</span>
            <CopyButton text={subtitle.url} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button className="small-button push-right" onClick={copy} title={text}>
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
