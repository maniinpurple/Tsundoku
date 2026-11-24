import { browser } from "wxt/browser";
import { DEFAULT_FOLDER, DEFAULT_TEMPLATE } from "./naming";
import type { Track } from "./types";

export type QualityPreference = "best" | "1080p" | "720p" | "480p" | "360p";
export type SubtitleMode = "embed" | "srt" | "both" | "none";

export interface Settings {
  track: Track;
  quality: QualityPreference;
  subtitleMode: SubtitleMode;
  /** Language code, or "all". */
  subtitleLanguage: string;
  advanced: boolean;
  folder: string;
  fileNameTemplate: string;
  parallelDownloads: number;
  skipDownloaded: boolean;
}

export const defaultSettings: Settings = {
  track: "sub",
  quality: "1080p",
  subtitleMode: "embed",
  subtitleLanguage: "en",
  advanced: false,
  folder: DEFAULT_FOLDER,
  fileNameTemplate: DEFAULT_TEMPLATE,
  parallelDownloads: 2,
  skipDownloaded: true,
};

const KEY = "settings";

export async function loadSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined;
  return { ...defaultSettings, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [KEY]: settings });
}
