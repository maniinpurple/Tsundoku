# Tsundoku: Roadmap

> 積ん読: buying books and letting them pile up unread. Here: anime episodes.
> Browser extension that downloads anime episodes from streaming sites: one episode, a range, or a whole season.
> Firefox first, Chrome later (same code, built with WXT). Fully independent from ani-box.

## Decisions

| | Decision |
|---|---|
| Name | **Tsundoku** |
| Browser | Firefox first (MV3, Firefox 140+), Chrome after M6 |
| Output | User picks the format. Default **MP4** (plays everywhere); also `.ts` (raw, fastest) |
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

## How it works

```
Popup (UI, closes when you click away)
  ⇅ typed messages (src/core/messages.ts)
Background (the brain, keeps running)
  ├─ core/registry  → which Source handles this URL?
  ├─ sources/hianime → anime → episodes → servers → embed URL
  ├─ players/zoko   → embed page → decode __P → master.m3u8 + subtitles
  └─ core/hls, core/mux, core/queue → fetch segments → MP4 → Downloads/<Anime>/<file>
```

## Layout

```
src/
├── entrypoints/      Things the browser runs (WXT finds them by folder name)
│   ├── background.ts   routes messages to src/background/handlers.ts
│   └── popup/          the UI shown when you click the toolbar icon (React)
├── background/       Message handlers (the work the background does)
├── core/             Site-agnostic: types, messages, registry, http, (later) hls, mux, queue, naming
├── sources/<site>/   One folder per streaming site: index.ts (Source), parse.ts (HTML → data), config.ts
└── players/<host>/   One folder per embed host (Zoko, megaplay). Shared by all sites. (M2)
```

Adding a site later = new `src/sources/<site>/` implementing `Source`, plus one line in `core/registry.ts`.

## Milestones

- [x] **M0: skeleton** (2026-11-22). WXT + React + TypeScript, Firefox MV3, popup ⇄ background messages,
      source registry, HiAnime URL detection (detail and watch pages, any mirror domain).
- [x] **M1: episode list** (2026-11-22). Popup shows title, poster, Sub/Dub counts and every episode
      (number, title, filler badge, current episode highlighted). Results cached 10 min in the background.
- [ ] **M2: resolve one episode.** Episode → server → Zoko → `master.m3u8`, qualities, subtitles. Sub/Dub.
- [ ] **M3: download one episode as `.ts`.** Fetch segments with the right Referer, several at a time,
      save to disk. Check memory use on a 1080p episode (biggest risk).
- [ ] **M4: MP4 + subtitles.** Convert TS → MP4 in the browser, format setting, save subtitles as `.srt`.
- [ ] **M5: selection and queue.** All / single / range, 2–3 episodes at a time, progress, pause, retry,
      skip files already downloaded.
- [ ] **M6: settings and polish.** Default quality, Sub/Dub, subtitle language, file name template.
- [ ] **Later:** Chrome build, "Download" buttons on the site itself, `.mkv` with embedded subtitles,
      fallback to the HD-1 (megaplay) server, more sites.

## Risks

| Risk | Mitigation |
|---|---|
| Site changes domain, API, or the Zoko key | All such values live in each adapter's `config.ts` |
| 900 MB episodes in browser memory | Measure in M3; keep segments as Blobs (Firefox moves large Blobs to disk) |
| Chrome's background has no `DOMParser` | All HTML parsing goes through `parseHtml` in `core/http.ts`; swap it (offscreen document or linkedom) for the Chrome build |
| Many requests at once get rate-limited | Small concurrency limit, retries with backoff |
| Legal | Personal use only |
