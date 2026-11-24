# How it works

This guide explains how Tsundoku finds and downloads a video, and how to investigate a site or player yourself:
to fix one that broke, or to add a new one. It is written for people who know a bit of HTML and JavaScript and
have never reverse-engineered a website before.

Everything here was found with the browser's developer tools and `curl`. No private APIs, no bypassing of
Cloudflare checks or CAPTCHAs: if a step needs that, Tsundoku does not do it.

Contents:

1. [The big picture](#1-the-big-picture)
2. [Your toolbox](#2-your-toolbox)
3. [Walkthrough: HiAnime](#3-walkthrough-hianime)
4. [Walkthrough: the ZokoAnime player](#4-walkthrough-the-zokoanime-player)
5. [HLS: what a stream really is](#5-hls-what-a-stream-really-is)
6. [What Tsundoku does with the stream](#6-what-tsundoku-does-with-the-stream)
7. [When something breaks](#7-when-something-breaks)
8. [Adding a new site or player](#8-adding-a-new-site-or-player)

---

## 1. The big picture

A streaming site is usually three different services glued together:

```
 ┌──────────────┐  episode list,     ┌──────────────┐  decoded config   ┌──────────────┐
 │  The site    │  server list   ──▶ │  The player  │  (video URL,  ──▶ │ Video server │
 │ (HiAnime)    │  (embed URLs)      │ (ZokoAnime)  │  subtitles)       │  (a CDN)     │
 └──────────────┘                    └──────────────┘                   └──────────────┘
   catalogue, pages                    an <iframe> page                   .m3u8 playlists,
   and its own small API               with the real player               .ts video pieces
```

- **The site** knows the catalogue: which anime exist, their episodes, and which **servers** can play each episode.
  A "server" is just a link to an embeddable player page.
- **The player** is a page from another domain shown in an `<iframe>`. It contains the actual video address,
  often hidden (obfuscated) so it is not trivial to copy.
- **The video server** delivers the video as an **HLS stream**: a text playlist plus hundreds of small video pieces.

In Tsundoku each of these is a separate piece of code:

| Part | Code | Interface |
|---|---|---|
| Site | `src/sources/<site>/` | `Source` in `src/core/types.ts` |
| Player | `src/players/<player>/` | `Player` in `src/core/types.ts` |
| Everything after the playlist URL | `src/core/` | shared by all sites and players |

Because many sites embed the same players, a player written once works for every site that uses it.

## 2. Your toolbox

**Browser developer tools** (F12, or ⌥⌘I on a Mac). The **Network** tab is the main tool:

- Reload the page with the Network tab open, then use the filter box: `m3u8`, `episode`, `api`, `vtt`.
- The **Fetch/XHR** filter shows the small JSON/HTML requests a page makes after loading. That is where site APIs hide.
- Click a request to see its **Headers** (look at `Referer`, `Origin`, cookies) and its **Response**.
- Right-click → **Copy as cURL** gives you a terminal command that repeats the request exactly.

**Inspector / Elements tab**: right-click an element on the page → **Inspect** to see which classes and
`data-*` attributes it has. These become the CSS selectors in `parse.ts`.

**Debugger / Sources tab**: search all loaded scripts (⇧⌘F / Ctrl+Shift+F) for words like `atob`, `decrypt`,
`key`, `m3u8`, or the name of a variable you saw in the page.

**`curl`** to repeat a request outside the browser and change one thing at a time:

```bash
curl -s -A "Mozilla/5.0" "https://hianime.fm/api/theme/episode/list/481" | head -c 500
curl -s -o /dev/null -w "%{http_code}\n" -e "https://zokoanime.video/" "<playlist url>"
```

`-A` sets the User-Agent, `-e` sets the Referer, `-w "%{http_code}"` prints only the status code. Comparing
"with header" and "without header" tells you exactly what a server checks.

**`ffprobe` / `ffplay` / `mpv`** (optional) to check that a stream or a downloaded file is valid:

```bash
mpv --referrer=https://zokoanime.video/ "<master.m3u8 url>"
ffprobe -v error -show_entries stream=codec_name,duration -of compact video.mp4
```

## 3. Walkthrough: HiAnime

Code: `src/sources/hianime/` (`config.ts` for URLs, `parse.ts` for HTML, `index.ts` for the requests).

### 3.1 The anime page

```
https://hianime.fm/frieren-beyond-journeys-end-481
https://hianime.fm/watch/frieren-beyond-journeys-end-481?ep=9227
```

The last number of the slug (`481`) is the anime's id in HiAnime's API. `?ep=9227` on a watch page is the
**episode id** (not the episode number).

HiAnime moves between mirror domains (it was `hianime.at` until November 2026), so Tsundoku accepts any
`hianime.<tld>` and always talks to the mirror you are on.

The title, poster and Sub/Dub counts come from the detail page HTML (`.anisc-detail .film-name`,
`.anisc-poster img`, `.tick-sub`, `.tick-dub`).

### 3.2 The episode list

Open the Network tab on an anime page and filter by `episode`. You will see:

```
GET https://hianime.fm/api/theme/episode/list/481
```

```json
{ "status": true, "totalItems": 1, "html": "<div class=\"seasons-block\"> ... </div>" }
```

The API returns a piece of HTML, not structured data. Each episode is a link:

```html
<a title="The Journey's End" class="ssl-item ep-item"
   data-number="1" data-id="9227"
   href="https://hianime.fm/watch/frieren-beyond-journeys-end-481?ep=9227">
  <div class="ep-name dynamic-name" data-jname="Bōken no Owari">…</div>
</a>
```

`data-id` is the episode id, `data-number` the episode number, `title` / `data-jname` the English and Japanese
titles. Filler episodes have the class `ssl-item-filler`.

### 3.3 The servers of an episode

Click an episode and watch the Network tab again:

```
GET https://hianime.fm/api/theme/episode/servers?episodeId=9227
```

Again JSON with HTML inside. Each server looks like:

```html
<div class="item server-item" data-type="sub" data-server-name="ZokoAnime" data-hash="aHR0cHM6Ly96b2tv…">
```

`data-hash` is just **base64**. Decode it in the browser console:

```js
atob("aHR0cHM6Ly96b2tvYW5pbWUudmlkZW8vc3RyZWFtL21hbC81Mjk5MS8xL3N1Yg==")
// "https://zokoanime.video/stream/mal/52991/1/sub"
```

For Frieren episode 1 HiAnime lists four servers:

| Server | Type | Embed URL |
|---|---|---|
| ZokoAnime | sub | `https://zokoanime.video/stream/mal/52991/1/sub` |
| HD-1 | sub | `https://megaplay.buzz/stream/s-2/107257/sub?s=tcdn` |
| ZokoAnime | dub | `https://zokoanime.video/stream/mal/52991/1/dub` |
| HD-1 | dub | `https://megaplay.buzz/stream/s-2/107257/dub?s=tcdn` |

`52991` is the anime's **MyAnimeList id**, `1` the episode number. From here on the site is no longer involved:
the rest is the player's job. Tsundoku tries the servers in the site's order and uses the first one whose
player it supports (`src/core/resolve.ts`).

## 4. Walkthrough: the ZokoAnime player

Code: `src/players/zoko/`.

### 4.1 Find where the video address hides

Open the embed URL directly in a tab and view its source (`view-source:` or ⌘U). There is no `.m3u8` link in it,
but there is one long string:

```html
<script>window.__P="Fw0ZBgxQRk5LGBYbSllcRV…";</script>
```

A long random-looking string assigned to a global variable is a strong hint: the player's own script reads it
and decodes it. Search the player's scripts (Debugger tab) for `__P`. It leads to
`https://zokoanime.video/core/obfuscate.js`, which contains a constant:

```js
const OBF_KEY = "otaku-embed-v1";
```

and a function that does: **base64-decode**, then **XOR every byte with the key** (repeating the key), then
`JSON.parse`. XOR with a fixed key is not encryption, only hiding; doing the same XOR again undoes it.

### 4.2 Decode it yourself

Paste this into the console of the embed page:

```js
const key = new TextEncoder().encode("otaku-embed-v1");
const bytes = Uint8Array.from(atob(window.__P), (c) => c.charCodeAt(0));
const json = new TextDecoder().decode(bytes.map((b, i) => b ^ key[i % key.length]));
console.log(JSON.parse(json));
```

The result (trimmed):

```json
{
  "src": "https://hls.dramahot.top/p/…/master.m3u8?v=c5c3295f89",
  "subtitles": [
    { "lang": "en", "label": "English", "default": true, "src": "https://hls.dramahot.top/v/…/subs/….vtt" },
    { "lang": "en", "label": "French",  "default": false, "src": "…" }
  ],
  "skip": null,
  "download_url": "/download/mal/52991/1/sub",
  "player": { "engine": "jwplayer", "default_quality": "auto" }
}
```

Things worth knowing:

- **Every subtitle has `"lang": "en"`**, even French or Arabic. Tsundoku reads the language from the `label`
  instead (`src/core/languages.ts`).
- `download_url` looks tempting but leads to an external file host (`kwik.cx`) behind a Cloudflare bot check.
  Tsundoku does not try to get past such checks, so it downloads the HLS stream instead.
- The `hsub` track (`/stream/mal/…/hsub`) currently returns the same video as `sub`, not burned-in subtitles.

### 4.3 The Referer check

Try the `src` address:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "<master.m3u8 url>"                              # 403
curl -s -o /dev/null -w "%{http_code}\n" -e "https://zokoanime.video/" "<master.m3u8 url>"  # 200
```

The video server only answers playlist requests that say they come from the player (`Referer:
https://zokoanime.video/`). That is why opening the link in a new tab shows "403 Forbidden". The video pieces
and subtitles themselves do not need the header.

An extension cannot set `Referer` on its own `fetch()` calls, so Tsundoku adds a temporary
`declarativeNetRequest` rule that sets it for that host. The rule is limited to the extension's own requests
(`tabIds: [-1]`) and never touches your browsing (`src/core/headers.ts`).

## 5. HLS: what a stream really is

HLS (HTTP Live Streaming) cuts a video into small pieces and describes them in text playlists (`.m3u8`).

**Master playlist**: one line per quality.

```
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360
360/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720
720/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5300000,RESOLUTION=1920x1080
1080/index.m3u8
```

**Media playlist**: the pieces ("segments") of one quality, each a few seconds long.

```
#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:15.12,
https://hls1.drama1.cfd/s/…/360/seg_00000.ts.jpg
#EXTINF:1.88,
https://hls1.drama1.cfd/s/…/360/seg_00001.ts.jpg
…
#EXT-X-ENDLIST
```

- A 24-minute episode has about 200–300 segments.
- The segments end in `.ts.jpg` but are ordinary **MPEG-TS** files (the extension is a disguise). `ffprobe` on one
  shows H.264 video and AAC audio.
- Lines to watch for: `#EXT-X-KEY` with a `METHOD` other than `NONE` means the segments are encrypted, and
  `#EXT-X-MAP` means fMP4 segments. Tsundoku stops with a clear error on both, because it does not support them yet.
- Some episodes only offer one quality (e.g. only 1080p). Tsundoku then falls back to the closest lower quality,
  or the lowest available.

Parsing is in `src/core/hls.ts`.

## 6. What Tsundoku does with the stream

Code: `src/background/runner.ts` and `src/core/download/`, `src/core/mp4/`.

```
resolve ──▶ media playlist ──▶ download segments ──▶ <job>.ts in OPFS ──▶ remux ──▶ <job>.mp4 in OPFS ──▶ Downloads/
                                (4 at a time,                              (mux.js +     + subtitle tracks
                                 retries, resumable)                        flatten)
```

1. **Download.** Segments are fetched 4 at a time and appended **in order** to a file in OPFS, the extension's
   private disk storage. A whole episode never sits in memory. After each segment its size is saved, so an
   interrupted download continues from the last complete segment. Video CDNs answer `403`/`429` when hit too
   fast, so those errors wait longer before retrying (up to 30 s, 7 attempts).
2. **Remux.** MPEG-TS and MP4 are two different *containers* for the same H.264/AAC data. Changing the container
   ("remuxing") keeps every video and audio bit; nothing is re-encoded, so it takes seconds.
   [mux.js](https://github.com/videojs/mux.js) turns each TS segment into a **fragmented MP4** piece.
3. **Flatten.** Fragmented MP4 (many small `moof`/`mdat` boxes) is what browsers stream, but QuickTime and other
   Apple players misread its length and sometimes lose the audio. `src/core/mp4/flatten.ts` rewrites it as a
   regular MP4: `ftyp`, one big `mdat` with all samples, and a `moov` with complete sample tables.
4. **Subtitles.** The `.vtt` files are parsed and added as `mov_text` (tx3g) tracks, the subtitle format that
   QuickTime, iOS and most players read from MP4 (`src/core/mp4/text-track.ts`). Optionally they are also saved
   as `.srt` files.
5. **Save.** The finished file is handed to Firefox's download manager with the chosen folder and file name.

If mux.js cannot read a stream at all, the raw `.ts` is saved instead with separate `.srt` files, and the job says so.

### Running in the background

Downloads run in the extension's background script, not in the popup, so closing the popup does not stop them.
Firefox may unload an idle background script; jobs and their progress are kept in `storage.local`, and a
30-second alarm wakes the background up to continue them (`src/background/downloads.ts`).

## 7. When something breaks

Most breakages are one of these. Each value lives in one place on purpose.

| Symptom | Likely cause | Where to look |
|---|---|---|
| "This site is not supported" on a HiAnime page | New domain that is not `hianime.<tld>` | `hostPattern` in `src/sources/hianime/config.ts` |
| No episodes / "answered 404" | API path changed | Network tab → `config.ts` (`episodeListApi`, `serversApi`) |
| Episodes missing or wrong titles | HTML classes changed | Inspector → selectors in `src/sources/hianime/parse.ts` |
| "Could not decode the Zoko player" | New XOR key | Search the player's scripts for the key → `src/players/zoko/config.ts` |
| "Zoko has no video for this episode" | The player has no copy, or `__P` was renamed | Open the embed URL, view source |
| Playlist "answered 403" | Referer rule or new required header | Compare curl with and without headers (section 4.3) |
| Segments "answered 403/429" | Rate limiting | Fewer parallel downloads in ⚙; `concurrency` in `src/core/download/hls-download.ts` |

Debugging tips:

- Background console: `about:debugging#/runtime/this-firefox` → Tsundoku → **Inspect**. Errors from downloads
  appear there and in the Downloads tab.
- The **Advanced** setting shows each episode's playlist and subtitle links with Copy buttons. Paste them into
  `curl` or `mpv` to test outside the extension.
- `npm run health` runs the same quick checks as the README status table (site API, player decoding, first
  video segment) and prints which step fails.
- `npm run e2e` downloads a real episode in a hidden Firefox and prints progress, the fastest way to know whether
  the whole chain still works. `E2E_INTERRUPT=1 npm run e2e` also checks resuming.

## 8. Adding a new site or player

### Investigate first

1. Open an anime page on the new site with the Network tab open. Find how the **episode list** arrives: in the
   page HTML, or from an API request (filter Fetch/XHR).
2. Click an episode. Find the request that returns the **servers** or the embed `<iframe>` URL.
3. For each server, open the embed URL in its own tab. Is the player one Tsundoku already supports
   (see `src/players/`)? If yes, you only need a `Source`.
4. If not, find the video address inside the player: look for `.m3u8` in the Network tab first, then for encoded
   globals or `atob`/`decrypt` in its scripts.
5. Use `curl` to learn which headers each request needs (Referer, Origin, cookies).

Write your findings in the issue or pull request. They help whoever fixes it next time.

### A new site: implement `Source`

```ts
// src/sources/example/index.ts
import type { Source } from "../../core/types";

export const example: Source = {
  id: "example",
  name: "Example Anime",
  matchesSite: (url) => url.hostname.endsWith("example-anime.to"),
  parseAnimeUrl(url) {
    const animeId = url.pathname.match(/^\/anime\/([\w-]+)/)?.[1];
    return animeId ? { sourceId: "example", siteUrl: url.origin, animeId } : null;
  },
  async getAnime(ref) { /* title, poster, sub/dub counts */ },
  async listEpisodes(ref) { /* [{ id, number, title, filler }] */ },
  async listServers(ref, episodeId) { /* [{ name, track: "sub" | "dub", embedUrl }] */ },
};
```

Then add it to the `sources` array in `src/core/registry.ts`. Keep URLs and patterns in a `config.ts` and HTML
parsing in a `parse.ts`, like HiAnime does, so a site change is a small, obvious fix. Use `fetchText`,
`fetchJson` and `parseHtml` from `src/core/http.ts`.

### A new player: implement `Player`

```ts
// src/players/example/index.ts
import type { Player } from "../../core/types";

export const examplePlayer: Player = {
  id: "example",
  name: "ExamplePlayer",
  matches: (embedUrl) => embedUrl.hostname === "player.example.com",
  async resolve(embedUrl) {
    // fetch the embed page, find and decode the config
    return { masterUrl, referer: "https://player.example.com/", subtitles };
  },
};
```

Then add it to the `players` array in `src/core/registry.ts`. Everything after `resolve()` (quality choice,
download, MP4, subtitles, resume) already works for any HLS stream.

Finally, update the **Supported sites** / **Supported video players** tables in the README.
