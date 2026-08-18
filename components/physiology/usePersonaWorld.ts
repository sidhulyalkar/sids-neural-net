'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PERSONA_WORLD_STORAGE_KEY,
  createDefaultWorldProfile,
  incrementVisit,
  loadWorldProfile,
  recordAdventure,
  setTraitValue,
  suggestActivity,
  suggestBiome,
  type PersonaActivity,
  type PersonaBiome,
  type PersonaTrait,
  type PersonaWorldProfile,
} from '@/lib/physiology/world';
import type { PersonaMoodSelfReport } from '@/lib/physiology/schema';

type PersonaWorldState = {
  profile: PersonaWorldProfile;
  biome: PersonaBiome;
  activity: PersonaActivity;
  hydrated: boolean;
  chooseBiome: (biome: PersonaBiome, mood: PersonaMoodSelfReport) => void;
  chooseActivity: (activity: PersonaActivity, mood: PersonaMoodSelfReport) => void;
  wander: (mood: PersonaMoodSelfReport) => void;
  setTrait: (trait: PersonaTrait, value: number) => void;
  reset: (mood: PersonaMoodSelfReport) => void;
};

export function usePersonaWorld(initialMood: PersonaMoodSelfReport): PersonaWorldState {
  const [profile, setProfile] = useState<PersonaWorldProfile>(() => createDefaultWorldProfile());
  const [biome, setBiome] = useState<PersonaBiome>('meadow');
  const [activity, setActivity] = useState<PersonaActivity>('explore');
  const [hydrated, setHydrated] = useState(false);
  const wanderIndex = useRef(0);
  const initialMoodRef = useRef(initialMood);

  useEffect(() => {
    const saved = loadWorldProfile(window.localStorage.getItem(PERSONA_WORLD_STORAGE_KEY));
    const visited = incrementVisit(saved);
    const mood = initialMoodRef.current;
    const recommendedBiome = suggestBiome(visited, mood);
    setProfile(visited);
    setBiome(recommendedBiome);
    setActivity(suggestActivity(visited, recommendedBiome, mood));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(PERSONA_WORLD_STORAGE_KEY, JSON.stringify(profile));
  }, [hydrated, profile]);

  const commitAdventure = useCallback(
    (nextBiome: PersonaBiome, nextActivity: PersonaActivity, mood: PersonaMoodSelfReport) => {
      setProfile((current) => recordAdventure(current, nextBiome, nextActivity, mood));
    },
    []
  );

  const chooseBiome = useCallback(
    (nextBiome: PersonaBiome, mood: PersonaMoodSelfReport) => {
      setBiome(nextBiome);
      const nextActivity = suggestActivity(profile, nextBiome, mood);
      setActivity(nextActivity);
      commitAdventure(nextBiome, nextActivity, mood);
    },
    [commitAdventure, profile]
  );

  const chooseActivity = useCallback(
    (nextActivity: PersonaActivity, mood: PersonaMoodSelfReport) => {
      setActivity(nextActivity);
      commitAdventure(biome, nextActivity, mood);
    },
    [biome, commitAdventure]
  );

  const wander = useCallback(
    (mood: PersonaMoodSelfReport) => {
      wanderIndex.current += 1;
      const nextBiome = suggestBiome(profile, mood, wanderIndex.current);
      const nextActivity = suggestActivity(profile, nextBiome, mood, wanderIndex.current);
      setBiome(nextBiome);
      setActivity(nextActivity);
      commitAdventure(nextBiome, nextActivity, mood);
    },
    [commitAdventure, profile]
  );

  const setTrait = useCallback((trait: PersonaTrait, value: number) => {
    setProfile((current) => setTraitValue(current, trait, value));
  }, []);

  const reset = useCallback((mood: PersonaMoodSelfReport) => {
    const fresh = createDefaultWorldProfile();
    const nextBiome = suggestBiome(fresh, mood);
    setProfile(fresh);
    setBiome(nextBiome);
    setActivity(suggestActivity(fresh, nextBiome, mood));
    wanderIndex.current = 0;
    window.localStorage.removeItem(PERSONA_WORLD_STORAGE_KEY);
  }, []);

  return useMemo(
    () => ({
      profile,
      biome,
      activity,
      hydrated,
      chooseBiome,
      chooseActivity,
      wander,
      setTrait,
      reset,
    }),
    [activity, biome, chooseActivity, chooseBiome, hydrated, profile, reset, setTrait, wander]
  );
}
