# Contributing to Tsundoku

Thanks for wanting to help! You do not need to be an expert. Reporting a broken site with good details is as
useful as writing code.

## Ways to help

| You want to… | Do this |
|---|---|
| Report something broken | [Open a bug report](https://github.com/maniinpurple/Tsundoku/issues/new?template=bug_report.yml) |
| Ask for a new site or player | [Open a site request](https://github.com/maniinpurple/Tsundoku/issues/new?template=site_request.yml) |
| Suggest a feature | [Open a feature request](https://github.com/maniinpurple/Tsundoku/issues/new?template=feature_request.yml) |
| Write code | Pick an issue (see below), then open a pull request |
| Investigate a site | Follow [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) and post what you find in the issue |

### Finding something to work on

Open issues are the to-do list. Labels tell you what kind of work it is:

| Label | Meaning |
|---|---|
| `good first issue` | Small and well described. A good start if you are new to the project |
| `help wanted` | The maintainer would like someone to take this |
| `site` / `player` | About one streaming site or one embedded player |
| `broken` | Something that used to work has stopped working |
| `bug` / `enhancement` | Something wrong in Tsundoku itself / a new feature |
| `needs investigation` | Nobody knows yet how the site or player works |

Before you start, **comment on the issue** ("I'd like to take this"), so two people don't do the same work. If an
issue has been quiet for two weeks after someone claimed it, feel free to ask whether you can take it over.

For anything big (a new site, a redesign), open or comment on an issue first and agree on the approach
before writing a lot of code.

## Development setup

Requirements: Node.js 22.12+, npm, Firefox 140+.

```bash
git clone https://github.com/<your-username>/Tsundoku.git   # your fork, see "Pull requests" below
cd Tsundoku
npm install
npm run dev
```

`npm run dev` opens a separate Firefox with the extension loaded and reloads it on every save. More options
(temporary add-on, logs) are in [docs/INSTALL.md](docs/INSTALL.md).

| Command | What it does |
|---|---|
| `npm run check` | Type-check |
| `npm run build` | Build into `dist/firefox-mv3` |
| `npm run lint` | Mozilla's add-on linter (run after `build`) |
| `npm run e2e` | Download a real episode in a hidden Firefox and print the result |
| `npm run health` | Check every supported site and player, redraw `status/status.svg` and the badges |

## Project layout

```
src/
├── entrypoints/          What the browser runs (WXT finds these by folder name)
│   ├── background.ts       Routes popup messages to src/background
│   └── popup/              The popup UI (React)
├── background/           Download queue, one-job runner, persistence, caches
├── core/                 Shared by every site: types, messages, HLS, MP4, subtitles, naming, settings
│   ├── download/           Segment fetching, OPFS files
│   └── mp4/                mux.js wrapper, fragmented → regular MP4, subtitle tracks
├── sources/<site>/       One folder per streaming site (implements Source)
└── players/<player>/     One folder per embedded player (implements Player)
```

The two interfaces that make the project extensible live in `src/core/types.ts`:

- **`Source`**: a streaming site. Finds the anime on a page, lists episodes and their servers.
- **`Player`**: an embedded player. Turns an embed URL into a playlist URL, a Referer and subtitles.

A new site or player is a new folder plus one line in `src/core/registry.ts`. Step-by-step instructions with
code are in [docs/HOW-IT-WORKS.md#8-adding-a-new-site-or-player](docs/HOW-IT-WORKS.md#8-adding-a-new-site-or-player).

When a site or player starts working:

1. Add it to `status/targets.json` with `"state": "supported"` (or `"planned"` / `"partial"`).
2. If it can be checked automatically, add a checker with the same `id` in `scripts/health-check.mjs`
   (a few requests that prove episodes or a stream can be found).
3. Run `npm run health` to redraw `status/status.svg` and the badges (`node scripts/health-check.mjs --render`
   redraws without contacting the sites).
4. Add a row with notes to the tables in the README.

## Code style

- TypeScript, `strict`. `npm run check` must pass with no errors.
- Code, UI text, comments and docs in English.
- Comments only where the code cannot speak for itself: a non-obvious reason, a site quirk, a magic value's
  origin. No comments that repeat what the code does.
- Values a site can change (domains, API paths, keys, selectors) belong in that site's `config.ts` or `parse.ts`,
  never scattered through the code.
- The background talks to the popup only through the typed messages in `src/core/messages.ts`.

## Testing your change

There is no unit test suite yet. Before opening a pull request:

1. `npm run check`, `npm run build` and `npm run lint` pass.
2. `npm run e2e` finishes with "Done" (it downloads Frieren episode 1 at 360p, about 70 MB).
   If you changed downloading or resuming, also run `E2E_INTERRUPT=1 npm run e2e`.
3. You tried the popup by hand in `npm run dev`: select episodes, download, open the file.
4. If you touched MP4 or subtitle code: the file plays in at least two players (e.g. VLC and QuickTime),
   with sound and subtitles.

## Pull requests

1. **Fork** the repository (button at the top right on GitHub). You get your own copy to push to.
2. Create a **branch** for one change: `git switch -c fix-hianime-episode-list`.
3. Commit with clear messages, e.g. `hianime: read episodes from the new list API`.
4. Push the branch to your fork and open a **pull request** against `main`. The template asks what you changed
   and how you tested it.
5. GitHub runs the checks automatically (type-check, build, lint). Fix anything red.
6. The maintainer reviews and may ask for changes. Push more commits to the same branch; the PR updates itself.
7. When it is approved, the maintainer merges it.

Keep pull requests small and about one thing. Several small PRs get reviewed much faster than one big one.

## What Tsundoku will not do

To keep the project safe for everyone, pull requests that do any of the following will be closed:

- Get around Cloudflare checks, CAPTCHAs, logins, paywalls or DRM.
- Add ads, analytics, tracking or any data collection.
- Download from sites that sell or officially license the content (Crunchyroll, Netflix, …).

## Questions

Open a [discussion](https://github.com/maniinpurple/Tsundoku/discussions) or ask in the related issue.
