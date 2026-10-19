/**
 * The Visual Cortex's one-line place captions and their Maps search targets.
 * Keep these searchable labels broad when a precise location isn't known.
 * Photo IDs remain stable, so these records can also power a future map.
 */
export type PhotoPlace = {
  label: string;
  mapSearch: string;
};

export const photoPlaces: Record<string, PhotoPlace> = {
  "photo-001": { label: "Crater Lake, Oregon", mapSearch: "Crater Lake National Park, Oregon, USA" },
  "photo-002": { label: "Western U.S. mountains", mapSearch: "Western United States" },
  "photo-003": { label: "Death Valley, California", mapSearch: "Death Valley National Park, California, USA" },
  "photo-004": { label: "Half Dome, Yosemite", mapSearch: "Half Dome, Yosemite National Park, California, USA" },
  "photo-005": { label: "Moraine Lake, Banff", mapSearch: "Moraine Lake, Banff National Park, Alberta, Canada" },
  "photo-006": { label: "Glacier National Park, Montana", mapSearch: "Glacier National Park, Montana, USA" },
  "photo-007": { label: "Delicate Arch, Utah", mapSearch: "Delicate Arch, Arches National Park, Utah, USA" },
  "photo-008": { label: "Alaska", mapSearch: "Alaska, USA" },
  "photo-009": { label: "Matanuska Glacier, Alaska", mapSearch: "Matanuska Glacier, Alaska, USA" },
  "photo-010": { label: "Estes Park, Colorado", mapSearch: "Estes Park, Colorado, USA" },
  "photo-011": { label: "Estes Park, Colorado", mapSearch: "Estes Park, Colorado, USA" },
  "photo-012": { label: "Rocky Mountain National Park", mapSearch: "Rocky Mountain National Park, Colorado, USA" },
  "photo-013": { label: "Rocky Mountain National Park", mapSearch: "Rocky Mountain National Park, Colorado, USA" },
  "photo-014": { label: "California alpine lake", mapSearch: "California, USA" },
  "photo-015": { label: "California alpine lake", mapSearch: "California, USA" },
  "photo-016": { label: "Costa Rica", mapSearch: "Costa Rica" },
  "photo-017": { label: "Costa Rica", mapSearch: "Costa Rica" },
  "photo-018": { label: "Diamond Head, Oʻahu", mapSearch: "Diamond Head Lighthouse, Honolulu, Hawaii, USA" },
  "photo-019": { label: "Windward Oʻahu", mapSearch: "Windward Oahu, Hawaii, USA" },
  "photo-020": { label: "Windward Oʻahu", mapSearch: "Windward Oahu, Hawaii, USA" },
  "photo-021": { label: "Koʻolau Mountains, Oʻahu", mapSearch: "Koolau Range, Oahu, Hawaii, USA" },
  "photo-022": { label: "Oʻahu, Hawaiʻi", mapSearch: "Oahu, Hawaii, USA" },
  "photo-023": { label: "Kualoa, Oʻahu", mapSearch: "Kualoa Regional Park, Oahu, Hawaii, USA" },
  "photo-024": { label: "Kualoa Beach, Oʻahu", mapSearch: "Mokolii, Kualoa Regional Park, Oahu, Hawaii, USA" },
  "photo-025": { label: "Honolulu, Oʻahu", mapSearch: "Ala Moana Beach Park, Honolulu, Hawaii, USA" },
  "photo-026": { label: "Oʻahu, Hawaiʻi", mapSearch: "Oahu, Hawaii, USA" },
  "photo-027": { label: "Oʻahu, Hawaiʻi", mapSearch: "Oahu, Hawaii, USA" },
  "photo-028": { label: "Hidden Beach, Kualoa", mapSearch: "Kualoa Regional Park, Oahu, Hawaii, USA" },
  "photo-029": { label: "Moʻorea, French Polynesia", mapSearch: "Moorea, French Polynesia" },
  "photo-030": { label: "Bora Bora, French Polynesia", mapSearch: "Bora Bora, French Polynesia" },
  "photo-031": { label: "Bora Bora, French Polynesia", mapSearch: "Bora Bora, French Polynesia" },
  "photo-032": { label: "Bora Bora, French Polynesia", mapSearch: "Bora Bora, French Polynesia" },
  "photo-033": { label: "California", mapSearch: "California, USA" },
  "photo-034": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-035": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-036": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-037": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-038": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-039": { label: "Hidden Garden Steps, San Francisco", mapSearch: "Hidden Garden Steps, San Francisco, California, USA" },
  "photo-040": { label: "California", mapSearch: "California, USA" },
  "photo-041": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-042": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-043": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-044": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-045": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-046": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-047": { label: "California coast", mapSearch: "California Coast, USA" },
  "photo-048": { label: "Northern California", mapSearch: "Northern California, USA" },
  "photo-049": { label: "California mountains", mapSearch: "California, USA" },
};

export function photoMapUrl(location: Pick<PhotoPlace, "mapSearch">): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapSearch)}`;
}
