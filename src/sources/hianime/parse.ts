import type { HtmlNode } from "../../core/http";
import type { AnimeInfo, AnimeRef, Episode, Server } from "../../core/types";

const text = (element: HtmlNode | null | undefined) => element?.textContent?.trim() || undefined;

const count = (element: HtmlNode | null) => {
  const value = Number.parseInt(text(element) ?? "", 10);
  return Number.isNaN(value) ? undefined : value;
};

export function parseAnimePage(doc: HtmlNode, ref: AnimeRef): AnimeInfo {
  const detail = doc.querySelector(".anisc-detail") ?? doc;
  const name = detail.querySelector(".film-name");
  return {
    ref,
    title: text(name) ?? ref.animeId,
    altTitle: name?.getAttribute("data-jname") ?? undefined,
    posterUrl:
      doc.querySelector(".anisc-poster img")?.getAttribute("src") ??
      doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ??
      undefined,
    subCount: count(detail.querySelector(".tick-sub")),
    dubCount: count(detail.querySelector(".tick-dub")),
  };
}

export function parseEpisodeList(doc: HtmlNode): Episode[] {
  const episodes: Episode[] = [];
  for (const link of doc.querySelectorAll(".ss-list a.ep-item")) {
    const id = link.getAttribute("data-id");
    const number = Number(link.getAttribute("data-number"));
    if (!id || !Number.isFinite(number)) continue;
    const title = link.getAttribute("title") ?? `Episode ${number}`;
    const altTitle = link.querySelector(".ep-name")?.getAttribute("data-jname") ?? undefined;
    episodes.push({
      id,
      number,
      title,
      altTitle: altTitle !== title ? altTitle : undefined,
      filler: link.classList.contains("ssl-item-filler"),
    });
  }
  return episodes;
}

export function parseServerList(doc: HtmlNode): Server[] {
  const servers: Server[] = [];
  for (const item of doc.querySelectorAll(".server-item")) {
    const track = item.getAttribute("data-type");
    const name = item.getAttribute("data-server-name");
    const hash = item.getAttribute("data-hash");
    if ((track !== "sub" && track !== "dub") || !name || !hash) continue;
    const embedUrl = atob(hash);
    if (!URL.canParse(embedUrl)) continue;
    servers.push({ name, track, embedUrl });
  }
  return servers;
}
