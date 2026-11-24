// Downloads one real episode in a throwaway browser profile and checks the result.
// Usage: npm run e2e -- [quality] [episodeId] [subtitleMode] [subtitleLanguage]   (default: Frieren E1, 360p, embed, en)
// E2E_BROWSER=chrome uses Google Chrome instead of Firefox (CHROME_BIN overrides its path).
// E2E_INTERRUPT=1 (Firefox only) reloads the extension once mid-download to check that it resumes.
// E2E_DEBUG=1 (Chrome only) prints the background console.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [quality = "360p", episodeId = "9227", subtitleMode = "embed", subtitleLanguage = "en"] = process.argv.slice(2);
const browserName = process.env.E2E_BROWSER === "chrome" ? "chrome" : "firefox";
const work = mkdtempSync(join(process.env.E2E_DIR ?? tmpdir(), "tsundoku-e2e-"));
const downloads = join(work, "downloads");
mkdirSync(downloads, { recursive: true });

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
let stopBrowser = async () => {};
const finish = async (code, message) => {
  console.log(message);
  await stopBrowser().catch(() => {});
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
    if (current.status === "done") void finish(0, `Done in ${seconds}s:\n${listFiles(downloads).join("\n")}`);
    if (["failed", "cancelled"].includes(current.status)) void finish(1, `Failed: ${current.error}`);
  });
});

function listFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile())
    .map((path) => `${path} (${Math.round(statSync(path).size / 1e6)} MB)`);
}

function startFirefox() {
  const prefs = {
    "browser.download.dir": downloads,
    "browser.download.folderList": 2,
    "browser.download.useDownloadDir": true,
  };
  const firefox = spawn(
    process.execPath,
    ["node_modules/web-ext/bin/web-ext.js", "run", "-s", "dist/firefox-mv3-e2e", "--no-reload", "--arg=--headless",
      ...(process.env.FIREFOX_BIN ? ["--firefox", process.env.FIREFOX_BIN] : []),
      ...Object.entries(prefs).map(([k, v]) => `--pref=${k}=${v}`)],
    { stdio: "ignore", detached: true },
  );
  stopBrowser = async () => process.kill(-firefox.pid, "SIGTERM");
}

async function startChrome() {
  const { default: puppeteer } = await import("puppeteer-core");
  const profile = join(work, "chrome-profile");
  mkdirSync(join(profile, "Default"), { recursive: true });
  writeFileSync(
    join(profile, "Default", "Preferences"),
    JSON.stringify({ download: { default_directory: downloads, prompt_for_download: false, directory_upgrade: true } }),
  );
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN ?? chromePath(),
    headless: true,
    pipe: true,
    enableExtensions: true,
    userDataDir: profile,
  });
  if (process.env.E2E_DEBUG) {
    const watch = async (target) => {
      if (target.type() !== "service_worker") return;
      const worker = await target.worker();
      worker?.on("console", (message) => console.log("[background]", message.type(), message.text()));
    };
    browser.on("targetcreated", watch);
  }
  await browser.installExtension(resolve("dist/chrome-mv3-e2e"));
  stopBrowser = () => browser.close();
}

function chromePath() {
  const candidates = {
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
    linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"],
    win32: ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"],
  }[process.platform] ?? [];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error("Google Chrome not found; set CHROME_BIN");
  return found;
}

server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  execFileSync("npx", ["wxt", "build", "-b", browserName, "--mode", "e2e"], {
    stdio: "inherit",
    env: { ...process.env, WXT_E2E_URL: `http://127.0.0.1:${port}`, WXT_E2E_INTERRUPT: process.env.E2E_INTERRUPT ?? "" },
  });
  try {
    if (browserName === "chrome") await startChrome();
    else startFirefox();
  } catch (error) {
    await finish(1, `Could not start ${browserName}: ${error instanceof Error ? error.message : error}`);
  }
  console.log(`${browserName} started; downloading E1 ${quality} into ${downloads}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void finish(130, "Stopped"));
