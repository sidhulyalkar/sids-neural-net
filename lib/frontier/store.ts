'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyBehaviorEvent,
  createInitialBehaviorModel,
  endBehaviorSession,
  recordLayoutUse,
  recordViewUse,
  startBehaviorSession,
} from './behavior';
import { applyReactionToProfile } from './scoring';
import { createInitialProfile, DEFAULT_COLLECTIONS } from './config';
import type {
  FrontierBehaviorModel,
  FrontierCollection,
  FrontierGameState,
  FrontierHistoryEntry,
  FrontierItem,
  FrontierLayoutMode,
  FrontierPersistedState,
  FrontierProfile,
  FrontierReaction,
  FrontierView,
} from './types';

const STORAGE_KEY = 'frontier-personal-radar-v1';
const STATE_VERSION = 2;

function localDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayDifference(a: string, b: string): number {
  const left = new Date(`${a}T12:00:00`);
  const right = new Date(`${b}T12:00:00`);
  return Math.round((right.getTime() - left.getTime()) / 86_400_000);
}

function updateStreak(game: FrontierGameState, now = new Date()): FrontierGameState {
  const today = localDayKey(now);
  if (game.lastActiveDay === today) return game;
  if (!game.lastActiveDay) return { ...game, streak: 1, lastActiveDay: today };
  const gap = dayDifference(game.lastActiveDay, today);
  return { ...game, streak: gap === 1 ? game.streak + 1 : 1, lastActiveDay: today };
}

function xpForReaction(reaction: FrontierReaction): number {
  switch (reaction) {
    case 'up': return 6;
    case 'down': return 2;
    case 'love': return 9;
    case 'important': return 8;
    case 'surprise': return 8;
    case 'useful': return 7;
    case 'known': return 4;
    case 'read': return 5;
    case 'later': return 3;
    case 'meh': return 2;
    case 'hide': return 1;
  }
}

function behaviorKindForReaction(reaction: FrontierReaction): 'positive' | 'negative' | undefined {
  if (['up', 'love', 'important', 'surprise', 'useful'].includes(reaction)) return 'positive';
  if (['down', 'meh', 'hide'].includes(reaction)) return 'negative';
  return undefined;
}

export type FrontierStore = FrontierPersistedState & {
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  beginSession: () => void;
  endSession: () => void;
  recordView: (view: FrontierView) => void;
  recordLayout: (layout: FrontierLayoutMode) => void;
  markSeen: (item: FrontierItem, resurfaced?: boolean) => void;
  recordDwell: (item: FrontierItem, dwellMs: number) => void;
  recordExpand: (item: FrontierItem) => void;
  recordOpen: (item: FrontierItem) => void;
  react: (item: FrontierItem, reaction: FrontierReaction) => void;
  toggleSave: (item: FrontierItem) => void;
  createCollection: (name: string, description?: string) => string;
  toggleCollectionItem: (collectionId: string, item: FrontierItem) => void;
  removeCollection: (collectionId: string) => void;
  awardQuest: (questId: string, xp: number, dayKey?: string) => void;
  setImplicitLearning: (enabled: boolean) => void;
  resetBehavior: () => void;
  importBackup: (payload: unknown) => boolean;
  resetFrontier: () => void;
};

function initialGame(): FrontierGameState {
  return { xp: 0, streak: 0, completedQuestDays: {} };
}

function initialState(): FrontierPersistedState {
  return {
    version: 2,
    profile: createInitialProfile(),
    behavior: createInitialBehaviorModel(),
    saved: {},
    collections: DEFAULT_COLLECTIONS.map((collection) => ({ ...collection, itemIds: [] })),
    history: {},
    game: initialGame(),
  };
}

function historyEntry(item: FrontierItem, previous?: FrontierHistoryEntry): FrontierHistoryEntry {
  const now = new Date().toISOString();
  return previous
    ? { ...previous, item, lastSeenAt: now, impressions: previous.impressions + 1 }
    : { item, firstSeenAt: now, lastSeenAt: now, impressions: 1, dwellMs: 0, resurfacedCount: 0, rewarded: false };
}

function migrateState(payload: unknown): FrontierPersistedState | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as Record<string, unknown>;
  if (!candidate.profile || !candidate.saved || !candidate.history || !candidate.collections || !candidate.game) return null;
  const history = candidate.history as FrontierPersistedState['history'];
  for (const entry of Object.values(history)) if (entry.dwellMs === undefined) entry.dwellMs = 0;
  return {
    version: 2,
    profile: candidate.profile as FrontierProfile,
    behavior: (candidate.behavior as FrontierBehaviorModel | undefined) ?? createInitialBehaviorModel(),
    saved: candidate.saved as FrontierPersistedState['saved'],
    collections: candidate.collections as FrontierCollection[],
    history,
    game: candidate.game as FrontierGameState,
  };
}

export const useFrontierStore = create<FrontierStore>()(
  persist(
    (set, get) => ({
      ...initialState(),
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      beginSession: () => set({ behavior: startBehaviorSession(get().behavior) }),
      endSession: () => set({ behavior: endBehaviorSession(get().behavior) }),
      recordView: (view) => set({ behavior: recordViewUse(get().behavior, view) }),
      recordLayout: (layout) => set({ behavior: recordLayoutUse(get().behavior, layout) }),

      markSeen: (item, resurfaced = false) => {
        const current = get();
        const previous = current.history[item.id];
        const next = historyEntry(item, previous);
        if (resurfaced && previous) next.resurfacedCount = previous.resurfacedCount + 1;
        set({
          history: { ...current.history, [item.id]: next },
          behavior: applyBehaviorEvent(current.behavior, item, { kind: 'impression' }),
        });
      },

      recordDwell: (item, dwellMs) => {
        const bounded = Math.max(0, Math.min(dwellMs, 120_000));
        if (bounded < 1_000) return;
        const current = get();
        const previous = current.history[item.id] ?? historyEntry(item);
        set({
          history: {
            ...current.history,
            [item.id]: { ...previous, item, lastSeenAt: new Date().toISOString(), dwellMs: (previous.dwellMs ?? 0) + bounded },
          },
          behavior: applyBehaviorEvent(current.behavior, item, { kind: 'dwell', dwellMs: bounded }),
        });
      },

      recordExpand: (item) => set({ behavior: applyBehaviorEvent(get().behavior, item, { kind: 'expand' }) }),

      recordOpen: (item) => {
        const current = get();
        const now = new Date().toISOString();
        const previous = current.history[item.id] ?? historyEntry(item);
        set({
          history: { ...current.history, [item.id]: { ...previous, item, openedAt: now, lastSeenAt: now } },
          behavior: applyBehaviorEvent(current.behavior, item, { kind: 'open' }),
          game: updateStreak(current.game),
        });
      },

      react: (item, reaction) => {
        const current = get();
        const now = new Date().toISOString();
        const previous = current.history[item.id] ?? historyEntry(item);
        const firstReward = !previous.rewarded;
        const nextProfile = applyReactionToProfile(current.profile, item, reaction);
        const behaviorKind = behaviorKindForReaction(reaction);
        const nextBehavior = behaviorKind ? applyBehaviorEvent(current.behavior, item, { kind: behaviorKind }) : current.behavior;
        const game = updateStreak(current.game);
        set({
          profile: nextProfile,
          behavior: nextBehavior,
          history: {
            ...current.history,
            [item.id]: { ...previous, item, reaction, reactedAt: now, lastSeenAt: now, rewarded: true },
          },
          game: { ...game, xp: game.xp + (firstReward ? xpForReaction(reaction) : 0) },
        });
      },

      toggleSave: (item) => {
        const current = get();
        const saved = { ...current.saved };
        const collections = current.collections.map((collection) => ({ ...collection, itemIds: [...collection.itemIds] }));
        const inbox = collections.find((collection) => collection.id === 'inbox');
        const wasSaved = Boolean(saved[item.id]);
        if (wasSaved) {
          delete saved[item.id];
          for (const collection of collections) collection.itemIds = collection.itemIds.filter((id) => id !== item.id);
        } else {
          saved[item.id] = item;
          if (inbox && !inbox.itemIds.includes(item.id)) inbox.itemIds.push(item.id);
        }
        set({ saved, collections, behavior: wasSaved ? current.behavior : applyBehaviorEvent(current.behavior, item, { kind: 'save' }) });
      },

      createCollection: (name, description) => {
        const trimmed = name.trim().slice(0, 42);
        if (!trimmed) return '';
        const id = `collection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const collection: FrontierCollection = {
          id,
          name: trimmed,
          description: description?.trim().slice(0, 160),
          itemIds: [],
          createdAt: new Date().toISOString(),
        };
        set({ collections: [...get().collections, collection] });
        return id;
      },

      toggleCollectionItem: (collectionId, item) => {
        const current = get();
        const saved = { ...current.saved, [item.id]: item };
        const collections = current.collections.map((collection) => {
          if (collection.id !== collectionId) return collection;
          const exists = collection.itemIds.includes(item.id);
          return { ...collection, itemIds: exists ? collection.itemIds.filter((id) => id !== item.id) : [...collection.itemIds, item.id] };
        });
        set({ saved, collections });
      },

      removeCollection: (collectionId) => {
        if (collectionId === 'inbox') return;
        set({ collections: get().collections.filter((collection) => collection.id !== collectionId) });
      },

      awardQuest: (questId, xp, dayKey = localDayKey()) => {
        const current = get();
        const completed = current.game.completedQuestDays[dayKey] ?? [];
        if (completed.includes(questId)) return;
        set({
          game: {
            ...updateStreak(current.game),
            xp: current.game.xp + xp,
            completedQuestDays: { ...current.game.completedQuestDays, [dayKey]: [...completed, questId] },
          },
        });
      },

      setImplicitLearning: (enabled) => {
        const current = get().behavior;
        if (current.implicitLearning === enabled) return;
        if (enabled) {
          set({ behavior: startBehaviorSession({ ...current, implicitLearning: true, sessionStartedAt: undefined }) });
        } else {
          const settled = endBehaviorSession(current);
          set({ behavior: { ...settled, implicitLearning: false, sessionStartedAt: undefined } });
        }
      },

      resetBehavior: () => {
        const enabled = get().behavior.implicitLearning;
        const fresh = { ...createInitialBehaviorModel(), implicitLearning: enabled };
        set({ behavior: enabled ? startBehaviorSession(fresh) : fresh });
      },

      importBackup: (payload) => {
        const parsed = migrateState(payload);
        if (!parsed) return false;
        set({ ...parsed, hydrated: true });
        return true;
      },

      resetFrontier: () => set({ ...initialState(), hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      version: STATE_VERSION,
      migrate: (persistedState) => migrateState(persistedState) ?? initialState(),
      partialize: (state) => ({
        version: state.version,
        profile: state.profile,
        behavior: state.behavior,
        saved: state.saved,
        collections: state.collections,
        history: state.history,
        game: state.game,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    }
  )
);

export function frontierBackup(state: FrontierStore): FrontierPersistedState {
  return {
    version: 2,
    profile: state.profile,
    behavior: state.behavior,
    saved: state.saved,
    collections: state.collections,
    history: state.history,
    game: state.game,
  };
}
