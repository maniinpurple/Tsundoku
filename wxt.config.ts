import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  outDir: "dist",
  modules: ["@wxt-dev/module-react"],
  // Builds live in dist/ inside the project, so Vite must not scan their HTML during `npm run dev`.
  vite: () => ({
    optimizeDeps: { entries: ["src/**/*.html"] },
    server: { watch: { ignored: ["**/dist/**"] } },
  }),
  manifestVersion: 3,
  webExt: {
    startUrls: ["https://hianime.fm/frieren-beyond-journeys-end-481"],
    // Set FIREFOX_BIN if web-ext cannot find Firefox on its own (e.g. Developer Edition).
    binaries: process.env.FIREFOX_BIN ? { firefox: process.env.FIREFOX_BIN } : undefined,
  },
  manifest: ({ browser }) => ({
    name: "Tsundoku",
    description: "Download anime episodes from streaming sites, one episode or a whole season.",
    permissions: [
      "activeTab",
      "alarms",
      "declarativeNetRequestWithHostAccess",
      "downloads",
      "downloads.open",
      "storage",
      ...(browser === "chrome" ? ["offscreen"] : []),
    ],
    // Sites move between mirror domains and video CDNs change often, so a fixed host list would keep breaking.
    host_permissions: ["<all_urls>"],
    icons: { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png", 96: "icon/96.png", 128: "icon/128.png" },
    action: { default_title: "Tsundoku", default_icon: { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png" } },
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "tsundoku@local",
              strict_min_version: "140.0",
              data_collection_permissions: { required: ["none"] },
            },
          },
        }
      : { minimum_chrome_version: "120" }),
  }),
});
