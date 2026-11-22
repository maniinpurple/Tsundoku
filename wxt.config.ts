import { defineConfig } from "wxt";

// WXT builds one codebase into a Firefox or a Chrome extension (see package.json scripts).
// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  // `npm run dev` opens a fresh Firefox with the extension loaded, on this page.
  webExt: {
    startUrls: ["https://hianime.fm/frieren-beyond-journeys-end-481"],
    binaries: { firefox: "/Applications/Firefox.app/Contents/MacOS/firefox" },
  },
  manifest: {
    name: "Tsundoku",
    description: "Download anime episodes from streaming sites, one episode or a whole season.",
    // activeTab: read the URL of the tab you are on, only when you click the toolbar icon.
    // More permissions get added milestone by milestone (see ROADMAP.md).
    permissions: ["activeTab"],
    icons: { 48: "icon.svg", 96: "icon.svg" },
    action: { default_title: "Tsundoku", default_icon: "icon.svg" },
    browser_specific_settings: {
      // Firefox needs a stable id for MV3 extensions. Any email-like string works.
      gecko: {
        id: "tsundoku@local",
        strict_min_version: "140.0",
        // Firefox asks every new extension to declare what user data it sends away. We send none.
        data_collection_permissions: { required: ["none"] },
      },
    },
  },
});
