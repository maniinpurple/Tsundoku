import { browser } from "wxt/browser";
import { GITHUB_REPO } from "./project";

const KEY = "updateCheck";
// GitHub allows 60 unauthenticated API calls per hour per IP, so the answer is cached.
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export interface Release {
  version: string;
  url: string;
}

interface Cached {
  at: number;
  latest?: Release;
}

/** The newest GitHub release if it is newer than the installed version, otherwise null. */
export async function newerRelease(): Promise<Release | null> {
  const current = browser.runtime.getManifest().version;
  const cached = (await browser.storage.local.get(KEY))[KEY] as Cached | undefined;
  let latest = cached?.latest;
  if (!cached || Date.now() - cached.at > CHECK_EVERY_MS) {
    try {
      latest = await fetchLatest();
      await browser.storage.local.set({ [KEY]: { at: Date.now(), latest } satisfies Cached });
    } catch {
      // Offline or rate limited: try again next time.
    }
  }
  return latest && isNewer(latest.version, current) ? latest : null;
}

async function fetchLatest(): Promise<Release | undefined> {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const release = (await response.json()) as { tag_name: string; html_url: string };
  return { version: release.tag_name.replace(/^v/, ""), url: release.html_url };
}

export function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}
