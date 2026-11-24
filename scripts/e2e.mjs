// Downloads one real episode in a throwaway Firefox profile and checks the result.
// Usage: npm run e2e -- [quality] [episodeId] [subtitleMode] [subtitleLanguage]   (default: Frieren E1, 360p, embed, en)
// E2E_INTERRUPT=1 reloads the extension once mid-download to check that it resumes.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [quality = "360p", episodeId = "9227", subtitleMode = "embed", subtitleLanguage = "en"] = process.argv.slice(2);
const work = mkdtempSync(join(process.env.E2E_DIR ?? tmpdir(), "tsundoku-e2e-"));
const downloads = join(work, "downloads");

const job = {
  ref: { sourceId: "hianime", siteUrl: "https://hianime.fm", animeId: "frieren-beyond-journeys-end-481" },
  animeTitle: "Frieren: Beyond Journey's End",
  episodeCount: 28,
  episode: { id: episodeId, number: 1, title: "E2E" },
  track: "sub",
  quality,
  subtitleMode,
  subtitleLanguage,
};

const started = Date.now();
let firefox;
const finish = (code, message) => {
  console.log(message);
  if (firefox) process.kill(-firefox.pid, "SIGTERM");
  server.close();
  process.exit(code);
};

const server = createServer((req, res) => {
  if (req.url === "/job") return res.end(JSON.stringify(job));
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    res.end();
    const current = JSON.parse(body).at(-1);
    if (!current) return;
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`${seconds}s ${current.status} ${current.segmentsDone}/${current.segmentsTotal} ${Math.round(current.bytes / 1e6)} MB${current.note ? ` (${current.note})` : ""}`);
    if (current.status === "done") finish(0, `Done in ${seconds}s:\n${listFiles(downloads).join("\n")}`);
    if (["failed", "cancelled"].includes(current.status)) finish(1, `Failed: ${current.error}`);
  });
});

function listFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile())
    .map((path) => `${path} (${Math.round(statSync(path).size / 1e6)} MB)`);
}

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  execFileSync("npx", ["wxt", "build", "-b", "firefox", "--mode", "e2e"], {
    stdio: "inherit",
    env: { ...process.env, WXT_E2E_URL: `http://127.0.0.1:${port}`, WXT_E2E_INTERRUPT: process.env.E2E_INTERRUPT ?? "" },
  });
  const prefs = {
    "browser.download.dir": downloads,
    "browser.download.folderList": 2,
    "browser.download.useDownloadDir": true,
  };
  firefox = spawn(
    process.execPath,
    ["node_modules/web-ext/bin/web-ext.js", "run", "-s", "dist/firefox-mv3-e2e", "--no-reload", "--arg=--headless",
      ...(process.env.FIREFOX_BIN ? ["--firefox", process.env.FIREFOX_BIN] : []),
      ...Object.entries(prefs).map(([k, v]) => `--pref=${k}=${v}`)],
    { stdio: "ignore", detached: true },
  );
  console.log(`Firefox started; downloading E1 ${quality} into ${downloads}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => finish(130, "Stopped"));
