import type { GitHubMeta, NeuralNode, PublicationMeta } from '@/lib/data/schemas';

export type AtlasVector3 = {
  x: number;
  y: number;
  z: number;
};

export type AtlasVec3 = [number, number, number];

export type AtlasNodeKind = 'root' | 'category' | 'subcategory' | 'leaf';

export type AtlasLeafContentType =
  | 'project'
  | 'publication'
  | 'case-study'
  | 'field-note'
  | 'idea'
  | 'photography'
  | 'contact'
  | 'external';

export type AtlasMorphology =
  | 'soma'
  | 'pyramidal'
  | 'stellate'
  | 'interneuron'
  | 'purkinje-inspired'
  | 'glial'
  | 'axon-terminal';

export type AtlasNavigationLevel = 'root' | 'category' | 'detail';

export type AtlasCameraMode = 'overview' | 'traveling' | 'category' | 'detail';

export type AtlasTransitionPhase = 'idle' | 'charging' | 'traveling' | 'arriving' | 'category' | 'detail' | 'reading';

export type AtlasVisibleState = AtlasNavigationLevel | AtlasCameraMode | AtlasTransitionPhase | 'always';

export type AtlasCurveType = 'axon' | 'dendrite' | 'bundle' | 'synapse';

export type AtlasEdgeRelation =
  | 'root-to-category'
  | 'category-to-leaf'
  | 'subcategory-to-leaf'
  | 'related'
  | 'canonical'
  | 'external';

export type AtlasNodeDetail = {
  description?: string;
  whyItMatters?: string;
  myContribution?: string;
  summaryBullets?: string[];
  architectureHighlights?: string[];
  representativeFiles?: string[];
  demonstrates?: string;
  paperPdfPath?: string;
};

export type AtlasNode = {
  id: string;
  slug: string;
  title: string;
  shortLabel: string;
  summary: string;
  kind: AtlasNodeKind;
  contentType: AtlasLeafContentType;
  morphology: AtlasMorphology;
  category: string;
  parentId: string | null;
  childrenIds: string[];
  relatedIds: string[];
  position: AtlasVector3;
  scale: number;
  color: string;
  route: string;
  externalUrl?: string | null;
  sourceNodeSlug?: string;
  publication?: PublicationMeta;
  github?: GitHubMeta;
  detail?: AtlasNodeDetail;
  tags: string[];
  domains: string[];
  importance: number;
  featured: boolean;
  hiddenUntilParentFocused: boolean;
  sourceNode?: NeuralNode;
};

export type AtlasEdge = {
  id: string;
  source: string;
  target: string;
  relation: AtlasEdgeRelation;
  strength: number;
  curveType: AtlasCurveType;
  color: string;
  signalDelay: number;
  dendriteBranches: number;
  visibleInStates: AtlasVisibleState[];
};

export type AtlasGraph = {
  rootId: string;
  categoryIds: string[];
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  categories: AtlasNode[];
  generatedNodeCount: number;
  generatedEdgeCount: number;
};

export type AtlasNavigationState = {
  level: AtlasNavigationLevel;
  activeCategoryId: string | null;
  activeNodeId: string | null;
  selectedLeafId: string | null;
  cameraMode: AtlasCameraMode;
  signalPath: string[] | string | null;
  transitionPhase: AtlasTransitionPhase;
};

export type CameraTarget = {
  position: AtlasVec3;
  lookAt: AtlasVec3;
  fov?: number;
};

export function vectorToTuple(position: AtlasVector3): AtlasVec3 {
  return [position.x, position.y, position.z];
}
