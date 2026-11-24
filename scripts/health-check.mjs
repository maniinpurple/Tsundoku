// Checks every supported site and player against the real servers, keeps 7 days of results and draws
// status/status.svg plus shields.io badges. Runs on a schedule in GitHub Actions (.github/workflows/health.yml).
// Usage: node scripts/health-check.mjs            check and render
//        node scripts/health-check.mjs --render   only redraw from saved results (after editing targets.json)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const DIR = new URL("../status/", import.meta.url);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0";
const WEEK_MS = 7 * 24 * 3600 * 1000;
const renderOnly = process.argv.includes("--render");

const targets = JSON.parse(readFileSync(new URL("targets.json", DIR), "utf8"));
const healthFile = new URL("health.json", DIR);
const health = existsSync(healthFile) ? JSON.parse(readFileSync(healthFile, "utf8")) : {};

const get = async (url, headers = {}) => {
  const response = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response;
};

const checkers = {
  async hianime({ url, check }) {
    const list = await (await get(`${url}/api/theme/episode/list/${check.animeId}`)).json();
    const episodes = (list.html?.match(/ep-item/g) ?? []).length;
    if (!list.status || episodes === 0) throw new Error("episode list is empty");
    const servers = await (await get(`${url}/api/theme/episode/servers?episodeId=${check.episodeId}`)).json();
    const count = (servers.html?.match(/server-item/g) ?? []).length;
    if (!servers.status || count === 0) throw new Error("no servers for the test episode");
    return `${episodes} episodes, ${count} servers`;
  },

  async zoko({ check }) {
    const html = await (await get(check.embed)).text();
    const blob = html.match(/window\.__P\s*=\s*"([^"]+)"/)?.[1];
    if (!blob) throw new Error("no __P config on the embed page");
    const key = Buffer.from(check.key);
    const bytes = Buffer.from(blob, "base64").map((b, i) => b ^ key[i % key.length]);
    const config = JSON.parse(Buffer.from(bytes).toString("utf8"));
    const referer = new URL(check.embed).origin + "/";
    const master = await (await get(config.src, { Referer: referer })).text();
    const level = master.split("\n").find((line) => line && !line.startsWith("#"));
    const playlistUrl = new URL(level, config.src).href;
    const playlist = await (await get(playlistUrl, { Referer: referer })).text();
    const segment = playlist.split("\n").find((line) => line && !line.startsWith("#"));
    const head = new Uint8Array(await (await get(new URL(segment, playlistUrl).href, { Range: "bytes=0-187" })).arrayBuffer());
    if (head[0] !== 0x47) throw new Error("first segment is not MPEG-TS");
    return `stream ok, ${config.subtitles?.length ?? 0} subtitles`;
  },
};

const all = [...targets.sites.map((t) => ({ ...t, kind: "site" })), ...targets.players.map((t) => ({ ...t, kind: "player" }))];

if (!renderOnly) {
  const now = Date.now();
  for (const target of all) {
    if (target.state !== "supported" || !checkers[target.id]) continue;
    const entry = (health[target.id] ??= { history: [] });
    const started = Date.now();
    try {
      entry.message = await checkers[target.id](target);
      entry.ok = true;
    } catch (error) {
      entry.message = error instanceof Error ? error.message : String(error);
      entry.ok = false;
    }
    entry.checkedAt = new Date(now).toISOString();
    entry.history = [...entry.history, { t: now, ok: entry.ok }].filter((h) => now - h.t < WEEK_MS);
    console.log(`${entry.ok ? "OK  " : "FAIL"} ${target.name}: ${entry.message} (${Date.now() - started} ms)`);
  }
  writeFileSync(healthFile, JSON.stringify(health, null, 2) + "\n");
}

const COLORS = { working: "#4c1", partial: "#dfb317", broken: "#e05d44", planned: "#9f9f9f", unknown: "#9f9f9f" };

function stateOf(target) {
  if (target.state === "planned") return "planned";
  if (target.state === "partial") return "partial";
  const result = health[target.id];
  if (!checkers[target.id]) return "working";
  if (result?.ok === undefined) return "unknown";
  return result.ok ? "working" : "broken";
}

writeFileSync(new URL("status.svg", DIR), renderSvg());
writeBadges();

function renderSvg() {
  const rowH = 22;
  const nameW = 170;
  const valueW = 90;
  const width = nameW + valueW;
  const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = (x, y, value, anchor, bold = false) =>
    `<text x="${x}" y="${y + 1}" fill="#010101" fill-opacity=".3" text-anchor="${anchor}"${bold ? ' font-weight="bold"' : ""}>${escape(value)}</text>` +
    `<text x="${x}" y="${y}" fill="#fff" text-anchor="${anchor}"${bold ? ' font-weight="bold"' : ""}>${escape(value)}</text>`;

  const rows = [];
  let y = 0;
  const header = (label, size = 13) => {
    rows.push(`<rect x="0" y="${y}" width="${width}" height="${rowH + 4}" fill="#555"/>`);
    rows.push(`<g font-size="${size}">${text(width / 2, y + 18, label, "middle", true)}</g>`);
    y += rowH + 4;
  };
  const row = (target) => {
    const state = stateOf(target);
    rows.push(`<rect x="0" y="${y}" width="${nameW}" height="${rowH}" fill="#555"/>`);
    rows.push(`<rect x="${nameW}" y="${y}" width="${valueW}" height="${rowH}" fill="${COLORS[state]}"/>`);
    rows.push(text(nameW - 8, y + 15, target.name, "end"));
    rows.push(text(nameW + valueW / 2, y + 15, state, "middle"));
    y += rowH;
  };

  header("Support status", 14);
  header("Sites", 11);
  targets.sites.forEach(row);
  header("Players", 11);
  targets.players.forEach(row);
  const checked = Object.values(health).map((h) => h.checkedAt).filter(Boolean).sort().at(-1);
  rows.push(`<rect x="0" y="${y}" width="${width}" height="${rowH}" fill="#444"/>`);
  rows.push(`<g font-size="10">${text(width / 2, y + 15, checked ? `checked ${checked.slice(0, 16).replace("T", " ")} UTC` : "not checked yet", "middle")}</g>`);
  y += rowH;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" role="img" aria-label="Tsundoku support status">
<title>Tsundoku support status</title>
<clipPath id="r"><rect width="${width}" height="${y}" rx="4"/></clipPath>
<g clip-path="url(#r)" font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11">
${rows.join("\n")}
</g>
</svg>
`;
}

function writeBadges() {
  mkdirSync(new URL("badges/", DIR), { recursive: true });
  const checked = all.filter((t) => t.state === "supported" && checkers[t.id] && health[t.id]?.ok !== undefined);
  const up = checked.filter((t) => health[t.id].ok).length;
  const healthBadge =
    checked.length === 0
      ? { message: "unknown", color: "lightgrey" }
      : up === checked.length
        ? { message: "up", color: "brightgreen" }
        : up === 0
          ? { message: "down", color: "red" }
          : { message: "degraded", color: "yellow" };

  const history = checked.flatMap((t) => health[t.id].history);
  const uptime = history.length ? (history.filter((h) => h.ok).length / history.length) * 100 : undefined;
  const uptimeBadge =
    uptime === undefined
      ? { message: "unknown", color: "lightgrey" }
      : { message: `${uptime.toFixed(2)}%`, color: uptime >= 99 ? "brightgreen" : uptime >= 90 ? "yellow" : "red" };

  const write = (name, label, badge) =>
    writeFileSync(
      new URL(`badges/${name}.json`, DIR),
      JSON.stringify({ schemaVersion: 1, label, ...badge }, null, 2) + "\n",
    );
  write("health", "health", healthBadge);
  write("uptime", "uptime 7d", uptimeBadge);
}
