import type { AnimeInfo, AnimeRef, Episode } from "../../core/types";

const text = (element: Element | null | undefined) => element?.textContent?.trim() || undefined;

const count = (element: Element | null) => {
  const value = Number.parseInt(text(element) ?? "", 10);
  return Number.isNaN(value) ? undefined : value;
};

export function parseAnimePage(doc: Document, ref: AnimeRef): AnimeInfo {
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

export function parseEpisodeList(doc: Document): Episode[] {
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
