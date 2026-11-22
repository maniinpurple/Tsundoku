import { browser } from "wxt/browser";
import { send, type TabInfo } from "../../core/messages";
import { AnimeView } from "./AnimeView";
import { ErrorBox } from "./ErrorBox";
import { useAsync } from "./useAsync";

const ALL_SITES = { origins: ["<all_urls>"] };

async function inspectCurrentTab(): Promise<{ tab: TabInfo; hasAccess: boolean }> {
  const [active] = await browser.tabs.query({ active: true, currentWindow: true });
  const tab: TabInfo = active?.url ? await send("inspectTab", { url: active.url }) : { kind: "unsupported" };
  const hasAccess = await browser.permissions.contains(ALL_SITES);
  return { tab, hasAccess };
}

export function App() {
  const [state, retry] = useAsync(inspectCurrentTab, []);

  return (
    <main>
      <header className="app-header">
        <img src="/icon.svg" alt="" width={22} height={22} />
        <h1>Tsundoku</h1>
      </header>
      {state.status === "loading" && <p className="muted">Looking at this page…</p>}
      {state.status === "error" && <ErrorBox message={state.message} onRetry={retry} />}
      {state.status === "ready" && <TabView {...state.data} onAccessGranted={retry} />}
    </main>
  );
}

function TabView({ tab, hasAccess, onAccessGranted }: { tab: TabInfo; hasAccess: boolean; onAccessGranted: () => void }) {
  switch (tab.kind) {
    case "unsupported":
      return <p className="muted">This site is not supported yet. Open an anime page on HiAnime.</p>;
    case "site-page":
      return <p className="muted">You are on {tab.sourceName}. Open an anime to see its episodes.</p>;
    case "anime":
      if (!hasAccess) return <AccessRequest onGranted={onAccessGranted} />;
      return <AnimeView sourceName={tab.sourceName} animeRef={tab.anime} />;
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
