import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  webExt: {
    startUrls: ["https://hianime.fm/frieren-beyond-journeys-end-481"],
    binaries: { firefox: "/Applications/Firefox.app/Contents/MacOS/firefox" },
  },
  manifest: {
    name: "Tsundoku",
    description: "Download anime episodes from streaming sites, one episode or a whole season.",
    permissions: ["activeTab", "declarativeNetRequestWithHostAccess"],
    // Sites move between mirror domains and video CDNs change often, so a fixed host list would keep breaking.
    host_permissions: ["<all_urls>"],
    icons: { 48: "icon.svg", 96: "icon.svg" },
    action: { default_title: "Tsundoku", default_icon: "icon.svg" },
    browser_specific_settings: {
      gecko: {
        id: "tsundoku@local",
        strict_min_version: "140.0",
        data_collection_permissions: { required: ["none"] },
      },
    },
  },
});
