/**
 * Human-reviewable geography for the 49 existing Visual Cortex images.
 *
 * A mapSearch is a public place/area search, NOT a claim that the image
 * was captured at the pin's exact coordinates. Do not synthesize lat/lng
 * from these records; future map pins must be resolved and reviewed.
 *
 * verification === "user" means the place at the stated precision was
 * supplied by Sid. Landmark and approximate entries remain proposals.
 */
export type PlacePrecision = "landmark" | "area" | "region";
export type PlaceVerification = "user" | "landmark" | "approximate";
export type PhotoPlace = {
  label: string;
  mapSearch: string;
  region: string;
  countryCode: "US" | "CA" | "CR" | "PF";
  precision: PlacePrecision;
  verification: PlaceVerification;
};

function place(
  label: string, mapSearch: string, region: string,
  countryCode: PhotoPlace["countryCode"],
  precision: PlacePrecision, verification: PlaceVerification,
): PhotoPlace {
  return { label, mapSearch, region, countryCode, precision, verification };
}

export const photoPlaces: Record<string, PhotoPlace> = {
  "photo-001": place("Crater Lake National Park, Oregon", "Crater Lake National Park, Oregon, USA", "Oregon", "US", "landmark", "landmark"),
  "photo-002": place("Sierra Nevada / Cascades, western USA", "Sierra Nevada Mountains, California, USA", "Western United States", "US", "region", "approximate"),
  // Photo 003 visually resembles Death Valley, not Bora Bora. Sid's “3 from
  // Bora Bora” may instead mean THREE unspecified photos: leave unresolved.
  "photo-003": place("Death Valley area (unconfirmed)", "Death Valley National Park, California, USA", "California", "US", "region", "approximate"),
  "photo-004": place("Half Dome, Yosemite National Park", "Half Dome, Yosemite National Park, California, USA", "California", "US", "landmark", "landmark"),
  "photo-005": place("Moraine Lake, Banff National Park", "Moraine Lake, Banff National Park, Alberta, Canada", "Alberta", "CA", "landmark", "landmark"),
  "photo-006": place("Avalanche Lake, Glacier National Park (likely)", "Avalanche Lake, Glacier National Park, Montana, USA", "Montana", "US", "area", "approximate"),
  "photo-007": place("Delicate Arch, Arches National Park", "Delicate Arch, Arches National Park, Utah, USA", "Utah", "US", "landmark", "landmark"),
  "photo-008": place("Chugach Mountains area, Alaska (likely)", "Chugach State Park, Alaska, USA", "Alaska", "US", "region", "approximate"),
  "photo-009": place("Matanuska Glacier, Alaska (likely)", "Matanuska Glacier, Alaska, USA", "Alaska", "US", "area", "approximate"),
  "photo-010": place("Near Estes Park, Colorado", "Estes Park, Colorado, USA", "Colorado", "US", "area", "user"),
  "photo-011": place("Near Estes Park, Colorado", "Estes Park, Colorado, USA", "Colorado", "US", "area", "user"),
  "photo-012": place("Rocky Mountain National Park, Colorado", "Rocky Mountain National Park, Colorado, USA", "Colorado", "US", "area", "user"),
  "photo-013": place("Rocky Mountain National Park area (likely)", "Rocky Mountain National Park, Colorado, USA", "Colorado", "US", "area", "approximate"),
  "photo-014": place("Alpine lake, California", "Sierra Nevada, California, USA", "California", "US", "region", "user"),
  "photo-015": place("Alpine lake, California", "Sierra Nevada, California, USA", "California", "US", "region", "user"),
  "photo-016": place("Costa Rican rainforest (likely)", "Costa Rica", "Costa Rica", "CR", "region", "approximate"),
  "photo-017": place("Costa Rica (likely)", "Costa Rica", "Costa Rica", "CR", "region", "approximate"),
  "photo-018": place("Diamond Head Lighthouse, Oʻahu (likely)", "Diamond Head Lighthouse, Honolulu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "area", "approximate"),
  "photo-019": place("Windward Oʻahu, Hawaiʻi (likely)", "Windward Oahu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "region", "approximate"),
  "photo-020": place("Windward Oʻahu, Hawaiʻi (likely)", "Windward Oahu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "region", "approximate"),
  "photo-021": place("Koʻolau Mountains, Oʻahu (likely)", "Koolau Range, Oahu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "region", "approximate"),
  "photo-022": place("Oʻahu, Hawaiʻi (likely)", "Oahu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "region", "approximate"),
  "photo-023": place("Kualoa Regional Park, Oʻahu", "Kualoa Regional Park, Oahu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "landmark", "landmark"),
  "photo-024": place("Mokoliʻi, Kualoa Beach, Oʻahu", "Mokolii, Kualoa Regional Park, Oahu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "landmark", "landmark"),
  "photo-025": place("Ala Moana Beach Park, Honolulu", "Ala Moana Beach Park, Honolulu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "landmark", "landmark"),
  "photo-026": place("Oʻahu coastline (likely)", "Oahu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "region", "approximate"),
  "photo-027": place("Oʻahu waterfront (likely)", "Honolulu, Oahu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "region", "approximate"),
  "photo-028": place("Hidden beach near Kualoa Regional Park, Oʻahu", "Kualoa Regional Park, Oahu, Hawaii, USA", "Oʻahu, Hawaiʻi", "US", "area", "user"),
  "photo-029": place("Moʻorea, French Polynesia", "Moorea, French Polynesia", "Society Islands", "PF", "region", "user"),
  "photo-030": place("Moʻorea, French Polynesia", "Moorea, French Polynesia", "Society Islands", "PF", "region", "user"),
  "photo-031": place("Moʻorea, French Polynesia", "Moorea, French Polynesia", "Society Islands", "PF", "region", "user"),
  "photo-032": place("Moʻorea, French Polynesia", "Moorea, French Polynesia", "Society Islands", "PF", "region", "user"),
  "photo-033": place("Snowy granite hills, California", "Sierra Nevada, California, USA", "California", "US", "region", "user"),
  "photo-034": place("California coastal battery (possibly Marin Headlands)", "Marin Headlands, California, USA", "California", "US", "area", "approximate"),
  "photo-035": place("California coast (possibly Pacifica)", "Pacifica, California, USA", "California", "US", "area", "approximate"),
  "photo-036": place("California coast (possibly Pacifica)", "Pacifica, California, USA", "California", "US", "area", "approximate"),
  "photo-037": place("California coastal trail (possibly Pacifica)", "Pacifica, California, USA", "California", "US", "area", "approximate"),
  "photo-038": place("Northern California coast", "San Mateo County Coast, California, USA", "California", "US", "region", "user"),
  "photo-039": place("Hidden Garden Steps, San Francisco", "Hidden Garden Steps, San Francisco, California, USA", "California", "US", "landmark", "landmark"),
  "photo-040": place("California urban creek / spillway", "San Francisco Bay Area, California, USA", "California", "US", "region", "user"),
  "photo-041": place("California coast", "California Coast, USA", "California", "US", "region", "user"),
  "photo-042": place("California coastal overlook (possibly Pacifica)", "Pacifica, California, USA", "California", "US", "area", "approximate"),
  "photo-043": place("California coastal overlook (possibly Pacifica)", "Pacifica, California, USA", "California", "US", "area", "approximate"),
  "photo-044": place("California coastal overlook (possibly Pacifica)", "Pacifica, California, USA", "California", "US", "area", "approximate"),
  "photo-045": place("California rocky beach (location unconfirmed)", "San Mateo County Coast, California, USA", "California", "US", "region", "approximate"),
  "photo-046": place("California rocky beach (location unconfirmed)", "San Mateo County Coast, California, USA", "California", "US", "region", "approximate"),
  "photo-047": place("California rocky beach (location unconfirmed)", "San Mateo County Coast, California, USA", "California", "US", "region", "approximate"),
  "photo-048": place("Northern California grazing hills", "Northern California, USA", "California", "US", "region", "approximate"),
  "photo-049": place("Sierra Nevada alpine meadow (likely)", "Sierra Nevada, California, USA", "California", "US", "region", "approximate"),
};

export function photoMapUrl(location: Pick<PhotoPlace, "mapSearch">): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapSearch)}`;
}
