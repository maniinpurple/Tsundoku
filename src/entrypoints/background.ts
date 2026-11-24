import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { initDownloads } from "../background/downloads";
import { runE2e } from "../background/e2e";
import { handlers } from "../background/handlers";
import type { Envelope, Result } from "../core/messages";

async function dispatch({ name, payload }: Envelope): Promise<Result<unknown>> {
  try {
    const handler = handlers[name] as (payload: unknown) => Promise<unknown>;
    return { ok: true, data: await handler(payload) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: Envelope) => dispatch(message));
  initDownloads();
  if (import.meta.env.WXT_E2E_URL) void runE2e(import.meta.env.WXT_E2E_URL, !!import.meta.env.WXT_E2E_INTERRUPT);
});
