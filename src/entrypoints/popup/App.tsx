import { useState } from "react";
import { browser } from "wxt/browser";
import { send, type TabInfo } from "../../core/messages";
import { AnimeView } from "./AnimeView";
import { DownloadsPanel } from "./DownloadsPanel";
import { ErrorBox } from "./ErrorBox";
import { SettingsPanel } from "./SettingsPanel";
import type { Theme } from "../../core/settings";
import { FEATURE_REQUEST_URL, SUPPORT_URL } from "./links";
import { useAsync } from "./useAsync";
import { useSettings } from "./useSettings";
import { ACTIVE_STATUSES, useDownloads } from "./useDownloads";

const ALL_SITES = { origins: ["<all_urls>"] };
const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const THEME_GLYPH: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

type View = "episodes" | "downloads" | "settings";

async function inspectCurrentTab(): Promise<{ tab: TabInfo; hasAccess: boolean }> {
  const [active] = await browser.tabs.query({ active: true, currentWindow: true });
  const tab: TabInfo = active?.url ? await send("inspectTab", { url: active.url }) : { kind: "unsupported" };
  const hasAccess = await browser.permissions.contains(ALL_SITES);
  return { tab, hasAccess };
}

export function App() {
  const [state, retry] = useAsync(inspectCurrentTab, []);
  const [view, setView] = useState<View>("episodes");
  const [settings, updateSettings] = useSettings();
  const jobs = useDownloads();
  const activeCount = jobs.filter((job) => ACTIVE_STATUSES.includes(job.status)).length;

  return (
    <main>
      <header className="app-header">
        <img src="/icon.svg" alt="" width={22} height={22} />
        <h1>Tsundoku</h1>
        <nav className="tabs">
          <button aria-pressed={view === "episodes"} onClick={() => setView("episodes")}>
            Episodes
          </button>
          <button aria-pressed={view === "downloads"} onClick={() => setView("downloads")}>
            Downloads{activeCount > 0 && <span className="count">{activeCount}</span>}
          </button>
          <button aria-pressed={view === "settings"} aria-label="Settings" onClick={() => setView("settings")}>
            ⚙
          </button>
          <button
            aria-label={`Theme: ${settings.theme}`}
            title={`Theme: ${settings.theme}`}
            onClick={() => updateSettings({ theme: NEXT_THEME[settings.theme] })}
          >
            {THEME_GLYPH[settings.theme]}
          </button>
        </nav>
      </header>
      {view === "downloads" && <DownloadsPanel jobs={jobs} />}
      {view === "settings" && <SettingsPanel />}
      {view === "episodes" && state.status === "loading" && <p className="muted">Looking at this page…</p>}
      {view === "episodes" && state.status === "error" && <ErrorBox message={state.message} onRetry={retry} />}
      {view === "episodes" && state.status === "ready" && (
        <TabView {...state.data} jobs={jobs} onAccessGranted={retry} onQueued={() => setView("downloads")} />
      )}
      <footer className="footer">
        <a href={FEATURE_REQUEST_URL} target="_blank" rel="noreferrer">
          Request a feature
        </a>
        <span>·</span>
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
          Support
        </a>
      </footer>
    </main>
  );
}

interface TabViewProps {
  tab: TabInfo;
  hasAccess: boolean;
  jobs: ReturnType<typeof useDownloads>;
  onAccessGranted: () => void;
  onQueued: () => void;
}

function TabView({ tab, hasAccess, jobs, onAccessGranted, onQueued }: TabViewProps) {
  switch (tab.kind) {
    case "unsupported":
      return <p className="muted">This site is not supported yet. Open an anime page on HiAnime.</p>;
    case "site-page":
      return <p className="muted">You are on {tab.sourceName}. Open an anime to see its episodes.</p>;
    case "anime":
      if (!hasAccess) return <AccessRequest onGranted={onAccessGranted} />;
      return <AnimeView sourceName={tab.sourceName} animeRef={tab.anime} jobs={jobs} onQueued={onQueued} />;
  }
}

function AccessRequest({ onGranted }: { onGranted: () => void }) {
  const request = async () => {
    if (await browser.permissions.request(ALL_SITES)) onGranted();
  };
  return (
    <section className="card">
      <p>Tsundoku needs access to websites to read episode lists and download videos.</p>
      <button className="primary" onClick={request}>
        Allow access
      </button>
    </section>
  );
}
