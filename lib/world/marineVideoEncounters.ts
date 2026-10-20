import type { WildlifeSubject } from "@/src/data/visualMotion";

export type MarineCreaturePose = {
  animal: WildlifeSubject;
  reef: "kelp" | "lagoon";
  point: { x: number; y: number; z: number };
};

export type MarineVideoClip = {
  id: string;
  animal: WildlifeSubject;
  reef: "kelp" | "lagoon";
};

/**
 * Nearby animals become discoveries only if Sid has published matching footage.
 * This checks the LIVE fauna position, not a fixed marker or invented waypoint.
 * Keep the vertical threshold generous at the surface (the swimmer can see
 * animals beneath) but tighter while diving so encounters still feel local.
 */
export function nearbyMarineVideo(
  player: { x: number; y: number; z: number },
  aquatic: "land" | "surface" | "dive",
  reef: "kelp" | "lagoon" | null,
  animals: readonly MarineCreaturePose[],
  clips: readonly MarineVideoClip[],
): string | null {
  if (aquatic === "land" || !reef || !clips.length) return null;
  let best: { id: string; distance: number } | null = null;
  for (const animal of animals) {
    if (animal.reef !== reef) continue;
    const clip = clips.find(item => item.reef === reef && item.animal === animal.animal);
    if (!clip) continue;
    const horizontal = Math.hypot(player.x - animal.point.x, player.z - animal.point.z);
    const vertical = Math.abs(player.y - animal.point.y);
    if (horizontal > 6 || vertical > (aquatic === "surface" ? 8 : 4.5)) continue;
    const distance = horizontal + vertical * 0.2;
    if (!best || distance < best.distance) best = { id: clip.id, distance };
  }
  return best?.id ?? null;
}
