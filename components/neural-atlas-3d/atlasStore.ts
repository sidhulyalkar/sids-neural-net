'use client';

import { create } from 'zustand';
import type { AtlasCameraMode, AtlasNavigationLevel, AtlasTransitionPhase } from './atlasTypes';
import { CAMERA_TARGETS } from './camera/cameraTargets';
import type { CameraTarget } from './atlasTypes';

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
  setHoveredNode: (nodeId: string | null) => void;
  focusCategory: (categoryId: string) => void;
  focusLeaf: (nodeId: string) => void;
  openDetail: (nodeId: string) => void;
  closeDetail: () => void;
  returnToOverview: () => void;
};

export const useAtlasStore = create<AtlasStore>((set) => ({
  level: 'root',
  cameraMode: 'overview',
  transitionPhase: 'idle',
  activeCategoryId: null,
  activeNodeId: null,
  selectedLeafId: null,
  hoveredNodeId: null,
  signalPath: null,
  cameraTarget: CAMERA_TARGETS.overview,
  setHoveredNode: (hoveredNodeId) => set({ hoveredNodeId }),
  focusCategory: (categoryId) =>
    set({
      level: 'category',
      cameraMode: 'category',
      transitionPhase: 'arriving',
      activeCategoryId: categoryId,
      activeNodeId: categoryId,
      selectedLeafId: null,
      signalPath: [categoryId],
      cameraTarget: CAMERA_TARGETS.category,
    }),
  focusLeaf: (nodeId) =>
    set({
      level: 'category',
      cameraMode: 'detail',
      transitionPhase: 'arriving',
      activeNodeId: nodeId,
      selectedLeafId: nodeId,
      signalPath: [nodeId],
      cameraTarget: CAMERA_TARGETS.leaf,
    }),
  openDetail: (nodeId) =>
    set({
      level: 'detail',
      cameraMode: 'detail',
      transitionPhase: 'reading',
      activeNodeId: nodeId,
      selectedLeafId: nodeId,
      signalPath: [nodeId],
      cameraTarget: CAMERA_TARGETS.leaf,
    }),
  closeDetail: () =>
    set((state) => ({
      level: state.activeCategoryId ? 'category' : 'root',
      cameraMode: state.activeCategoryId ? 'category' : 'overview',
      transitionPhase: 'idle',
      activeNodeId: state.activeCategoryId,
      selectedLeafId: null,
      signalPath: null,
      cameraTarget: state.activeCategoryId ? CAMERA_TARGETS.category : CAMERA_TARGETS.overview,
    })),
  returnToOverview: () =>
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
    }),
}));
