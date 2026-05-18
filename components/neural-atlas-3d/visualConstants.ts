export const ATLAS_COLORS = {
  background: '#02040c',
  cyan: '#66e3ff',
  blue: '#5b8cff',
  violet: '#a78bfa',
  green: '#66f0c2',
  amber: '#f7c66b',
  rose: '#ff7aa2',
  white: '#f8fbff',
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  about: ATLAS_COLORS.white,
  'professional-work': ATLAS_COLORS.green,
  projects: ATLAS_COLORS.cyan,
  publications: ATLAS_COLORS.violet,
  'research-ideas': ATLAS_COLORS.green,
  'personal-interests': ATLAS_COLORS.amber,
  photography: ATLAS_COLORS.rose,
  contact: '#8fb8ff',
};

export type SignalHarmony = {
  primary: string;
  secondary: string;
  core: string;
};

export const CATEGORY_SIGNAL_HARMONIES: Record<string, SignalHarmony> = {
  about: { primary: ATLAS_COLORS.white, secondary: ATLAS_COLORS.cyan, core: ATLAS_COLORS.white },
  publications: { primary: ATLAS_COLORS.violet, secondary: ATLAS_COLORS.white, core: ATLAS_COLORS.white },
  projects: { primary: ATLAS_COLORS.cyan, secondary: ATLAS_COLORS.blue, core: ATLAS_COLORS.white },
  'professional-work': { primary: ATLAS_COLORS.cyan, secondary: ATLAS_COLORS.green, core: ATLAS_COLORS.white },
  'research-ideas': { primary: ATLAS_COLORS.green, secondary: ATLAS_COLORS.violet, core: ATLAS_COLORS.white },
  photography: { primary: ATLAS_COLORS.rose, secondary: ATLAS_COLORS.amber, core: ATLAS_COLORS.white },
  'personal-interests': { primary: ATLAS_COLORS.amber, secondary: ATLAS_COLORS.rose, core: ATLAS_COLORS.white },
  contact: { primary: ATLAS_COLORS.blue, secondary: ATLAS_COLORS.white, core: ATLAS_COLORS.white },
};

export const ATLAS_LAYOUT = {
  overviewRadius: 7.2,
  leafRadius: 2.65,
  zSpread: 1.8,
  cameraLerp: 0.065,
} as const;

export function getCategorySignalHarmony(categoryId: string): SignalHarmony {
  return CATEGORY_SIGNAL_HARMONIES[categoryId] ?? CATEGORY_SIGNAL_HARMONIES.about;
}

export function seededUnit(seed: string) {
  let state = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 0x01000193);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
