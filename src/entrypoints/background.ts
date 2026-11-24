import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { initDownloads } from "../background/downloads";
import { runE2e } from "../background/e2e";
import { handlers } from "../background/handlers";
import type { Envelope, Result } from "../core/messages";

function isEnvelope(message: unknown): message is Envelope {
  return typeof message === "object" && message !== null && (message as Envelope).name in handlers;
}

async function dispatch({ name, payload }: Envelope): Promise<Result<unknown>> {
  try {
    const handler = handlers[name] as (payload: unknown) => Promise<unknown>;
    return { ok: true, data: await handler(payload) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default defineBackground(() => {
  // sendResponse + return true works in both Firefox and Chrome; returning a Promise does not in older Chrome.
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: unknown) => void) => {
    if (!isEnvelope(message)) return false;
    void dispatch(message).then(sendResponse);
    return true;
  });
  // Chrome only starts its service worker for events it has listeners for. These make it start when the
  // browser opens or the extension is reloaded, so unfinished downloads continue right away.
  browser.runtime.onStartup.addListener(() => {});
  browser.runtime.onInstalled.addListener(() => {});
  initDownloads();
  if (import.meta.env.WXT_E2E_URL) void runE2e(import.meta.env.WXT_E2E_URL, !!import.meta.env.WXT_E2E_INTERRUPT);
});
