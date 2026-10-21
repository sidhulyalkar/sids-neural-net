import type {VisualMotionEntry} from "@/src/data/visualMotion";
import type {WorldVideoPoint} from "./model";

/** Publish only clips with authored species/reef and browser-decodable footage. */
export function buildSnorkelVideoPoints(
  entries: readonly VisualMotionEntry[],
): WorldVideoPoint[] {
  return entries.flatMap(clip => {
    if (clip.encounter?.activity !== "snorkeling" || !clip.posterSrc) return [];
    const mp4 = clip.sources.find(source => source.type === "video/mp4" &&
      (source.height ?? 1080) <= 1080 && Boolean(source.src)) ??
      clip.sources.find(source => source.type === "video/mp4" && Boolean(source.src));
    if (!mp4?.src) return [];
    return [{
      id: `snorkel-video:${clip.id}`,
      title: clip.title,
      detail: clip.description ?? "",
      animal: clip.encounter.animal,
      reef: clip.encounter.reef,
      src: mp4.src,
      posterSrc: clip.posterSrc,
    }];
  });
}
