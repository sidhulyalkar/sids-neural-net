import type { NatureRenderCue, RichNatureWorldDefinition } from '../natureWorldsExpanded';

export type Vec3 = readonly [number, number, number];
export type Euler3 = readonly [number, number, number];

export type SpatialArchetype =
  | 'sanctuary'
  | 'ribbon'
  | 'archipelago'
  | 'cathedral'
  | 'canyon'
  | 'bowl'
  | 'spiral'
  | 'orbit'
  | 'reef'
  | 'labyrinth'
  | 'horizon'
  | 'inversion'
  | 'web'
  | 'tower'
  | 'fracture';

export type TraversalStyle = 'grounded' | 'path' | 'platform' | 'vertical' | 'volumetric';
export type WorldLaw =
  | 'stillness'
  | 'orbit'
  | 'bloom'
  | 'echo'
  | 'tide'
  | 'breath'
  | 'gravity-well'
  | 'gaze'
  | 'harmony'
  | 'magnetism'
  | 'shadow'
  | 'fracture'
  | 'reflection'
  | 'growth'
  | 'constellation';

export type PrimitiveKind =
  | 'slab'
  | 'column'
  | 'arch'
  | 'ring'
  | 'island'
  | 'dome'
  | 'shard'
  | 'spire'
  | 'boulder'
  | 'crystal'
  | 'canopy'
  | 'portal';

export type MaterialRole = 'ground' | 'accent' | 'secondary' | 'water' | 'glow' | 'fog';
export type MaterialStyle = 'matte' | 'soft' | 'glow' | 'water' | 'glass';
export type CollisionRole = 'none' | 'ground' | 'solid' | 'walkable' | 'interaction';

export type World3DAnchor = {
  id: string;
  position: Vec3;
  radius: number;
  role: 'spawn' | 'waypoint' | 'landmark' | 'destination';
};

export type World3DRegion = {
  id: string;
  center: Vec3;
  radius: number;
  elevation: number;
  role: 'spawn' | 'traversal' | 'landmark' | 'destination' | 'ambient';
};

export type World3DConnection = {
  id: string;
  from: string;
  to: string;
  width: number;
  kind: 'open' | 'path' | 'bridge' | 'step' | 'portal';
};

export type World3DPrimitive = {
  id: string;
  kind: PrimitiveKind;
  position: Vec3;
  rotation: Euler3;
  scale: Vec3;
  colorRole: MaterialRole;
  material: MaterialStyle;
  collision: CollisionRole;
  emissive?: number;
};

export type ScatterPlacement = 'ground' | 'ring' | 'path' | 'floating' | 'ceiling';

export type World3DScatterGroup = {
  id: string;
  cue: NatureRenderCue;
  kind: PrimitiveKind;
  count: number;
  placement: ScatterPlacement;
  minRadius: number;
  maxRadius: number;
  minHeight: number;
  maxHeight: number;
  minScale: number;
  maxScale: number;
  colorRole: MaterialRole;
  material: MaterialStyle;
  seed: number;
};

export type World3DInteraction = {
  id: string;
  verb: 'touch' | 'grab' | 'place' | 'connect' | 'align' | 'strike' | 'grow' | 'collect' | 'follow' | 'climb' | 'glide' | 'tune';
  targetAnchorId: string;
  radius: number;
  response: WorldLaw;
};

export type World3DAtmospherePlan = {
  fogNear: number;
  fogFar: number;
  particleCount: number;
  particleMode: 'none' | 'motes' | 'rain' | 'snow' | 'embers' | 'stars';
  drift: number;
};

export type World3DLightingPlan = {
  ambient: number;
  key: number;
  fill: number;
  landmarkGlow: number;
  keyPosition: Vec3;
};

export type World3DCameraPlan = {
  desktopPosition: Vec3;
  target: Vec3;
  fov: number;
  minDistance: number;
  maxDistance: number;
};

export type World3DBudget = {
  maxDrawCalls: number;
  maxVisibleTriangles: number;
  maxInstances: number;
  maxDynamicLights: number;
  maxParticles: number;
};

export type World3DValidationIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
};

export type World3DDiagnostics = {
  structureCount: number;
  instanceCount: number;
  regionCount: number;
  connectionCount: number;
  estimatedDrawCalls: number;
  reachable: boolean;
  xrSafe: boolean;
  issues: World3DValidationIssue[];
};

export type World3DPlan = {
  schemaVersion: 1;
  worldId: string;
  worldIndex: number;
  source: RichNatureWorldDefinition;
  seed: number;
  archetype: SpatialArchetype;
  traversal: TraversalStyle;
  law: WorldLaw;
  radius: number;
  verticality: number;
  enclosure: number;
  anchors: World3DAnchor[];
  regions: World3DRegion[];
  connections: World3DConnection[];
  structures: World3DPrimitive[];
  scatter: World3DScatterGroup[];
  interactions: World3DInteraction[];
  atmosphere: World3DAtmospherePlan;
  lighting: World3DLightingPlan;
  camera: World3DCameraPlan;
  budget: World3DBudget;
  diagnostics: World3DDiagnostics;
};