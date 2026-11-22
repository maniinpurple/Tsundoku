# Tsundoku

Browser extension (Firefox first) for downloading anime episodes from streaming sites. See [ROADMAP.md](ROADMAP.md).

## Run it

```bash
npm install
npm run dev        # opens a fresh Firefox with the extension loaded; reloads on every save
```

Other commands:

```bash
npm run check      # type-check
npm run build      # build into .output/firefox-mv3
npm run zip        # zip for installing / sharing
```

To load a build in your normal Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** →
pick `.output/firefox-mv3/manifest.json` (it stays until Firefox restarts).
