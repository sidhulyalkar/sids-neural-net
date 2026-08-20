import type { NatureRenderCue, RichNatureWorldDefinition } from '../natureWorldsExpanded';
import { deriveSeed, distanceXZ, finiteVec3, makeRandom, pick, range } from './random';
import { WORLD3D_BUDGETS, WORLD3D_STANDARDS } from './standards';
import type {
  CollisionRole,
  MaterialRole,
  MaterialStyle,
  PrimitiveKind,
  SpatialArchetype,
  TraversalStyle,
  Vec3,
  World3DConnection,
  World3DDiagnostics,
  World3DPlan,
  World3DPrimitive,
  World3DScatterGroup,
  World3DValidationIssue,
  WorldLaw,
} from './types';

const TREE_CUES = new Set<NatureRenderCue>(['pine', 'oak', 'bamboo', 'willow', 'palm', 'tree']);
const SOFT_CUES = new Set<NatureRenderCue>(['fern', 'moss', 'grass', 'flower', 'sunflower', 'mushroom', 'fruit', 'leaf']);
const SPIRE_CUES = new Set<NatureRenderCue>(['cactus', 'agave', 'yucca', 'coral', 'kelp', 'reed']);
const ROCK_CUES = new Set<NatureRenderCue>(['rock', 'mountain', 'canyon', 'roots', 'log', 'ruin']);
const GLOW_CUES = new Set<NatureRenderCue>(['crystal', 'ice', 'aurora', 'glow', 'firefly', 'stars', 'meteor']);

function hasCue(world: RichNatureWorldDefinition, cue: NatureRenderCue): boolean {
  return world.scene.renderCues.includes(cue);
}

function chooseArchetype(world: RichNatureWorldDefinition): SpatialArchetype {
  const random = makeRandom(deriveSeed(world.seed, 11));
  if (world.terrain === 'cave' || hasCue(world, 'cave')) return pick(random, ['labyrinth', 'cathedral'] as const);
  if (world.terrain === 'reef') return 'reef';
  if (world.terrain === 'canyon' || hasCue(world, 'canyon')) return 'canyon';
  if (hasCue(world, 'island')) return pick(random, ['archipelago', 'fracture'] as const);
  if (hasCue(world, 'bridge') && hasCue(world, 'path')) return 'web';
  if (hasCue(world, 'path') || world.scene.depth === 'pathway') return 'ribbon';
  if (world.scene.depth === 'vertical') return pick(random, ['cathedral', 'tower', 'spiral'] as const);
  if (world.scene.depth === 'horizon' || world.scene.depth === 'panorama') return 'horizon';
  if (world.terrain === 'sky' || hasCue(world, 'aurora') || hasCue(world, 'stars')) return pick(random, ['orbit', 'inversion'] as const);
  if (world.scene.depth === 'macro') return pick(random, ['sanctuary', 'bowl'] as const);
  return pick(random, ['sanctuary', 'bowl', 'ribbon', 'fracture'] as const);
}

function traversalFor(archetype: SpatialArchetype): TraversalStyle {
  if (archetype === 'reef') return 'volumetric';
  if (['ribbon', 'canyon', 'labyrinth'].includes(archetype)) return 'path';
  if (['archipelago', 'web', 'fracture', 'orbit', 'inversion'].includes(archetype)) return 'platform';
  if (['tower', 'spiral', 'cathedral'].includes(archetype)) return 'vertical';
  return 'grounded';
}

function chooseLaw(world: RichNatureWorldDefinition): WorldLaw {
  const random = makeRandom(deriveSeed(world.seed, 17));
  if (hasCue(world, 'water') || hasCue(world, 'ocean') || hasCue(world, 'river')) return 'tide';
  if (hasCue(world, 'flower') || hasCue(world, 'mushroom')) return 'bloom';
  if (hasCue(world, 'stars') || hasCue(world, 'meteor')) return 'constellation';
  if (hasCue(world, 'crystal') || hasCue(world, 'ice')) return 'harmony';
  if (hasCue(world, 'wind') || hasCue(world, 'grass')) return 'breath';
  if (hasCue(world, 'lightning') || world.scene.atmosphere === 'storm') return 'echo';
  if (hasCue(world, 'island') || world.terrain === 'sky') return 'orbit';
  if (hasCue(world, 'cave') || world.scene.atmosphere === 'night') return 'shadow';
  if (hasCue(world, 'ruin')) return pick(random, ['reflection', 'growth'] as const);
  return pick(random, ['stillness', 'breath', 'growth', 'harmony', 'constellation'] as const);
}

function primitive(
  id: string,
  kind: PrimitiveKind,
  position: Vec3,
  scale: Vec3,
  colorRole: MaterialRole = 'secondary',
  material: MaterialStyle = 'matte',
  collision: CollisionRole = 'solid',
  rotation: Vec3 = [0, 0, 0],
  emissive?: number
): World3DPrimitive {
  return { id, kind, position, rotation, scale, colorRole, material, collision, emissive };
}

function addLandmark(structures: World3DPrimitive[], position: Vec3, kind: PrimitiveKind = 'portal', scale: Vec3 = [2.2, 2.8, 2.2]) {
  structures.push(primitive('landmark', kind, position, scale, 'glow', 'glow', 'interaction', [0, 0, 0], 1.1));
}

function buildStructures(archetype: SpatialArchetype, radius: number, seed: number): World3DPrimitive[] {
  const random = makeRandom(deriveSeed(seed, 23));
  const structures: World3DPrimitive[] = [
    primitive('ground', 'slab', [0, -0.18, 0], [radius * 1.9, 0.3, radius * 1.9], 'ground', 'matte', 'ground'),
  ];

  if (archetype === 'sanctuary' || archetype === 'bowl') {
    const count = archetype === 'sanctuary' ? 7 : 12;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const position: Vec3 = [Math.cos(angle) * radius * 0.66, 1.2, Math.sin(angle) * radius * 0.66];
      structures.push(
        primitive(
          `${archetype}-${i}`,
          archetype === 'sanctuary' ? 'column' : 'boulder',
          position,
          archetype === 'sanctuary' ? [0.42, 3.2 + (i % 2) * 0.7, 0.42] : [1.5, 1.3 + (i % 4) * 0.35, 1.5],
          'secondary'
        )
      );
    }
    addLandmark(structures, [0, 1.4, -radius * 0.48]);
    return structures;
  }

  if (archetype === 'ribbon' || archetype === 'canyon') {
    for (let i = 0; i < 9; i += 1) {
      const t = i / 8;
      const z = radius * 0.68 - t * radius * 1.38;
      const x = Math.sin(t * Math.PI * 2.2 + seed * 0.01) * 1.05;
      structures.push(primitive(`path-${i}`, 'slab', [x, -0.02, z], [2.1, 0.18, 2.15], 'ground', 'soft', 'walkable', [0, Math.sin(t * 5) * 0.16, 0]));
      if (archetype === 'canyon' && i % 2 === 0) {
        const height = range(random, 2.6, 5.6);
        structures.push(primitive(`wall-l-${i}`, 'shard', [x - 3.2, height * 0.5 - 0.1, z], [1.5, height, 2.45], 'secondary'));
        structures.push(primitive(`wall-r-${i}`, 'shard', [x + 3.2, height * 0.5 - 0.1, z], [1.5, height, 2.45], 'secondary'));
      }
    }
    addLandmark(structures, [0, 1.5, -radius * 0.7]);
    return structures;
  }

  if (archetype === 'archipelago' || archetype === 'fracture' || archetype === 'web') {
    const count = archetype === 'web' ? 6 : 8;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + 0.35;
      const r = radius * (0.42 + (i % 3) * 0.1);
      const y = archetype === 'fracture' ? range(random, 0.12, 0.5) : 0.04;
      structures.push(primitive(`island-${i}`, 'island', [Math.cos(angle) * r, y, Math.sin(angle) * r], [2.2, 0.65, 2.2], 'ground', 'matte', 'walkable', [0, angle, 0]));
    }
    addLandmark(structures, [0, 1.8, -radius * 0.52], archetype === 'fracture' ? 'crystal' : 'portal', archetype === 'fracture' ? [2.3, 4.2, 2.3] : [2.2, 2.8, 2.2]);
    return structures;
  }

  if (archetype === 'cathedral' || archetype === 'tower') {
    const rows = archetype === 'tower' ? 8 : 6;
    for (let i = 0; i < rows; i += 1) {
      const z = radius * 0.48 - i * 1.75;
      const height = archetype === 'tower' ? 2.2 + i * 0.35 : 4.2 + (i % 2) * 1.1;
      structures.push(primitive(`col-l-${i}`, 'column', [-2.5, height * 0.5, z], [0.48, height, 0.48], 'secondary'));
      structures.push(primitive(`col-r-${i}`, 'column', [2.5, height * 0.5, z], [0.48, height, 0.48], 'secondary'));
    }
    addLandmark(structures, [0, 2.15, -radius * 0.58], 'spire', [2.2, 4.3, 2.2]);
    return structures;
  }

  if (archetype === 'spiral') {
    for (let i = 0; i < 16; i += 1) {
      const angle = i * 0.5;
      const r = 2.7 + i * 0.11;
      structures.push(primitive(`spiral-${i}`, 'slab', [Math.cos(angle) * r, i * 0.16, Math.sin(angle) * r - 1.2], [1.6, 0.14, 2], 'secondary', 'soft', 'walkable', [0, -angle, 0]));
    }
    addLandmark(structures, [0, 3.25, -1.2], 'crystal', [2, 5.2, 2]);
    return structures;
  }

  if (archetype === 'orbit' || archetype === 'inversion') {
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2;
      const r = radius * (0.44 + (i % 2) * 0.15);
      const y = 1.2 + Math.sin(angle * 2) * 0.85;
      structures.push(primitive(`orbit-${i}`, 'island', [Math.cos(angle) * r, y, Math.sin(angle) * r], [1.7, 0.45, 1.7], 'secondary', 'soft', 'none', [0, angle, 0]));
    }
    if (archetype === 'inversion') structures.push(primitive('ceiling', 'dome', [0, 6.8, 0], [radius * 0.72, 2, radius * 0.72], 'fog', 'soft', 'none', [Math.PI, 0, 0]));
    addLandmark(structures, [0, 2.3, -radius * 0.48], 'ring', [3.2, 3.2, 3.2]);
    return structures;
  }

  if (archetype === 'reef') {
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2;
      const r = 2.4 + (i % 4) * 0.8;
      structures.push(primitive(`reef-${i}`, i % 3 === 0 ? 'crystal' : 'spire', [Math.cos(angle) * r, 0.8, Math.sin(angle) * r], [0.55, 1.6 + (i % 3) * 0.5, 0.55], i % 4 === 0 ? 'glow' : 'accent', i % 4 === 0 ? 'glow' : 'soft'));
    }
    addLandmark(structures, [0, 1.9, -radius * 0.55], 'portal', [2.5, 3.5, 2.5]);
    return structures;
  }

  if (archetype === 'labyrinth') {
    for (let i = 0; i < 10; i += 1) {
      const z = -radius * 0.55 + i * 1.25;
      const x = i % 2 === 0 ? -2.6 : 2.6;
      structures.push(primitive(`maze-${i}`, 'slab', [x, 1.15, z], [4.8, 2.3, 0.35], 'secondary', 'matte', 'solid', [0, i % 3 === 0 ? Math.PI * 0.5 : 0, 0]));
    }
    addLandmark(structures, [0, 1.5, -radius * 0.64]);
    return structures;
  }

  for (let i = 0; i < 9; i += 1) {
    const x = (i - 4) * 2.3;
    const z = -radius * 0.52 - (i % 2) * 1.5;
    structures.push(primitive(`horizon-${i}`, 'spire', [x, 1.2 + (i % 3) * 0.6, z], [0.8, 2.8 + (i % 3) * 1.2, 0.8], 'secondary', 'soft'));
  }
  addLandmark(structures, [0, 1.55, -radius * 0.58]);
  return structures;
}

function scatterStyle(cue: NatureRenderCue): { kind: PrimitiveKind; role: MaterialRole; material: MaterialStyle } {
  if (TREE_CUES.has(cue)) return { kind: 'canopy', role: 'accent', material: 'soft' };
  if (SOFT_CUES.has(cue)) return { kind: 'dome', role: 'accent', material: 'soft' };
  if (SPIRE_CUES.has(cue)) return { kind: 'spire', role: 'accent', material: 'soft' };
  if (ROCK_CUES.has(cue)) return { kind: 'boulder', role: 'secondary', material: 'matte' };
  if (GLOW_CUES.has(cue)) return { kind: 'crystal', role: 'glow', material: 'glow' };
  if (cue === 'cloud' || cue === 'fog') return { kind: 'dome', role: 'fog', material: 'soft' };
  if (['water', 'river', 'lake', 'pond', 'ocean', 'waterfall'].includes(cue)) return { kind: 'ring', role: 'water', material: 'water' };
  return { kind: 'boulder', role: 'secondary', material: 'matte' };
}

function buildScatter(world: RichNatureWorldDefinition, radius: number): World3DScatterGroup[] {
  return [...new Set(world.scene.renderCues)].slice(0, 6).map((cue, index) => {
    const style = scatterStyle(cue);
    const density = Math.max(0.15, Math.min(1, world.scene.density));
    const baseCount = TREE_CUES.has(cue) ? 18 : SOFT_CUES.has(cue) ? 28 : GLOW_CUES.has(cue) ? 14 : 12;
    const floating = ['cloud', 'stars', 'meteor', 'aurora', 'firefly'].includes(cue);
    return {
      id: `scatter-${cue}-${index}`,
      cue,
      kind: style.kind,
      count: Math.max(5, Math.round(baseCount * (0.55 + density * 1.25))),
      placement: floating ? 'floating' : index % 4 === 1 ? 'ring' : 'ground',
      minRadius: 2.1 + index * 0.2,
      maxRadius: Math.max(3.5, radius * (0.66 + (index % 2) * 0.12)),
      minHeight: floating ? 2.2 : 0,
      maxHeight: floating ? 5.8 : 0,
      minScale: TREE_CUES.has(cue) ? 0.65 : 0.28,
      maxScale: TREE_CUES.has(cue) ? 1.35 : GLOW_CUES.has(cue) ? 0.82 : 0.9,
      colorRole: style.role,
      material: style.material,
      seed: deriveSeed(world.seed, 100 + index),
    };
  });
}

function particleMode(world: RichNatureWorldDefinition): World3DPlan['atmosphere']['particleMode'] {
  if (world.scene.atmosphere === 'rain' || world.scene.atmosphere === 'storm') return 'rain';
  if (world.scene.atmosphere === 'snow' || world.scene.atmosphere === 'frost') return 'snow';
  if (world.scene.atmosphere === 'night' || hasCue(world, 'stars')) return 'stars';
  if (hasCue(world, 'firefly') || world.scene.atmosphere === 'glow') return 'motes';
  return world.scene.sparkle > 0.55 ? 'motes' : 'none';
}

function validatePlan(plan: Omit<World3DPlan, 'diagnostics'>): World3DDiagnostics {
  const issues: World3DValidationIssue[] = [];
  const spawn = plan.anchors.find((anchor) => anchor.role === 'spawn');
  const destination = plan.anchors.find((anchor) => anchor.role === 'destination');

  if (!spawn || !destination) issues.push({ severity: 'error', code: 'missing-critical-anchor', message: 'World must contain spawn and destination anchors.' });

  for (const anchor of plan.anchors) {
    if (!finiteVec3(anchor.position) || !Number.isFinite(anchor.radius)) issues.push({ severity: 'error', code: 'non-finite-anchor', message: `Anchor ${anchor.id} contains a non-finite value.` });
  }

  for (const structure of plan.structures) {
    if (!finiteVec3(structure.position) || !finiteVec3(structure.scale) || structure.scale.some((value) => value <= 0)) {
      issues.push({ severity: 'error', code: 'invalid-structure-transform', message: `Structure ${structure.id} has an invalid transform.` });
    }
    if (spawn && structure.collision !== 'ground' && structure.collision !== 'none' && structure.id !== 'landmark') {
      const clearance = distanceXZ(spawn.position, structure.position) - Math.max(structure.scale[0], structure.scale[2]) * 0.5;
      if (clearance < WORLD3D_STANDARDS.spawnClearRadius) issues.push({ severity: 'warning', code: 'spawn-clearance', message: `Structure ${structure.id} enters the preferred spawn-clear radius.` });
    }
  }

  for (const connection of plan.connections) {
    if (connection.width < WORLD3D_STANDARDS.minimumWalkableWidth) issues.push({ severity: 'error', code: 'narrow-route', message: `Connection ${connection.id} is narrower than the WebXR walkable standard.` });
  }

  const adjacency = new Map<string, string[]>();
  for (const anchor of plan.anchors) adjacency.set(anchor.id, []);
  for (const connection of plan.connections) {
    adjacency.get(connection.from)?.push(connection.to);
    adjacency.get(connection.to)?.push(connection.from);
  }
  const visited = new Set<string>();
  const queue = spawn ? [spawn.id] : [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of adjacency.get(id) ?? []) if (!visited.has(next)) queue.push(next);
  }
  const reachable = Boolean(destination && visited.has(destination.id));
  if (!reachable) issues.push({ severity: 'error', code: 'unreachable-destination', message: 'Destination is not connected to the spawn graph.' });

  const instanceCount = plan.scatter.reduce((total, group) => total + group.count, 0);
  const estimatedDrawCalls = plan.structures.length + plan.scatter.length + 6;
  if (instanceCount > plan.budget.maxInstances) issues.push({ severity: 'error', code: 'instance-budget', message: `Generated ${instanceCount} instances; XR budget allows ${plan.budget.maxInstances}.` });
  if (estimatedDrawCalls > plan.budget.maxDrawCalls) issues.push({ severity: 'error', code: 'draw-call-budget', message: `Estimated ${estimatedDrawCalls} draw calls; XR budget allows ${plan.budget.maxDrawCalls}.` });
  if (plan.atmosphere.particleCount > plan.budget.maxParticles) issues.push({ severity: 'error', code: 'particle-budget', message: 'Atmosphere exceeds the XR particle budget.' });

  return {
    structureCount: plan.structures.length,
    instanceCount,
    regionCount: plan.regions.length,
    connectionCount: plan.connections.length,
    estimatedDrawCalls,
    reachable,
    xrSafe: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}

export function compileWorld3D(world: RichNatureWorldDefinition): World3DPlan {
  const random = makeRandom(deriveSeed(world.seed, 31));
  const archetype = chooseArchetype(world);
  const traversal = traversalFor(archetype);
  const law = chooseLaw(world);
  const baseRadius = world.scene.depth === 'panorama' || world.scene.depth === 'horizon' ? 15 : world.scene.depth === 'macro' ? 8 : 11;
  const radius = Math.max(WORLD3D_STANDARDS.minimumWorldRadius, Math.min(WORLD3D_STANDARDS.maximumWorldRadius, baseRadius + range(random, -1.4, 1.4)));
  const verticality = Math.max(0.1, Math.min(1, world.scene.depth === 'vertical' ? 0.82 : world.terrain === 'mountain' ? 0.7 : 0.35 + random() * 0.28));
  const enclosure = Math.max(0.05, Math.min(1, world.terrain === 'cave' ? 0.95 : ['forest', 'wetland'].includes(world.terrain) ? 0.62 : world.scene.depth === 'horizon' ? 0.14 : 0.38));
  const landmarkZ = -Math.min(WORLD3D_STANDARDS.maximumLandmarkDistance, Math.max(WORLD3D_STANDARDS.minimumLandmarkDistance, radius * 0.62));

  const anchors = [
    { id: 'spawn', position: [0, 0, Math.min(2.4, radius * 0.2)] as Vec3, radius: WORLD3D_STANDARDS.spawnClearRadius, role: 'spawn' as const },
    { id: 'waypoint', position: [Math.sin(world.seed) * 1.2, 0, landmarkZ * 0.48] as Vec3, radius: 1.2, role: 'waypoint' as const },
    { id: 'landmark', position: [0, 0, landmarkZ] as Vec3, radius: 1.5, role: 'landmark' as const },
    { id: 'destination', position: [0.8 * Math.cos(world.seed * 0.1), 0, Math.max(-radius * 0.78, landmarkZ - 2.2)] as Vec3, radius: 1.25, role: 'destination' as const },
  ];

  const regions = anchors.map((anchor, index) => ({
    id: `region-${anchor.id}`,
    center: anchor.position,
    radius: index === 0 ? 2.2 : 2.6 + (index % 2) * 0.65,
    elevation: anchor.position[1],
    role: anchor.role === 'waypoint' ? 'traversal' as const : anchor.role,
  }));

  const width = WORLD3D_STANDARDS.preferredWalkableWidth;
  const connections: World3DConnection[] = [
    { id: 'spawn-waypoint', from: 'spawn', to: 'waypoint', width, kind: traversal === 'platform' ? 'bridge' : 'path' },
    { id: 'waypoint-landmark', from: 'waypoint', to: 'landmark', width, kind: traversal === 'vertical' ? 'step' : traversal === 'platform' ? 'bridge' : 'path' },
    { id: 'landmark-destination', from: 'landmark', to: 'destination', width, kind: archetype === 'inversion' ? 'portal' : 'open' },
  ];

  const pMode = particleMode(world);
  const withoutDiagnostics: Omit<World3DPlan, 'diagnostics'> = {
    schemaVersion: 1,
    worldId: world.id,
    worldIndex: world.index,
    source: world,
    seed: world.seed,
    archetype,
    traversal,
    law,
    radius,
    verticality,
    enclosure,
    anchors,
    regions,
    connections,
    structures: buildStructures(archetype, radius, world.seed),
    scatter: buildScatter(world, radius),
    interactions: [{ id: 'landmark-resonance', verb: hasCue(world, 'crystal') ? 'tune' : hasCue(world, 'flower') ? 'grow' : 'touch', targetAnchorId: 'landmark', radius: WORLD3D_STANDARDS.preferredInteractionDistance, response: law }],
    atmosphere: {
      fogNear: Math.max(5, radius * (0.5 + enclosure * 0.25)),
      fogFar: radius * (1.8 + (1 - enclosure) * 0.8),
      particleCount: pMode === 'none' ? 0 : Math.min(WORLD3D_BUDGETS.xr.maxParticles, Math.round(70 + world.scene.sparkle * 160)),
      particleMode: pMode,
      drift: world.scene.atmosphere === 'wind' ? 0.65 : world.scene.atmosphere === 'storm' ? 0.85 : 0.25,
    },
    lighting: {
      ambient: world.scene.atmosphere === 'night' ? 0.28 : 0.58,
      key: world.scene.atmosphere === 'night' ? 1.2 : 2.1,
      fill: 0.5,
      landmarkGlow: world.scene.sparkle > 0.5 ? 1.4 : 0.85,
      keyPosition: [-radius * 0.45, Math.max(5, radius * 0.55), radius * 0.32],
    },
    camera: {
      desktopPosition: [0, world.scene.depth === 'vertical' ? 4.6 : 3.1, Math.max(9.5, radius * 0.88)],
      target: [0, world.scene.depth === 'vertical' ? 2 : 1.1, -1.8],
      fov: world.scene.depth === 'panorama' || world.scene.depth === 'horizon' ? 48 : 43,
      minDistance: 4.5,
      maxDistance: Math.max(12, radius * 1.55),
    },
    budget: WORLD3D_BUDGETS.xr,
  };

  return { ...withoutDiagnostics, diagnostics: validatePlan(withoutDiagnostics) };
}

export function validateWorld3D(world: RichNatureWorldDefinition): World3DDiagnostics {
  return compileWorld3D(world).diagnostics;
}