# Tsundoku: Roadmap

> 積ん読: buying books and letting them pile up unread. Here: anime episodes.
> Browser extension that downloads anime episodes from streaming sites: one episode, a range, or a whole season.
> Firefox and Chrome from the same code, built with WXT.

## Decisions

| | Decision |
|---|---|
| Name | **Tsundoku** |
| Browser | Firefox 140+ and Chrome 120+ (MV3), one codebase |
| Output | **MP4** (plays everywhere) with subtitles embedded as `mov_text` tracks, optionally also `.srt` files. The source is MPEG-TS segments; they are remuxed (new container, same video/audio bits) while downloading. Raw `.ts` is only an automatic fallback if remuxing fails |
| Language | Code, UI and docs in English |
| Sites | HiAnime first, but every site is a plug-in (`src/sources/<site>`) |

## Findings (2026-11-22)

- **Video is HLS**: `master.m3u8` → 360/720/1080 playlists → ~200 plain MPEG-TS segments per episode
  (no encryption, audio and video in the same segments). Segment files end in `.ts.jpg` but are normal TS.
  1080p is about 5.3 Mbps, so a 24-minute episode is roughly 900 MB.
- **Zoko's `download_url` is not usable**: it leads to an "external download" page
  (`/api/downloads/...` → pahe.nekostream.site → kwik.cx), and kwik.cx sits behind a Cloudflare bot check.
  Tsundoku will not try to get around bot checks, so we download the HLS stream ourselves.
- hianime moved from `hianime.at` to `hianime.fm`; the adapter accepts any `hianime.<tld>`.
- Only playlists need the Referer; segments and subtitles do not. The segment CDN (Cloudflare) answers 403
  to bursts, so segment fetching stays at 4 in parallel.
- Fragmented MP4 (what mux.js and `ffmpeg -movflags frag_keyframe` produce) is misread by QuickTime/AVFoundation
  (wrong duration, sometimes no audio). `core/mp4/flatten.ts` rewrites it as a regular MP4.
- Zoko marks every subtitle as `en`; the language is read from its label instead (`core/languages.ts`).
  Some episodes only have 1080p.
- Measured (Frieren E1, 26 min): 360p 68 MB in 48 s, 1080p 352 MB in 36 s. Firefox memory stays flat during
  the download because the file is written to OPFS, not kept in RAM.

## How it works

```
Popup (UI, closes when you click away)
  ⇅ typed messages (src/core/messages.ts)
Background (the brain, keeps running)
  ├─ core/registry  → which Source handles this URL?
  ├─ sources/hianime → anime → episodes → servers → embed URL
  ├─ players/zoko   → embed page → decode __P → master.m3u8 + subtitles
  └─ background/runner → segments → <id>.ts in OPFS (resumable) → mux.js + flatten → <id>.mp4 in OPFS
                        → Downloads/<folder>/<template>.mp4
```

## Layout

```
src/
├── entrypoints/      Things the browser runs (WXT finds them by folder name)
│   ├── background.ts   routes messages to src/background/handlers.ts
│   └── popup/          the UI shown when you click the toolbar icon (React)
├── background/       handlers, downloads (queue + watchdog), runner (one job), jobs (persistence), caches
├── core/             Site-agnostic: types, messages, registry, http, hls, resolve, naming, subtitles
│   ├── download/       segment fetching, OPFS file sink
│   └── mp4/            box helpers, mux.js wrapper, fragmented → regular MP4
├── sources/<site>/   One folder per streaming site: index.ts (Source), parse.ts (HTML → data), config.ts
└── players/<host>/   One folder per embed host (Zoko; later megaplay). Implements the Player interface.
```

Adding a site = new `src/sources/<site>/` implementing `Source`; adding an embed host = new `src/players/<host>/`
implementing `Player`. Each is one line in `core/registry.ts`. `core/resolve.ts` tries every server of the
wanted track that has a supported player, in the site's order.

## Milestones

- [x] **M0: skeleton** (2026-11-22). WXT + React + TypeScript, Firefox MV3, popup ⇄ background messages,
      source registry, HiAnime URL detection (detail and watch pages, any mirror domain).
- [x] **M1: episode list** (2026-11-22). Popup shows title, poster, Sub/Dub counts and every episode
      (number, title, filler badge, current episode highlighted). Results cached 10 min in the background.
- [x] **M2: resolve one episode** (2026-11-22). Sub/Dub picker; click an episode → servers → Zoko →
      `master.m3u8` → qualities + subtitles, each with a Copy link button. Player plug-ins in `src/players`,
      Referer added by a declarativeNetRequest session rule limited to the extension's own requests.
- [x] **M3: download one episode as MP4** (2026-11-22). Download button per quality; segments fetched 4 at a
      time (longer back-off on 403/429), remuxed with mux.js, rewritten as a regular MP4, written to OPFS, then
      saved to `Downloads/Tsundoku/<Anime>/` with an `.srt` next to it. Downloads panel with progress and Cancel.
      `npm run e2e` downloads a real episode in a throwaway headless Firefox and checks the result.
- [x] **M4: selection, queue and embedded subtitles** (2026-11-22). Checkbox per episode, "All", range box
      (`1-12, 15`); bottom bar with Sub/Dub, quality (falls back to the next lower one), subtitles
      (in the video / separate .srt / both / none) and language (one or all). Settings remembered.
      2 episodes download in parallel; downloaded episodes get a ✓ (history kept in `storage.local`).
      Subtitles are embedded as `mov_text` tracks: QuickTime (View → Subtitles), IINA, VLC, iPhone.
      Advanced mode (⚙) shows stream links per episode. Episodes / Downloads tabs.
- [x] **M5: polish** (2026-11-24). Downloads survive the background being unloaded or Firefox restarting:
      raw segments go to OPFS with their sizes saved after each one, a 30 s alarm wakes the background,
      and unfinished jobs continue from the last segment (Retry does the same for failed ones). MP4 conversion
      runs after the download. Settings tab: folder, file name template with preview, 1–3 parallel downloads,
      advanced mode, forget history. Open / Folder buttons on finished downloads.
- [x] **Fixes** (2026-11-24). Downloaded episodes can be downloaded again (with a reminder). Light/dark theme.
      Request a feature / Support links. Build output moved to the visible `dist/` folder (Vite told to scan only
      `src/` so `npm run dev` keeps working).
- [x] **Chrome** (2026-11-24). Same code: HTML parsed with node-html-parser (no DOM in Chrome's service worker),
      an offscreen page makes blob URLs for the download manager, PNG icons, per-browser manifest, startup
      listeners so Chrome wakes the worker to resume downloads. `E2E_BROWSER=chrome npm run e2e` passes.
- [x] **Releases and updates** (2026-11-24). Pushing a `v*` tag signs the Firefox build (unlisted), publishes a
      GitHub release with both builds and updates `updates.json`, so Firefox updates itself. Chrome shows a
      "new version" notice in the popup (GitHub API, checked every 6 h).
- [ ] **Later:** "Download" buttons on the site itself, italics in embedded subtitles,
      fallback to the HD-1 (megaplay) server, more sites.

## Risks

| Risk | Mitigation |
|---|---|
| Site changes domain, API, or the Zoko key | All such values live in each adapter's `config.ts` |
| 900 MB episodes in browser memory | Everything is written to the extension's private disk storage (OPFS). Needs about twice the episode size free while converting |
| Chrome's background has no DOM | node-html-parser for HTML, offscreen page for blob URLs. Resuming after Chrome stops the worker relies on the alarm and startup listeners; only the Firefox path is covered by an automated test |
| Many requests at once get rate-limited | 4 segments in parallel, up to 7 retries, 403/429 back off up to 30 s |
| Firefox suspends the background during a long download | Jobs and per-segment progress live in `storage.local`; an alarm wakes the background and the job resumes. Tested by reloading the extension mid-download (`E2E_INTERRUPT=1 npm run e2e`) |
| Legal | Personal use only |
