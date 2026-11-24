import { browser } from "wxt/browser";
import { createUrl, isOffscreenRequest } from "../../core/file-url";

browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: unknown) => void) => {
  if (!isOffscreenRequest(message)) return false;
  if (message.action === "revokeUrl" && message.url) {
    URL.revokeObjectURL(message.url);
    sendResponse({ ok: true });
    return false;
  }
  if (message.action === "createUrl" && message.source) {
    createUrl(message.source)
      .then((url) => sendResponse({ ok: true, url }))
      .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  return false;
});
