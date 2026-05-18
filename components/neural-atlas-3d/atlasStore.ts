'use client';

import { create } from 'zustand';
import type { AtlasCameraMode, AtlasNavigationLevel, AtlasTransitionPhase } from './atlasTypes';
import { CAMERA_TARGETS } from './camera/cameraTargets';
import type { CameraTarget } from './atlasTypes';

const CHARGING_MS = 180;
const TRAVELING_MS = 1500;
const ARRIVING_MS = 280;

let transitionTimers: number[] = [];

type AtlasStore = {
  level: AtlasNavigationLevel;
  cameraMode: AtlasCameraMode;
  transitionPhase: AtlasTransitionPhase;
  activeCategoryId: string | null;
  activeNodeId: string | null;
  selectedLeafId: string | null;
  hoveredNodeId: string | null;
  signalPath: string[] | string | null;
  cameraTarget: CameraTarget;
  reducedMotion: boolean;
  setHoveredNode: (nodeId: string | null) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setCameraTarget: (cameraTarget: CameraTarget) => void;
  focusCategory: (categoryId: string) => void;
  focusLeaf: (nodeId: string, parentId?: string | null) => void;
  restoreNavigation: (categoryId: string | null, nodeId?: string | null) => void;
  openDetail: (nodeId: string) => void;
  closeDetail: () => void;
  returnToOverview: () => void;
  goBack: () => void;
};

function clearTransitionTimers() {
  for (const timer of transitionTimers) window.clearTimeout(timer);
  transitionTimers = [];
}

function isTransitioning(transitionPhase: AtlasTransitionPhase) {
  return transitionPhase === 'charging' || transitionPhase === 'traveling' || transitionPhase === 'arriving';
}

export const useAtlasStore = create<AtlasStore>((set, get) => ({
  level: 'root',
  cameraMode: 'overview',
  transitionPhase: 'idle',
  activeCategoryId: null,
  activeNodeId: null,
  selectedLeafId: null,
  hoveredNodeId: null,
  signalPath: null,
  cameraTarget: CAMERA_TARGETS.overview,
  reducedMotion: false,
  setHoveredNode: (hoveredNodeId) => set({ hoveredNodeId }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setCameraTarget: (cameraTarget) => set({ cameraTarget }),
  focusCategory: (categoryId) =>
    set((state) => {
      if (isTransitioning(state.transitionPhase)) return state;
      clearTransitionTimers();

      const signalPath = categoryId === 'about' ? ['about'] : ['about', categoryId];

      if (state.reducedMotion) {
        return {
          level: 'category',
          cameraMode: 'category',
          transitionPhase: 'category',
          activeCategoryId: categoryId,
          activeNodeId: categoryId,
          selectedLeafId: null,
          hoveredNodeId: null,
          signalPath: null,
          cameraTarget: CAMERA_TARGETS.category,
        };
      }

      transitionTimers = [
        window.setTimeout(() => set({ transitionPhase: 'traveling' }), CHARGING_MS),
        window.setTimeout(() => set({ transitionPhase: 'arriving' }), CHARGING_MS + TRAVELING_MS),
        window.setTimeout(
          () =>
            set({
              level: 'category',
              cameraMode: 'category',
              transitionPhase: 'category',
              signalPath: null,
            }),
          CHARGING_MS + TRAVELING_MS + ARRIVING_MS
        ),
      ];

      return {
        level: 'root',
        cameraMode: 'traveling',
        transitionPhase: 'charging',
        activeCategoryId: categoryId,
        activeNodeId: categoryId,
        selectedLeafId: null,
        hoveredNodeId: null,
        signalPath,
        cameraTarget: CAMERA_TARGETS.category,
      };
    }),
  focusLeaf: (nodeId, parentId) =>
    set((state) => {
      if (isTransitioning(state.transitionPhase)) return state;
      clearTransitionTimers();

      const categoryId = parentId ?? state.activeCategoryId;
      const signalPath = categoryId ? [categoryId, nodeId] : [nodeId];

      if (state.reducedMotion) {
        return {
          level: 'detail',
          cameraMode: 'detail',
          transitionPhase: 'detail',
          activeCategoryId: categoryId,
          activeNodeId: nodeId,
          selectedLeafId: nodeId,
          hoveredNodeId: null,
          signalPath: null,
          cameraTarget: CAMERA_TARGETS.leaf,
        };
      }

      transitionTimers = [
        window.setTimeout(() => set({ transitionPhase: 'traveling' }), CHARGING_MS),
        window.setTimeout(() => set({ transitionPhase: 'arriving' }), CHARGING_MS + TRAVELING_MS),
        window.setTimeout(
          () =>
            set({
              level: 'detail',
              cameraMode: 'detail',
              transitionPhase: 'detail',
              signalPath: null,
            }),
          CHARGING_MS + TRAVELING_MS + ARRIVING_MS
        ),
      ];

      return {
        level: categoryId ? 'category' : 'root',
        cameraMode: 'traveling',
        transitionPhase: 'charging',
        activeCategoryId: categoryId,
        activeNodeId: nodeId,
        selectedLeafId: nodeId,
        hoveredNodeId: null,
        signalPath,
        cameraTarget: CAMERA_TARGETS.leaf,
      };
    }),
  openDetail: (nodeId) =>
    set({
      level: 'detail',
      cameraMode: 'detail',
      transitionPhase: 'detail',
      activeNodeId: nodeId,
      selectedLeafId: nodeId,
      signalPath: null,
      cameraTarget: CAMERA_TARGETS.leaf,
    }),
  restoreNavigation: (categoryId, nodeId) => {
    clearTransitionTimers();
    set({
      level: nodeId ? 'detail' : categoryId ? 'category' : 'root',
      cameraMode: nodeId ? 'detail' : categoryId ? 'category' : 'overview',
      transitionPhase: nodeId ? 'detail' : categoryId ? 'category' : 'idle',
      activeCategoryId: categoryId,
      activeNodeId: nodeId ?? categoryId,
      selectedLeafId: nodeId ?? null,
      hoveredNodeId: null,
      signalPath: null,
      cameraTarget: nodeId ? CAMERA_TARGETS.leaf : categoryId ? CAMERA_TARGETS.category : CAMERA_TARGETS.overview,
    });
  },
  closeDetail: () => {
    clearTransitionTimers();
    set((state) => ({
      level: state.activeCategoryId ? 'category' : 'root',
      cameraMode: state.activeCategoryId ? 'category' : 'overview',
      transitionPhase: state.activeCategoryId ? 'category' : 'idle',
      activeNodeId: state.activeCategoryId,
      selectedLeafId: null,
      signalPath: null,
      cameraTarget: state.activeCategoryId ? CAMERA_TARGETS.category : CAMERA_TARGETS.overview,
    }));
  },
  returnToOverview: () => {
    clearTransitionTimers();
    set({
      level: 'root',
      cameraMode: 'overview',
      transitionPhase: 'idle',
      activeCategoryId: null,
      activeNodeId: null,
      selectedLeafId: null,
      hoveredNodeId: null,
      signalPath: null,
      cameraTarget: CAMERA_TARGETS.overview,
    });
  },
  goBack: () => {
    const state = get();
    if (isTransitioning(state.transitionPhase)) {
      clearTransitionTimers();
      set({
        transitionPhase: state.activeCategoryId ? 'category' : 'idle',
        cameraMode: state.activeCategoryId ? 'category' : 'overview',
        level: state.activeCategoryId ? 'category' : 'root',
        signalPath: null,
        cameraTarget: state.activeCategoryId ? CAMERA_TARGETS.category : CAMERA_TARGETS.overview,
      });
      return;
    }

    if (state.selectedLeafId) {
      get().closeDetail();
      return;
    }
    if (state.activeCategoryId) {
      get().returnToOverview();
    }
  },
}));
