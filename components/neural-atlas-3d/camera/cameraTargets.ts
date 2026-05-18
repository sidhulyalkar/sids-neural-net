import type { CameraTarget } from '../atlasTypes';

export const CAMERA_TARGETS: Record<'overview' | 'category' | 'leaf', CameraTarget> = {
  overview: {
    position: [0, 0, 16],
    lookAt: [0, 0, 0],
    fov: 42,
  },
  category: {
    position: [0, 0, 11],
    lookAt: [0, 0, 0],
    fov: 42,
  },
  leaf: {
    position: [0, 0, 7.5],
    lookAt: [0, 0, 0],
    fov: 38,
  },
};
