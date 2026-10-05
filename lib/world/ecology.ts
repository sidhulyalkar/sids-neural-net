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

// Photo references: archive 040 (daylight topcoat), 042/043 (white face/chest).
// Sid's direct color description overrides sunset/shade casts. These are art-directed
// sRGB material colors, not calibrated fur reflectance or an exact coat measurement.
export const SHASTA_COAT = {
  white: "#f4eee1",
  topcoat: "#c4a675",
  gold: "#dbc39a",
  tailBase: "#ab7352",
  mask: "#9f805e",
  nose: "#302923",
  eye: "#5b86a1",
} as const;
