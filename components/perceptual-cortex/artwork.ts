import type { PerceptualWorldState, SignalSourceId } from './signalTypes';
import { visualThemes, type VisualThemeId } from './visualThemes';
export type ArtworkInterpretation = { title: string; theme: string; themeConcept: string; dominantInfluence: string; temporalCharacter: string; spatialCharacter: string; excitationProfile: string; activeModalities: SignalSourceId[] };
const pick = <T,>(items: readonly T[], seed: number, salt: number) => items[Math.abs((seed * 1664525 + salt * 1013904223) | 0) % items.length];
export function interpretArtwork(seed: number, world: PerceptualWorldState, themeId: VisualThemeId = 'liminality'): ArtworkInterpretation {
  const dominantInfluence = world.bilateralStrength > .45 ? 'bilateral hand motion' : world.lowBand + world.midBand + world.highBand > .45 ? 'microphone rhythm' : world.facialActivity > .35 ? 'facial activity dynamics' : world.pointerSpeed > .25 ? 'pointer motion' : 'ambient coherence';
  const temporalCharacter = world.coherence > .68 ? 'rhythmic' : world.entropy > .55 ? 'volatile' : 'meditative';
  const spatialCharacter = world.handSeparation > .5 || world.zoom < .85 ? 'expansive' : world.symmetry > .7 ? 'bilateral' : 'concentrated';
  const excitationProfile = world.excitation > .7 ? 'high and sustained' : world.plasticity > .25 ? 'gradually increasing' : 'quietly responsive';
  const adjectives = ['Quiet', 'Oscillatory', 'Parallax', 'Interrupted', 'Bilateral', 'Resonant'] as const;
  const forms = ['Bloom', 'Arbor', 'Field', 'Synapse', 'Branch Memory', 'Garden'] as const;
  const suffix = world.plasticity > .35 ? ` No. ${1 + seed % 24}` : '';
  const theme = visualThemes[themeId];
  return { title: `${pick(adjectives, seed, 3)} ${pick(forms, seed, 11)}${suffix}`, theme: theme.label, themeConcept: theme.concept, dominantInfluence, temporalCharacter, spatialCharacter, excitationProfile, activeModalities: [...world.activeModalities] };
}
