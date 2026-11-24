# Installing Tsundoku

Tsundoku is built from one codebase for **Firefox 140+** and **Chrome 120+**. Chrome steps are in
[Chrome](#chrome) at the end.

## Firefox

Firefox only runs extensions that Mozilla has **signed**, with two exceptions meant for testing: temporary add-ons,
and unsigned add-ons in Firefox Developer Edition / Nightly.

| Way | For | Survives a Firefox restart |
|---|---|---|
| [1. Signed release](#1-signed-release) | Everyone | Yes |
| [2. Temporary add-on](#2-temporary-add-on) | Trying a build from source | No |
| [3. Developer Edition, unsigned](#3-firefox-developer-edition-unsigned) | Running your own build every day | Yes |
| [4. Development mode](#4-development-mode-npm-run-dev) | Contributors | No (throwaway profile) |

Requirements: **Firefox 140+** (desktop). Building from source also needs **Node.js 22.12+** and npm:

```bash
git clone https://github.com/maniinpurple/Tsundoku.git
cd Tsundoku
npm install
```

### 1. Signed release

1. Download the latest `tsundoku-*.xpi` from [Releases](https://github.com/maniinpurple/Tsundoku/releases).
2. Open the file with Firefox (or drag it onto a Firefox window) and click **Add**.
3. Click the puzzle-piece icon in the toolbar and pin Tsundoku so its icon is always visible.

To update, install the newer `.xpi` the same way. Settings and download history are kept.

### 2. Temporary add-on

```bash
npm run build
```

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `dist/firefox-mv3/manifest.json`.
3. After changing code, run `npm run build` again and click **Reload** next to Tsundoku.

The add-on is removed when Firefox quits.

### 3. Firefox Developer Edition, unsigned

[Developer Edition](https://www.mozilla.org/firefox/developer/) and Nightly can keep unsigned add-ons installed.

1. In Developer Edition open `about:config`, set `xpinstall.signatures.required` to `false`.
2. Build the package:
   ```bash
   npm run zip
   ```
3. Open `about:addons` → gear icon → **Install Add-on From File…** → choose `dist/tsundoku-<version>-firefox.zip`.

Regular Firefox (release and beta) ignores that setting.

### 4. Development mode (`npm run dev`)

```bash
npm run dev
```

WXT builds the extension, starts a **fresh Firefox profile** with it installed, opens a HiAnime page and reloads
the extension every time you save a file. Your normal Firefox profile is not touched.

If Firefox is not found, or to use another edition:

```bash
FIREFOX_BIN="/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox" npm run dev
```

Logs: in that Firefox open `about:debugging#/runtime/this-firefox` → Tsundoku → **Inspect** for the background
script (where downloads run). Right-click inside the popup → **Inspect** for the popup.

## Chrome

Chrome and other Chromium browsers (Edge, Brave, Vivaldi) can keep an unpacked extension installed permanently in
Developer mode, so no signing is needed.

### From a release

1. Download `tsundoku-*-chrome.zip` from [Releases](https://github.com/maniinpurple/Tsundoku/releases) and unzip it
   somewhere you will keep it.
2. Open `chrome://extensions` and switch on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.

### From source

```bash
npm run build:chrome      # builds dist/chrome-mv3; load it with Load unpacked
npm run dev:chrome        # opens a fresh Chrome profile with the extension and reloads on save
npm run zip:chrome        # dist/tsundoku-<version>-chrome.zip
```

Logs: `chrome://extensions` → Tsundoku → **service worker** (background, where downloads run). Right-click inside the
popup → **Inspect** for the popup.

Set `CHROME_BIN` if a script cannot find Chrome.
