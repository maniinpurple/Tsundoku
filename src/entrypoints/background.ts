// The background script: Tsundoku's "brain". It keeps running when the popup closes,
// so all real work (scraping, the download queue) will live here.
// For now it answers one question: what is on this tab?
import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import type { Message, TabInfo } from "../core/messages";
import { findSource } from "../core/registry";

function inspectTab(rawUrl: string): TabInfo {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: "unsupported" };
  }
  const source = findSource(url);
  if (!source) return { kind: "unsupported" };
  const anime = source.parseAnimeUrl(url);
  if (!anime) return { kind: "site-page", sourceName: source.name };
  return { kind: "anime", sourceName: source.name, anime };
}

export default defineBackground(() => {
  // Returning a Promise from the listener is how the reply gets back to the sender.
  browser.runtime.onMessage.addListener((message: Message) => {
    switch (message.name) {
      case "inspectTab":
        return Promise.resolve(inspectTab(message.url));
    }
  });
});
