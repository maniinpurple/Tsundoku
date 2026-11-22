const TIMEOUT_MS = 15_000;

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new FetchError(`Could not reach ${new URL(url).host} (${String(error)})`);
  }
  if (!response.ok) throw new FetchError(`${new URL(url).host} answered ${response.status}`, response.status);
  return response;
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  return (await request(url, init)).text();
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return (await request(url, init)).json() as Promise<T>;
}

export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}
