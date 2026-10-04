/** Regional reference palette; the compact coast-to-alpine world is an imagined composite. */
export const COASTAL_FLORA = [
  { common: 'Coast redwood', scientific: 'Sequoia sempervirens', habitat: 'Sheltered inland grove', source: 'https://www.nps.gov/redw/learn/nature/plants.htm' },
  { common: 'Coyote brush', scientific: 'Baccharis pilularis', habitat: 'Exposed coastal scrub', source: 'https://www.nps.gov/pore/learn/nature/wildlandfire_fireecology_vegtypes_coastalscrub.htm' },
  { common: 'California sagebrush', scientific: 'Artemisia californica', habitat: 'Dry coastal slopes', source: 'https://www.nps.gov/samo/learn/nature/coastalsagescrub.htm' },
  { common: 'California poppy', scientific: 'Eschscholzia californica', habitat: 'Sunny open meadow', source: 'https://www.nps.gov/muwo/learn/nature/plants.htm' },
] as const;
// Photo references: archive 040 (daylight topcoat), 042/043 (white face/chest).
// Sid's direct color description overrides sunset/shade casts. These are art-directed
// sRGB material colors, not calibrated fur reflectance or an exact coat measurement.
export const SHASTA_COAT = { white: '#f4eee1', topcoat: '#c4a675', gold: '#dbc39a', tailBase: '#ab7352', nose: '#302923' } as const;
