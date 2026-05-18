'use client';

import { create } from 'zustand';
import type { AtlasPhase } from './atlasTypes';
import { CAMERA_TARGETS } from './camera/cameraTargets';
import type { CameraTarget } from './atlasTypes';

type AtlasStore = {
  phase: AtlasPhase;
  activeCategoryId: string | null;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  cameraTarget: CameraTarget;
  setHoveredNode: (nodeId: string | null) => void;
  focusCategory: (categoryId: string) => void;
  focusLeaf: (nodeId: string) => void;
  openDetail: (nodeId: string) => void;
  closeDetail: () => void;
  returnToOverview: () => void;
};

export const useAtlasStore = create<AtlasStore>((set) => ({
  phase: 'overview',
  activeCategoryId: null,
  selectedNodeId: null,
  hoveredNodeId: null,
  cameraTarget: CAMERA_TARGETS.overview,
  setHoveredNode: (hoveredNodeId) => set({ hoveredNodeId }),
  focusCategory: (categoryId) =>
    set({
      phase: 'categoryFocused',
      activeCategoryId: categoryId,
      selectedNodeId: null,
      cameraTarget: CAMERA_TARGETS.category,
    }),
  focusLeaf: (nodeId) =>
    set({
      phase: 'leafFocused',
      selectedNodeId: nodeId,
      cameraTarget: CAMERA_TARGETS.leaf,
    }),
  openDetail: (nodeId) =>
    set({
      phase: 'detailOpen',
      selectedNodeId: nodeId,
      cameraTarget: CAMERA_TARGETS.leaf,
    }),
  closeDetail: () =>
    set((state) => ({
      phase: state.activeCategoryId ? 'categoryFocused' : 'overview',
      selectedNodeId: null,
      cameraTarget: state.activeCategoryId ? CAMERA_TARGETS.category : CAMERA_TARGETS.overview,
    })),
  returnToOverview: () =>
    set({
      phase: 'overview',
      activeCategoryId: null,
      selectedNodeId: null,
      hoveredNodeId: null,
      cameraTarget: CAMERA_TARGETS.overview,
    }),
}));
