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
  'professional-work': ATLAS_COLORS.blue,
  projects: ATLAS_COLORS.cyan,
  publications: ATLAS_COLORS.violet,
  'research-ideas': ATLAS_COLORS.green,
  'personal-interests': ATLAS_COLORS.amber,
  photography: ATLAS_COLORS.rose,
  contact: '#8fb8ff',
};

export const ATLAS_LAYOUT = {
  overviewRadius: 7.2,
  leafRadius: 2.65,
  zSpread: 1.8,
  cameraLerp: 0.065,
} as const;
