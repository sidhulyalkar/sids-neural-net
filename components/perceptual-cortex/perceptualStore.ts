import { create } from 'zustand';
import { createWorldState, type PerceptualWorldState } from './signalTypes';

type Phase = 'arrival' | 'performing' | 'crystallized';
type Store = {
  phase: Phase;
  seed: number;
  startedAt: number | null;
  microscopeOpen: boolean;
  reducedMotion: boolean;
  worldSnapshot: PerceptualWorldState;
  start: () => void;
  crystallize: () => void;
  resume: () => void;
  reset: (preserveSeed?: boolean) => void;
  toggleMicroscope: () => void;
  setReducedMotion: (value: boolean) => void;
};

const randomSeed = () => Math.floor(Math.random() * 2_147_483_647);

export const usePerceptualStore = create<Store>((set) => ({
  phase: 'arrival', seed: randomSeed(), startedAt: null, microscopeOpen: false,
  reducedMotion: false, worldSnapshot: createWorldState(),
  start: () => set({ phase: 'performing', startedAt: performance.now() }),
  crystallize: () => set({ phase: 'crystallized' }),
  resume: () => set({ phase: 'performing' }),
  reset: (preserveSeed = false) => set((state) => ({
    phase: 'performing', startedAt: performance.now(),
    seed: preserveSeed ? state.seed : randomSeed(), worldSnapshot: createWorldState(),
  })),
  toggleMicroscope: () => set((state) => ({ microscopeOpen: !state.microscopeOpen })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));

export const worldSnapshot = () => usePerceptualStore.getState().worldSnapshot;

