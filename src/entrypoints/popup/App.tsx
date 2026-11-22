// The popup: what you see when you click the toolbar icon.
// It only shows things; it asks the background for anything that needs work.
import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { send, type TabInfo } from "../../core/messages";

type State = { status: "loading" } | { status: "ready"; info: TabInfo } | { status: "error"; message: string };

async function inspectCurrentTab(): Promise<TabInfo> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return { kind: "unsupported" };
  return send("inspectTab", { url: tab.url });
}

export function App() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    inspectCurrentTab()
      .then((info) => setState({ status: "ready", info }))
      .catch((error: unknown) => setState({ status: "error", message: String(error) }));
  }, []);

  return (
    <main>
      <header>
        <img src="/icon.svg" alt="" width={24} height={24} />
        <h1>Tsundoku</h1>
      </header>
      <TabStatus state={state} />
    </main>
  );
}

function TabStatus({ state }: { state: State }) {
  if (state.status === "loading") return <p className="muted">Looking at this page…</p>;
  if (state.status === "error") return <p className="error">Something went wrong: {state.message}</p>;

  const { info } = state;
  switch (info.kind) {
    case "unsupported":
      return <p className="muted">This site is not supported yet. Open an anime page on HiAnime.</p>;
    case "site-page":
      return <p className="muted">You are on {info.sourceName}. Open an anime to download its episodes.</p>;
    case "anime":
      return (
        <section className="card">
          <div className="label">{info.sourceName}</div>
          <div className="title">{info.anime.animeId}</div>
          {info.anime.episodeId && <div className="muted">Episode id {info.anime.episodeId}</div>}
          <p className="muted small">Episode list arrives in M1.</p>
        </section>
      );
  }
}
