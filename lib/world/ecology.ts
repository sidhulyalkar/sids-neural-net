/** Regional reference palette; the compact coast-to-alpine world is an imagined composite. */
export const COASTAL_FLORA = [
  { common: "Coast redwood", scientific: "Sequoia sempervirens", habitat: "Sheltered inland grove", source: "https://www.nps.gov/redw/learn/nature/plants.htm" },
  { common: "Coyote brush", scientific: "Baccharis pilularis", habitat: "Exposed coastal scrub", source: "https://www.nps.gov/pore/learn/nature/wildlandfire_fireecology_vegtypes_coastalscrub.htm" },
  { common: "California sagebrush", scientific: "Artemisia californica", habitat: "Dry coastal slopes", source: "https://www.nps.gov/samo/learn/nature/coastalsagescrub.htm" },
  { common: "California poppy", scientific: "Eschscholzia californica", habitat: "Sunny open meadow", source: "https://www.nps.gov/muwo/learn/nature/plants.htm" },
] as const;

/**
 * The reef is an art-directed California kelp/rocky-reef composite rather than
 * one surveyed dive site. These references keep the cast anchored in real
 * cold-water Pacific communities instead of drifting into a tropical reef.
 */
export const MARINE_LIFE = [
  { common: "Giant kelp", note: "Rocky, sunlit cold-water forest", source: "https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-kelp" },
  { common: "Leopard shark", note: "Shallow-water shark that can patrol kelp forest", source: "https://www.montereybayaquarium.org/visit/exhibits/kelp-forest/" },
  { common: "Wolf-eel", note: "Crevice-dwelling fish of rocky kelp habitat", source: "https://www.montereybayaquarium.org/visit/exhibits/kelp-forest/" },
  { common: "Red octopus", note: "Octopus represented around the rocky reef", source: "https://www.montereybayaquarium.org/visit/exhibits/kelp-forest/" },
  { common: "Bat ray", note: "California ray represented gliding above reef and sandy shelf", source: "https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/bat-ray" },
  { common: "Pacific sea nettle", note: "Coastal jelly represented drifting beyond the kelp", source: "https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/sea-nettle" },
  { common: "Purple sea urchin", note: "Kelp grazer represented on the seafloor", source: "https://www.montereybayaquarium.org/animals-the-ocean/ecosystems/kelp-forest" },
  { common: "Rockfish and anchovies", note: "Midwater fish and schooling prey", source: "https://www.montereybayaquarium.org/animals-the-ocean/ecosystems/kelp-forest" },
] as const;

export type LandWildlifeKind =
  | "squirrel"
  | "mouse"
  | "woodrat"
  | "lizard"
  | "rabbit"
  | "quail";

export const LAND_WILDLIFE = [
  { id: "squirrel-grove-1", kind: "squirrel", point: { x: -6, z: 12 }, roam: 4.2, speed: 1.5 },
  { id: "squirrel-grove-2", kind: "squirrel", point: { x: 7, z: 7 }, roam: 3.8, speed: 1.4 },
  { id: "mouse-grove", kind: "mouse", point: { x: 10, z: 17 }, roam: 3.2, speed: 1.2 },
  { id: "woodrat-canyon", kind: "woodrat", point: { x: 33, z: 29 }, roam: 4.4, speed: 1.1 },
  { id: "lizard-coast", kind: "lizard", point: { x: -26, z: 17 }, roam: 4.8, speed: 1.05 },
  { id: "lizard-ridge", kind: "lizard", point: { x: 18, z: -17 }, roam: 4.3, speed: 0.95 },
  { id: "rabbit-meadow", kind: "rabbit", point: { x: 20, z: 32 }, roam: 5.0, speed: 1.25 },
  { id: "rabbit-falls", kind: "rabbit", point: { x: -13, z: -24 }, roam: 4.2, speed: 1.15 },
  { id: "quail-grove", kind: "quail", point: { x: 13, z: 2 }, roam: 5.2, speed: 1.0 },
  { id: "quail-canyon", kind: "quail", point: { x: 37, z: 37 }, roam: 4.7, speed: 1.0 },
  { id: "squirrel-desert", kind: "squirrel", point: {x:37,z:-35}, roam:3, speed:1.4 },
  { id: "rabbit-desert", kind: "rabbit", point: {x:46,z:-8}, roam:3, speed:1.3 },
  { id: "lizard-desert", kind: "lizard", point: {x:48,z:-39}, roam:2.5, speed:1.1 },
  { id: "lizard-rainforest", kind: "lizard", point: {x:43,z:36}, roam:3, speed:1 },

] as const satisfies readonly {
  id: string;
  kind: LandWildlifeKind;
  point: { x: number; z: number };
  roam: number;
  speed: number;
}[];

export const LAND_WILDLIFE_COLORS: Record<LandWildlifeKind, string> = {
  squirrel: "#92735b",
  mouse: "#8b8176",
  woodrat: "#7a7168",
  lizard: "#70815b",
  rabbit: "#b4a690",
  quail: "#8b755d",
};
