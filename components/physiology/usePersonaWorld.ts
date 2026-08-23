'use client';

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { PersonaMoodSelfReport } from '@/lib/physiology/schema';
import {
  PERSONA_WORLD_STORAGE_KEY,
  createDefaultWorldProfile,
  incrementVisit,
  loadWorldProfile,
  setTraitValue,
  type PersonaActivity,
  type PersonaTrait,
  type PersonaWorldProfile,
} from '@/lib/physiology/world';
import {
  NATURE_ATLAS_STORAGE_KEY,
  createDefaultAtlasProgress,
  getNatureWorld,
  loadAtlasProgress,
  recordAtlasVisit,
  recordNatureAdventure,
  suggestNatureWorld,
  suggestWorldActivity,
  toggleAtlasFavorite,
  type NatureAtlasProgress,
} from '@/lib/physiology/natureWorldsExpanded';

type PersonaWorldSnapshot = {
  profile: PersonaWorldProfile;
  atlas: NatureAtlasProgress;
  worldId: string;
  activity: PersonaActivity;
  hydrated: boolean;
};

type PersonaWorldState = PersonaWorldSnapshot & {
  chooseWorld: (worldId: string, mood: PersonaMoodSelfReport) => void;
  toggleFavorite: (worldId: string) => void;
  chooseActivity: (activity: PersonaActivity, mood: PersonaMoodSelfReport) => void;
  wander: (mood: PersonaMoodSelfReport) => void;
  setTrait: (trait: PersonaTrait, value: number) => void;
  reset: (mood: PersonaMoodSelfReport) => void;
};

const DEFAULT_WORLD_ID = 'w001-misty-pine-grove';
const serverSnapshot: PersonaWorldSnapshot = {
  profile: createDefaultWorldProfile(),
  atlas: createDefaultAtlasProgress(),
  worldId: DEFAULT_WORLD_ID,
  activity: 'explore',
  hydrated: false,
};

let browserSnapshot: PersonaWorldSnapshot | null = null;
const listeners = new Set<() => void>();

function persist(snapshot: PersonaWorldSnapshot) {
  window.localStorage.setItem(PERSONA_WORLD_STORAGE_KEY, JSON.stringify(snapshot.profile));
  window.localStorage.setItem(NATURE_ATLAS_STORAGE_KEY, JSON.stringify(snapshot.atlas));
}

function initializeBrowserSnapshot(mood: PersonaMoodSelfReport): PersonaWorldSnapshot {
  if (browserSnapshot) return browserSnapshot;
  const savedProfile = loadWorldProfile(window.localStorage.getItem(PERSONA_WORLD_STORAGE_KEY));
  const savedAtlas = loadAtlasProgress(window.localStorage.getItem(NATURE_ATLAS_STORAGE_KEY));
  const profile = incrementVisit(savedProfile);
  const recommended = suggestNatureWorld(profile, savedAtlas, mood);
  browserSnapshot = {
    profile,
    atlas: recordAtlasVisit(savedAtlas, recommended.id),
    worldId: recommended.id,
    activity: suggestWorldActivity(profile, recommended, mood),
    hydrated: true,
  };
  persist(browserSnapshot);
  return browserSnapshot;
}

function publish(next: PersonaWorldSnapshot) {
  browserSnapshot = next;
  persist(next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePersonaWorld(initialMood: PersonaMoodSelfReport): PersonaWorldState {
  const initialMoodRef = useRef(initialMood);
  const wanderIndex = useRef(0);
  const snapshot = useSyncExternalStore(
    subscribe,
    () => initializeBrowserSnapshot(initialMoodRef.current),
    () => serverSnapshot,
  );

  const chooseWorld = useCallback((nextWorldId: string, mood: PersonaMoodSelfReport) => {
    const current = initializeBrowserSnapshot(initialMoodRef.current);
    const nextWorld = getNatureWorld(nextWorldId);
    const nextActivity = suggestWorldActivity(current.profile, nextWorld, mood);
    publish({
      ...current,
      worldId: nextWorld.id,
      activity: nextActivity,
      atlas: recordAtlasVisit(current.atlas, nextWorld.id),
      profile: recordNatureAdventure(current.profile, nextWorld, nextActivity, mood),
    });
  }, []);

  const toggleFavorite = useCallback((nextWorldId: string) => {
    const current = initializeBrowserSnapshot(initialMoodRef.current);
    publish({ ...current, atlas: toggleAtlasFavorite(current.atlas, nextWorldId) });
  }, []);

  const chooseActivity = useCallback((nextActivity: PersonaActivity, mood: PersonaMoodSelfReport) => {
    const current = initializeBrowserSnapshot(initialMoodRef.current);
    const world = getNatureWorld(current.worldId);
    if (!world.activities.includes(nextActivity)) return;
    publish({
      ...current,
      activity: nextActivity,
      profile: recordNatureAdventure(current.profile, world, nextActivity, mood),
    });
  }, []);

  const wander = useCallback((mood: PersonaMoodSelfReport) => {
    const current = initializeBrowserSnapshot(initialMoodRef.current);
    wanderIndex.current += 1;
    const nextWorld = suggestNatureWorld(current.profile, current.atlas, mood, wanderIndex.current);
    const nextActivity = suggestWorldActivity(current.profile, nextWorld, mood, wanderIndex.current);
    // Algorithm-selected discovery never trains the saved preference vector.
    publish({
      ...current,
      worldId: nextWorld.id,
      activity: nextActivity,
      atlas: recordAtlasVisit(current.atlas, nextWorld.id),
    });
  }, []);

  const setTrait = useCallback((trait: PersonaTrait, value: number) => {
    const current = initializeBrowserSnapshot(initialMoodRef.current);
    publish({ ...current, profile: setTraitValue(current.profile, trait, value) });
  }, []);

  const reset = useCallback((mood: PersonaMoodSelfReport) => {
    const profile = createDefaultWorldProfile();
    const atlas = createDefaultAtlasProgress();
    const nextWorld = suggestNatureWorld(profile, atlas, mood);
    wanderIndex.current = 0;
    window.localStorage.removeItem(PERSONA_WORLD_STORAGE_KEY);
    window.localStorage.removeItem(NATURE_ATLAS_STORAGE_KEY);
    publish({
      profile,
      atlas: recordAtlasVisit(atlas, nextWorld.id),
      worldId: nextWorld.id,
      activity: suggestWorldActivity(profile, nextWorld, mood),
      hydrated: true,
    });
  }, []);

  return useMemo(
    () => ({ ...snapshot, chooseWorld, toggleFavorite, chooseActivity, wander, setTrait, reset }),
    [chooseActivity, chooseWorld, reset, setTrait, snapshot, toggleFavorite, wander],
  );
}
