import type { SignalSourceId } from './signalTypes';

export type VisualThemeId = 'homeostasis' | 'plasticity' | 'synchrony' | 'criticality' | 'liminality';
export type VisualTheme = {
  id: VisualThemeId; label: string; concept: string; description: string;
  background: string; fog: string; soma: string; membrane: string;
  branchPrimary: string; branchSecondary: string; pulse: string;
  sources: Record<SignalSourceId, string>;
};

export const visualThemes: Record<VisualThemeId, VisualTheme> = {
  homeostasis: { id: 'homeostasis', label: 'Homeostasis', concept: 'dynamic balance', description: 'Cool signals settle toward a resilient equilibrium.', background: '#02070a', fog: '#02070a', soma: '#174a52', membrane: '#70f0dc', branchPrimary: '#78d9dc', branchSecondary: '#7da4ff', pulse: '#e7fff9', sources: { pointer: '#8ff7e4', touch: '#72d6ff', keyboard: '#f1dda0', audio: '#78a7ff', hand: '#65f0b9', face: '#b59cff', synthetic: '#8aa2ae' } },
  plasticity: { id: 'plasticity', label: 'Plasticity', concept: 'experience-dependent change', description: 'Warm traces accumulate where the organism has been activated.', background: '#080306', fog: '#080306', soma: '#6b273f', membrane: '#ff7aa2', branchPrimary: '#f39a80', branchSecondary: '#bd77ff', pulse: '#ffe5a8', sources: { pointer: '#ff9b73', touch: '#ff6e9f', keyboard: '#ffe07d', audio: '#b879ff', hand: '#ff795d', face: '#ef77c8', synthetic: '#9c667b' } },
  synchrony: { id: 'synchrony', label: 'Synchrony', concept: 'phase alignment', description: 'Distinct modalities converge into coherent oscillatory populations.', background: '#02040b', fog: '#02040b', soma: '#263a78', membrane: '#7aa9ff', branchPrimary: '#72ddff', branchSecondary: '#ad8bff', pulse: '#fff7cf', sources: { pointer: '#68e5ff', touch: '#5bbdff', keyboard: '#ffe279', audio: '#8f8cff', hand: '#62f0d0', face: '#d28cff', synthetic: '#748db8' } },
  criticality: { id: 'criticality', label: 'Criticality', concept: 'order at the edge of chaos', description: 'High-contrast signals hover between propagation and collapse.', background: '#080604', fog: '#080604', soma: '#5c3215', membrane: '#ffb347', branchPrimary: '#ffcd6b', branchSecondary: '#ff5d5d', pulse: '#ffffff', sources: { pointer: '#fff06a', touch: '#ffb23e', keyboard: '#ffffff', audio: '#ff5f65', hand: '#ff8a3d', face: '#e66cff', synthetic: '#a88c66' } },
  liminality: { id: 'liminality', label: 'Liminality', concept: 'perception between states', description: 'Violet and spectral fields blur the boundary between observer and organism.', background: '#040207', fog: '#040207', soma: '#452358', membrane: '#dd77ff', branchPrimary: '#9b8cff', branchSecondary: '#67e4e8', pulse: '#ffd9fa', sources: { pointer: '#8cecff', touch: '#68b8ff', keyboard: '#ffbde8', audio: '#987cff', hand: '#71e4bd', face: '#ee79dc', synthetic: '#8e789e' } },
};

export const visualThemeList = Object.values(visualThemes);

