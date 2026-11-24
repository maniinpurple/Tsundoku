import { parse } from "node-html-parser";
import { useReferer } from "./headers";

const TIMEOUT_MS = 15_000;

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface FetchOptions extends RequestInit {
  referer?: string;
  timeoutMs?: number;
}

async function request(url: string, { referer, timeoutMs = TIMEOUT_MS, signal, ...init }: FetchOptions = {}) {
  if (referer) await useReferer(url, referer);
  const timeout = AbortSignal.timeout(timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    throw new FetchError(`Could not reach ${new URL(url).host} (${String(error)})`);
  }
  if (!response.ok) throw new FetchError(`${new URL(url).host} answered ${response.status}`, response.status);
  return response;
}

export async function fetchText(url: string, options?: FetchOptions): Promise<string> {
  return (await request(url, options)).text();
}

export async function fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
  return (await request(url, options)).json() as Promise<T>;
}

export async function fetchBytes(url: string, options?: FetchOptions): Promise<Uint8Array> {
  return new Uint8Array(await (await request(url, options)).arrayBuffer());
}

export type HtmlNode = ReturnType<typeof parse>;

// Not DOMParser: Chrome runs the background as a service worker, which has no DOM.
export function parseHtml(html: string): HtmlNode {
  return parse(html);
}
