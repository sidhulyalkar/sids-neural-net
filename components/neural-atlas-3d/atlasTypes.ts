import type { NeuralNode } from '@/lib/data/schemas';

export type AtlasVec3 = [number, number, number];

export type AtlasNodeKind = 'category' | 'leaf';

export type AtlasMorphology =
  | 'soma'
  | 'pyramidal'
  | 'stellate'
  | 'interneuron'
  | 'glial';

export type AtlasPhase =
  | 'overview'
  | 'travelingToCategory'
  | 'categoryFocused'
  | 'expandingSubnetwork'
  | 'leafFocused'
  | 'detailOpen'
  | 'returning';

export type AtlasNode = {
  id: string;
  slug: string;
  title: string;
  label: string;
  summary?: string;
  kind: AtlasNodeKind;
  morphology: AtlasMorphology;
  categoryId?: string;
  route: string;
  color: string;
  position: AtlasVec3;
  size: number;
  sourceNode?: NeuralNode;
};

export type AtlasEdge = {
  id: string;
  source: string;
  target: string;
  strength: number;
  color: string;
};

export type AtlasGraph = {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  categories: AtlasNode[];
};

export type CameraTarget = {
  position: AtlasVec3;
  lookAt: AtlasVec3;
  fov?: number;
};
