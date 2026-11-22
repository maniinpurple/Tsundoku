// The popup and the background are separate programs (popup dies when it closes,
// background keeps running). They talk by messages, like two processes over IPC.
// Every message type and its reply type are listed here, so both sides agree.
import { browser } from "wxt/browser";
import type { AnimeRef } from "./types";

/** Reply to "inspectTab": what is on the page the user is looking at? */
export type TabInfo =
  | { kind: "anime"; sourceName: string; anime: AnimeRef }
  | { kind: "site-page"; sourceName: string } // supported site, but not an anime page
  | { kind: "unsupported" };

/** Map: message name -> { request payload, reply }. Add new messages here. */
export interface MessageMap {
  inspectTab: { request: { url: string }; reply: TabInfo };
}

export type MessageName = keyof MessageMap;
export type Message<N extends MessageName = MessageName> = { name: N } & MessageMap[N]["request"];

/** Popup side: send a message and get a typed reply. */
export function send<N extends MessageName>(
  name: N,
  request: MessageMap[N]["request"],
): Promise<MessageMap[N]["reply"]> {
  return browser.runtime.sendMessage({ name, ...request });
}
