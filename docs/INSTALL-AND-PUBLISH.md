# Installing and publishing Tsundoku

Firefox only runs extensions that Mozilla has **signed**, with two exceptions meant for developers:
temporary add-ons, and unsigned add-ons in Firefox Developer Edition / Nightly. This page covers all of them.

| Way | Who it is for | Survives a Firefox restart | Needs a Mozilla account |
|---|---|---|---|
| [1. `npm run dev`](#1-development-mode-npm-run-dev) | Developers | No (throwaway profile) | No |
| [2. Temporary add-on](#2-temporary-add-on) | Testing a build in your own Firefox | No | No |
| [3. Developer Edition, unsigned](#3-firefox-developer-edition-unsigned) | Daily use without signing | Yes | No |
| [4. Signed `.xpi`, self-distributed](#4-signed-xpi-self-distributed-unlisted) | Publishing releases on GitHub | Yes | Yes |
| [5. addons.mozilla.org listing](#5-listing-on-addonsmozillaorg) | Public store page | Yes | Yes |

Requirements for building: **Node.js 22.12+**, **npm**, **Firefox 140+**.

```bash
git clone https://github.com/maniinpurple/Tsundoku.git
cd Tsundoku
npm install
```

---

## 1. Development mode (`npm run dev`)

```bash
npm run dev
```

WXT builds the extension, starts a **fresh Firefox profile** with it installed, opens a HiAnime page, and reloads the
extension every time you save a file. Your normal Firefox profile is not touched.

If Firefox is not found (or you want another edition):

```bash
FIREFOX_BIN="/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox" npm run dev
```

To see logs: in the dev Firefox open `about:debugging#/runtime/this-firefox` → Tsundoku → **Inspect**. That console
belongs to the background script, where all downloads run. Right-click inside the popup → **Inspect** for the popup.

## 2. Temporary add-on

Use this to try a build in your everyday Firefox.

```bash
npm run build
```

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `.output/firefox-mv3/manifest.json`.
3. After changing code, run `npm run build` again and click **Reload** next to Tsundoku.

The add-on is removed when Firefox quits. Its settings and download history stay in Firefox as long as the
extension id does not change.

## 3. Firefox Developer Edition, unsigned

[Developer Edition](https://www.mozilla.org/firefox/developer/) and Nightly can install unsigned add-ons permanently.

1. In Developer Edition open `about:config`, set `xpinstall.signatures.required` to `false`.
2. Build the package:
   ```bash
   npm run zip
   ```
3. Open `about:addons` → gear icon → **Install Add-on From File…** → choose `.output/tsundoku-<version>-firefox.zip`.

Regular Firefox (release and beta) ignores that setting.

## 4. Signed `.xpi`, self-distributed ("unlisted")

Mozilla signs the extension without giving it a store page. You get a `.xpi` file that installs in any Firefox,
which you can attach to a GitHub release. Signing is free; the automated review takes from a few seconds to a few
minutes.

### One-time setup

1. Create an account on [addons.mozilla.org](https://addons.mozilla.org) (AMO).
2. Open [Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/) and generate credentials:
   a **JWT issuer** (looks like `user:12345:67`) and a **JWT secret**.
3. Keep them out of the repository, for example in your shell:
   ```bash
   export WEB_EXT_API_KEY="user:12345:67"
   export WEB_EXT_API_SECRET="your-secret"
   ```
4. **Choose the extension id once.** It is `browser_specific_settings.gecko.id` in `wxt.config.ts`
   (currently `tsundoku@local`). Mozilla ties every signed version to it and it cannot change later, so pick
   something unique that you own, e.g. `tsundoku@yourname.github.io`.

### Every release

1. Raise `"version"` in `package.json` (Mozilla refuses to sign the same version twice). The manifest version
   comes from there.
2. Build, check and sign:
   ```bash
   npm run check && npm run build && npm run lint
   npx web-ext sign --channel unlisted -s .output/firefox-mv3
   ```
3. The signed file appears in `web-ext-artifacts/`, e.g. `tsundoku-0.2.0.xpi`.
4. Create a GitHub release (tag `v0.2.0`) and attach the `.xpi`. Users install it by opening the file in Firefox.

### Automatic updates (optional)

Self-distributed add-ons only update themselves if the manifest has an `update_url` pointing to an
[update manifest](https://extensionworkshop.com/documentation/manage/updating-your-extension/) (a small JSON
file listing versions and `.xpi` links). You can host that JSON on GitHub Pages or in the repository and add
`update_url` under `browser_specific_settings.gecko` in `wxt.config.ts`. Without it, users download new releases
by hand.

## 5. Listing on addons.mozilla.org

A listed add-on gets a store page, search, ratings and automatic updates. It also gets a **human review**, and the
reviewers check the add-on against Mozilla's
[Add-on Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/). Downloaders built around
unlicensed streaming sites are at real risk of being rejected or removed, so self-distribution (section 4) is
the dependable option. If you still want a listing:

1. Make the package and the sources package:
   ```bash
   npm run zip
   ```
   This creates `.output/tsundoku-<version>-firefox.zip` and `.output/tsundoku-<version>-sources.zip`.
2. In the [Developer Hub](https://addons.mozilla.org/developers/) choose **Submit a New Add-on** → **On this site**,
   upload the firefox zip.
3. When asked whether the code is minified or bundled, answer **yes** and upload the sources zip. Reviewers rebuild
   it, so add these build notes:
   ```
   Requirements: Node.js 22.12+, npm.
   npm install
   npm run zip
   The built extension is .output/tsundoku-<version>-firefox.zip
   ```
4. Fill in the listing: summary, description, screenshots, category, license, and support links (the GitHub
   repository and its Issues page).
5. Data collection: Tsundoku declares that it collects no data (`data_collection_permissions: none`). Say so in
   the listing; no privacy policy is required for that.

Later versions can be uploaded the same way, or from the command line:

```bash
npx web-ext sign --channel listed -s .output/firefox-mv3 --upload-source-code .output/tsundoku-<version>-sources.zip
```

## Release checklist

- [ ] `version` raised in `package.json`
- [ ] `npm run check`, `npm run build`, `npm run lint` pass
- [ ] `npm run e2e` downloads an episode (and `E2E_INTERRUPT=1 npm run e2e` resumes one)
- [ ] Tried the popup by hand: select episodes, download, Open / Folder, Retry
- [ ] README tables (sites, players) are up to date
- [ ] Signed `.xpi` attached to a GitHub release with a short changelog
