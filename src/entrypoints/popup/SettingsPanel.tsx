import { useState } from "react";
import { send } from "../../core/messages";
import { DEFAULT_FOLDER, DEFAULT_TEMPLATE, episodePath, TEMPLATE_TOKENS } from "../../core/naming";
import type { Theme } from "../../core/settings";
import { useSettings } from "./useSettings";

export function SettingsPanel() {
  const [settings, update] = useSettings();
  const [historyCleared, setHistoryCleared] = useState(false);
  const preview = episodePath(
    { animeTitle: "Frieren: Beyond Journey's End", episodeNumber: 3, episodeCount: 28, episodeTitle: "Killing Magic", quality: "1080p", track: "sub" },
    settings.folder,
    settings.fileNameTemplate,
  );

  return (
    <section className="settings">
      <h2>Files</h2>
      <label className="field">
        <span className="muted small">Folder inside Downloads</span>
        <input
          type="text"
          value={settings.folder}
          placeholder={DEFAULT_FOLDER}
          onChange={(e) => update({ folder: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="muted small">File name (use / for sub-folders)</span>
        <input
          type="text"
          value={settings.fileNameTemplate}
          placeholder={DEFAULT_TEMPLATE}
          onChange={(e) => update({ fileNameTemplate: e.target.value })}
        />
      </label>
      <div className="tokens">
        {TEMPLATE_TOKENS.map((token) => (
          <button
            key={token}
            className="small-button"
            onClick={() => update({ fileNameTemplate: `${settings.fileNameTemplate}{${token}}` })}
          >
            {`{${token}}`}
          </button>
        ))}
        <button
          className="small-button"
          onClick={() => update({ folder: DEFAULT_FOLDER, fileNameTemplate: DEFAULT_TEMPLATE })}
        >
          Reset
        </button>
      </div>
      <div className="preview small">
        <span className="muted">Downloads/</span>
        {preview}.mp4
      </div>

      <h2>Appearance</h2>
      <label className="field inline">
        <span>Theme</span>
        <select value={settings.theme} onChange={(e) => update({ theme: e.target.value as Theme })}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <h2>Downloads</h2>
      <label className="field inline">
        <span>Episodes at the same time</span>
        <select
          value={settings.parallelDownloads}
          onChange={(e) => update({ parallelDownloads: Number(e.target.value) })}
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <Toggle
        label="Advanced: show stream links per episode"
        checked={settings.advanced}
        onChange={(advanced) => update({ advanced })}
      />
      <button
        className="small-button"
        disabled={historyCleared}
        onClick={() => send("clearHistory", {}).then(() => setHistoryCleared(true))}
      >
        {historyCleared ? "History cleared" : "Forget which episodes I downloaded"}
      </button>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

