import type { AtlasNode, CameraTarget } from '../atlasTypes';

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

export function overviewTarget(): CameraTarget {
  return CAMERA_TARGETS.overview;
}

export function categoryTarget(node: AtlasNode): CameraTarget {
  return {
    position: [node.position.x * 0.42, node.position.y * 0.42, node.position.z + 8.6],
    lookAt: [node.position.x, node.position.y, node.position.z],
    fov: 34,
  };
}

export function leafTarget(node: AtlasNode, parent?: AtlasNode | null): CameraTarget {
  const anchor = parent ?? node;

  return {
    position: [
      node.position.x * 0.76 + anchor.position.x * 0.12,
      node.position.y * 0.76 + anchor.position.y * 0.12,
      node.position.z + 5.6,
    ],
    lookAt: [node.position.x, node.position.y, node.position.z],
    fov: 29,
  };
}
