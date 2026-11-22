import { browser } from "wxt/browser";

// Background fetches cannot set Referer themselves, so a session rule adds it.
// tabIds [-1] limits the rule to the extension's own requests, never the user's tabs.
const rules = new Map<string, { id: number; referer: string }>();
let ready: Promise<void> | undefined;
let nextId = 1;

function clearOldRules(): Promise<void> {
  ready ??= browser.declarativeNetRequest.getSessionRules().then((old) =>
    browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: old.map((rule) => rule.id) }),
  );
  return ready;
}

export async function useReferer(url: string, referer: string): Promise<void> {
  await clearOldRules();
  const host = new URL(url).hostname;
  const existing = rules.get(host);
  if (existing?.referer === referer) return;

  const id = existing?.id ?? nextId++;
  rules.set(host, { id, referer });
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [id],
    addRules: [
      {
        id,
        condition: { requestDomains: [host], tabIds: [-1] },
        action: {
          type: "modifyHeaders",
          requestHeaders: [{ header: "Referer", operation: "set", value: referer }],
        },
      },
    ],
  });
}
