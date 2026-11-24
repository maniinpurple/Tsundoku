import { readStoredFile } from "./download/sink";

/** Something to hand to the browser's download manager: a file in OPFS, or small generated text. */
export type FileSource = { stored: string } | { text: string; type: string };

export interface OffscreenRequest {
  target: "offscreen";
  action: "createUrl" | "revokeUrl";
  source?: FileSource;
  url?: string;
}

/** Turns a FileSource into a blob: URL. Needs a document, so on Chrome it runs in the offscreen page. */
export async function createUrl(source: FileSource): Promise<string> {
  const blob = "stored" in source ? await readStoredFile(source.stored) : new Blob([source.text], { type: source.type });
  return URL.createObjectURL(blob);
}

export function isOffscreenRequest(message: unknown): message is OffscreenRequest {
  return typeof message === "object" && message !== null && (message as OffscreenRequest).target === "offscreen";
}
