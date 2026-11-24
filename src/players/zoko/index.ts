import { FetchError, fetchText } from "../../core/http";
import { languageFromLabel } from "../../core/languages";
import type { Player, Subtitle } from "../../core/types";
import { zokoConfig } from "./config";

type ZokoConfig = {
  src?: string;
  subtitles?: { lang?: string; label?: string; src?: string; default?: boolean }[];
};

function decode(blob: string): ZokoConfig {
  const bytes = Uint8Array.from(atob(blob), (char) => char.charCodeAt(0));
  const key = new TextEncoder().encode(zokoConfig.key);
  const plain = bytes.map((byte, i) => byte ^ key[i % key.length]!);
  try {
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new FetchError("Could not decode the Zoko player (its key may have changed)");
  }
}

export const zoko: Player = {
  id: "zoko",
  name: "ZokoAnime",

  matches(embedUrl) {
    return zokoConfig.hostPattern.test(embedUrl.hostname);
  },

  async resolve(embedUrl) {
    const html = await fetchText(embedUrl);
    const blob = html.match(zokoConfig.blobPattern)?.[1];
    if (!blob) throw new FetchError("Zoko has no video for this episode");
    const config = decode(blob);
    if (!config.src) throw new FetchError("Zoko returned no video source");

    const subtitles: Subtitle[] = (config.subtitles ?? [])
      .filter((sub) => sub.src)
      .map((sub) => {
        const language = languageFromLabel(sub.label ?? "");
        return {
          lang: language?.code ?? sub.lang ?? "und",
          label: language?.name ?? sub.label ?? "Unknown",
          url: new URL(sub.src!, embedUrl).href,
          default: sub.default ?? false,
        };
      });

    return { masterUrl: new URL(config.src, embedUrl).href, referer: new URL(embedUrl).origin + "/", subtitles };
  },
};
