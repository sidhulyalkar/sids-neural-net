'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type PersonaWorldState = {
  profile: PersonaWorldProfile;
  atlas: NatureAtlasProgress;
  worldId: string;
  activity: PersonaActivity;
  hydrated: boolean;
  chooseWorld: (worldId: string, mood: PersonaMoodSelfReport) => void;
  toggleFavorite: (worldId: string) => void;
  chooseActivity: (activity: PersonaActivity, mood: PersonaMoodSelfReport) => void;
  wander: (mood: PersonaMoodSelfReport) => void;
  setTrait: (trait: PersonaTrait, value: number) => void;
  reset: (mood: PersonaMoodSelfReport) => void;
};

export function usePersonaWorld(initialMood: PersonaMoodSelfReport): PersonaWorldState {
  const [profile, setProfile] = useState<PersonaWorldProfile>(() => createDefaultWorldProfile());
  const [atlas, setAtlas] = useState<NatureAtlasProgress>(() => createDefaultAtlasProgress());
  const [worldId, setWorldId] = useState('w001-misty-pine-grove');
  const [activity, setActivity] = useState<PersonaActivity>('explore');
  const [hydrated, setHydrated] = useState(false);
  const wanderIndex = useRef(0);
  const initialMoodRef = useRef(initialMood);

  useEffect(() => {
    const savedProfile = loadWorldProfile(window.localStorage.getItem(PERSONA_WORLD_STORAGE_KEY));
    const savedAtlas = loadAtlasProgress(window.localStorage.getItem(NATURE_ATLAS_STORAGE_KEY));
    const visitedProfile = incrementVisit(savedProfile);
    const mood = initialMoodRef.current;
    const recommended = suggestNatureWorld(visitedProfile, savedAtlas, mood);

    setProfile(visitedProfile);
    setAtlas(recordAtlasVisit(savedAtlas, recommended.id));
    setWorldId(recommended.id);
    setActivity(suggestWorldActivity(visitedProfile, recommended, mood));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(PERSONA_WORLD_STORAGE_KEY, JSON.stringify(profile));
  }, [hydrated, profile]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(NATURE_ATLAS_STORAGE_KEY, JSON.stringify(atlas));
  }, [atlas, hydrated]);

  const chooseWorld = useCallback(
    (nextWorldId: string, mood: PersonaMoodSelfReport) => {
      const nextWorld = getNatureWorld(nextWorldId);
      const nextActivity = suggestWorldActivity(profile, nextWorld, mood);
      setWorldId(nextWorld.id);
      setActivity(nextActivity);
      setAtlas((current) => recordAtlasVisit(current, nextWorld.id));
      setProfile((current) => recordNatureAdventure(current, nextWorld, nextActivity, mood));
    },
    [profile]
  );

  const toggleFavorite = useCallback((nextWorldId: string) => {
    setAtlas((current) => toggleAtlasFavorite(current, nextWorldId));
  }, []);

  const chooseActivity = useCallback(
    (nextActivity: PersonaActivity, mood: PersonaMoodSelfReport) => {
      const world = getNatureWorld(worldId);
      if (!world.activities.includes(nextActivity)) return;
      setActivity(nextActivity);
      setProfile((current) => recordNatureAdventure(current, world, nextActivity, mood));
    },
    [worldId]
  );

  const wander = useCallback(
    (mood: PersonaMoodSelfReport) => {
      wanderIndex.current += 1;
      const nextWorld = suggestNatureWorld(profile, atlas, mood, wanderIndex.current);
      const nextActivity = suggestWorldActivity(profile, nextWorld, mood, wanderIndex.current);
      setWorldId(nextWorld.id);
      setActivity(nextActivity);
      setAtlas((current) => recordAtlasVisit(current, nextWorld.id));
      // Wandering is algorithm-selected discovery, so it never trains the saved
      // preference vector. Only explicit world/activity/favorite choices do.
    },
    [atlas, profile]
  );

  const setTrait = useCallback((trait: PersonaTrait, value: number) => {
    setProfile((current) => setTraitValue(current, trait, value));
  }, []);

  const reset = useCallback((mood: PersonaMoodSelfReport) => {
    const freshProfile = createDefaultWorldProfile();
    const freshAtlas = createDefaultAtlasProgress();
    const nextWorld = suggestNatureWorld(freshProfile, freshAtlas, mood);
    setProfile(freshProfile);
    setAtlas(recordAtlasVisit(freshAtlas, nextWorld.id));
    setWorldId(nextWorld.id);
    setActivity(suggestWorldActivity(freshProfile, nextWorld, mood));
    wanderIndex.current = 0;
    window.localStorage.removeItem(PERSONA_WORLD_STORAGE_KEY);
    window.localStorage.removeItem(NATURE_ATLAS_STORAGE_KEY);
  }, []);

  return useMemo(
    () => ({
      profile,
      atlas,
      worldId,
      activity,
      hydrated,
      chooseWorld,
      toggleFavorite,
      chooseActivity,
      wander,
      setTrait,
      reset,
    }),
    [activity, atlas, chooseActivity, chooseWorld, hydrated, profile, reset, setTrait, toggleFavorite, wander, worldId]
  );
}
