import { browser } from "wxt/browser";
import { createUrl, type FileSource, type OffscreenRequest } from "../core/file-url";

// Chrome's background is a service worker without URL.createObjectURL, so an offscreen page makes the URLs.
const OFFSCREEN_PATH = "/offscreen.html";

export async function fileUrl(source: FileSource): Promise<{ url: string; revoke: () => Promise<void> }> {
  if (import.meta.env.FIREFOX) {
    const url = await createUrl(source);
    return { url, revoke: async () => URL.revokeObjectURL(url) };
  }
  await ensureOffscreen();
  const reply = await askOffscreen({ target: "offscreen", action: "createUrl", source });
  if (!reply.ok || !reply.url) throw new Error(`Could not prepare the file (${reply.error ?? "offscreen page"})`);
  const url = reply.url;
  return { url, revoke: async () => void (await askOffscreen({ target: "offscreen", action: "revokeUrl", url })) };
}

let creating: Promise<void> | undefined;

async function ensureOffscreen() {
  const contexts = await browser.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (contexts.length > 0) return;
  creating ??= browser.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["BLOBS"],
      justification: "Create download links for finished episodes",
    })
    .finally(() => (creating = undefined));
  await creating;
}

function askOffscreen(request: OffscreenRequest): Promise<{ ok: boolean; url?: string; error?: string }> {
  return browser.runtime.sendMessage(request);
}
