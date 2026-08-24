export const CURATED_FRACTAL_THEME_IDS = [
  'radial',
  'coral',
  'fan',
  'apical',
  'tectonic',
  'spiraloid',
  'halo',
  'pixel-ghost',
  'echidna',
  'echo-nest',
] as const;

export type CuratedFractalThemeId = (typeof CURATED_FRACTAL_THEME_IDS)[number];

export type PersistedFractalTheme = {
  version: 1;
  morphology: CuratedFractalThemeId;
  seed: string;
  savedAt: number;
};

export const FRACTAL_THEME_STORAGE_KEY = 'sid:fractal-theme:v1';
export const FRACTAL_THEME_EVENT = 'sid-fractal-theme-change';
const MAX_LOCAL_THEME_AGE_MS = 12 * 60 * 60 * 1000;
const RETIRED_THEME_IDS = new Set<CuratedFractalThemeId>(['tectonic']);

export function isCuratedFractalThemeId(value: string | null | undefined): value is CuratedFractalThemeId {
  return Boolean(
    value &&
      CURATED_FRACTAL_THEME_IDS.includes(value as CuratedFractalThemeId) &&
      !RETIRED_THEME_IDS.has(value as CuratedFractalThemeId)
  );
}

export function stripForcedMorphology(seed: string): string {
  const match = /^force:[a-z-]+:(.*)$/.exec(seed);
  return (match?.[1] ?? seed).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 96) || 'echo';
}

export function createFractalTheme(
  morphology: CuratedFractalThemeId,
  seed: string,
  savedAt = Date.now()
): PersistedFractalTheme {
  return {
    version: 1,
    morphology,
    seed: stripForcedMorphology(seed),
    savedAt,
  };
}

export function serializeFractalTheme(theme: PersistedFractalTheme): string {
  return JSON.stringify(theme);
}

export function parseFractalTheme(serialized: string | null): PersistedFractalTheme | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Partial<PersistedFractalTheme>;
    if (
      value.version !== 1 ||
      !isCuratedFractalThemeId(value.morphology) ||
      typeof value.seed !== 'string' ||
      !value.seed ||
      typeof value.savedAt !== 'number' ||
      !Number.isFinite(value.savedAt)
    ) {
      return null;
    }
    return createFractalTheme(value.morphology, value.seed, value.savedAt);
  } catch {
    return null;
  }
}

export function rememberFractalTheme(morphology: string, seed: string): void {
  if (typeof window === 'undefined' || !isCuratedFractalThemeId(morphology)) return;
  const theme = createFractalTheme(morphology, seed);
  const serialized = serializeFractalTheme(theme);
  try {
    window.sessionStorage.setItem(FRACTAL_THEME_STORAGE_KEY, serialized);
    window.localStorage.setItem(FRACTAL_THEME_STORAGE_KEY, serialized);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts. The homepage remains fully functional.
  }
  window.dispatchEvent(new CustomEvent(FRACTAL_THEME_EVENT, { detail: theme }));
}

export function readFractalTheme(now = Date.now()): PersistedFractalTheme | null {
  if (typeof window === 'undefined') return null;

  const read = (storage: Storage): PersistedFractalTheme | null => {
    try {
      return parseFractalTheme(storage.getItem(FRACTAL_THEME_STORAGE_KEY));
    } catch {
      return null;
    }
  };

  const sessionTheme = read(window.sessionStorage);
  if (sessionTheme) return sessionTheme;

  const localTheme = read(window.localStorage);
  if (!localTheme) return null;
  if (now - localTheme.savedAt <= MAX_LOCAL_THEME_AGE_MS) return localTheme;

  try {
    window.localStorage.removeItem(FRACTAL_THEME_STORAGE_KEY);
  } catch {
    // Ignore cleanup failures in restricted browser contexts.
  }
  return null;
}
