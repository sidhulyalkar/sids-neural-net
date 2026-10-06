import { activityLanding, BOULDER_HOLDS, effectiveActivity, FALLEN_LOGS, grindStyleForApproach, groundHeight, nearestGrind, nextHold, onSnow, rampImpulseAt, RIDE_RAMPS, stepSwim, stepTravel, terrainContact, type Activity, type AquaticMode, type GrindStyle, type Travel } from "@/lib/world/activities";
import { SHASTA_COAT } from "@/lib/world/ecology";
import { FrameSampler, QualityController } from "@/lib/world/performance";
import * as THREE from "three/src/Three.Core.js";
import type { WebGLRenderer } from "three/src/renderers/WebGLRenderer.js";
import {
  constrainMove,
  distance,
  MEMORY_POINTS,
  SEA_SURFACE,
  coastlineX,
  eastCoastlineX,
  isWater,
  maxDiveDepth,
  nearestRegion,
  nearbyDiscovery,
  regionLanding,
  REGIONS,
  SECRET,
  SPAWN,
  seaFloorHeight,
  terrainHeight,
  waterZone,
  worldFloorHeight,
  WORLD_BOUNDS,
  type Obstacle,
  type Point,
  type RegionId,
  type WorldCommand,
} from "@/lib/world/model";

type Callbacks = {
  onReady: () => void;
  onError: () => void;
  onAquatic: (mode: AquaticMode) => void;
  onLocation: (r: RegionId, d: string | null) => void;
  onInteract: (d: string) => void;
};
type State = {
  activity: Activity;
  actionSerial: number;
  waterAction: "dive" | "deeper" | "shallower" | "surface";
  waterActionSerial: number;
  entered: boolean;
  paused: boolean;
  command: WorldCommand | null;
};
export type WorldRuntime = {
  setState: (state: State) => void;
  dispose: () => void;
};
const UP = new THREE.Vector3(0, 1, 0);

/** All art is deterministic procedural geometry; no model, texture, physics, or postprocessing downloads. */
export function createWorld(
  host: HTMLElement,
  callbacks: Callbacks,
  Renderer: typeof WebGLRenderer,
  gameTitles: string[],
): WorldRuntime {
  const renderer = new Renderer({
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let adaptiveShadows = true;
  renderer.setPixelRatio(dpr);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute(
    "aria-label",
    "Explore Sid’s world. Use arrows or WASD to move, Shift to sprint, Space for your land activity, V to dive or surface, Q and E for dive depth, drag to look, Enter to discover, and M for the menu.",
  );
  host.appendChild(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#67b7ef");
  scene.fog = new THREE.Fog("#c4e2f1", 85, 270);
  const camera = new THREE.PerspectiveCamera(47, 1, 0.15, 360);
  camera.position.set(42, 36, 86);
  const look = new THREE.Vector3(-12, 6, -12);
  camera.lookAt(look);
  scene.add(new THREE.HemisphereLight("#d9edff", "#a48c64", 2.0));
  const sun = new THREE.DirectionalLight("#fff0cf", 2.8);
  sun.position.set(-40, 65, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -50,
    right: 50,
    top: 50,
    bottom: -50,
    near: 1,
    far: 160,
  });
  sun.shadow.normalBias = 0.1;
  sun.shadow.bias = -0.0003;
  scene.add(sun);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const geo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.add(g);
    return g;
  };
  const mat = (
    color: string,
    extra: THREE.MeshStandardMaterialParameters = {},
  ) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      flatShading: true,
      ...extra,
    });
    materials.add(m);
    return m;
  };
  const trunkMat = mat("#975334");
  const leafMat = mat("#ffffff");
  const rockMat = mat("#b4b6a4");
  const neuralMat = mat("#549889", {
    emissive: "#296759",
    emissiveIntensity: 0.5,
  });
  const lightMat = mat("#e5d7a1", {
    emissive: "#e0c583",
    emissiveIntensity: 0.35,
  });
  const cone = geo(new THREE.ConeGeometry(1, 1, 7));
  const cylinder = geo(new THREE.CylinderGeometry(0.62, 1, 1, 7));
  const rockGeo = geo(new THREE.IcosahedronGeometry(1, 0));
  const boxGeo = geo(new THREE.BoxGeometry(1, 1, 1));
  let seed = 219;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const dummy = new THREE.Object3D();
  type Instance = {
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    ry?: number;
    q?: THREE.Quaternion;
    color?: string;
  };
  function instances(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    points: Instance[],
    shadow = true,
    parent: THREE.Object3D = scene,
  ) {
    const mesh = new THREE.InstancedMesh(g, m, points.length);
    points.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.rotation.set(0, p.ry ?? 0, 0);
      if (p.q) dummy.quaternion.copy(p.q);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (p.color) mesh.setColorAt(i, new THREE.Color(p.color));
    });
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    mesh.computeBoundingSphere();
    parent.add(mesh);
    return mesh;
  }
  function segment(
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
  ): Instance {
    const mid = a.clone().add(b).multiplyScalar(0.5),
      direction = b.clone().sub(a);
    return {
      x: mid.x,
      y: mid.y,
      z: mid.z,
      sx: radius,
      sy: direction.length(),
      sz: radius,
      q: new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()),
    };
  }
  function mesh(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    p: number[],
    s: number[],
    parent: THREE.Object3D = scene,
  ) {
    const object = new THREE.Mesh(g, m);
    object.position.set(p[0], p[1], p[2]);
    object.scale.set(s[0], s[1], s[2]);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  // One continuous finite surface covers land, shoreline and the underwater shelf.
  const terrainWidth = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
  const terrainDepth = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
  const terrain = geo(new THREE.PlaneGeometry(terrainWidth, terrainDepth, 118, 110));
  terrain.rotateX(-Math.PI / 2);
  terrain.translate(
    (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2,
    0,
    (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2,
  );
  const pos = terrain.attributes.position;
  const colors: number[] = [];
  const groundColor = new THREE.Color();
  function lineDistance(x: number, z: number, a: Point, b: Point) {
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = THREE.MathUtils.clamp(
      ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
      0,
      1,
    );
    return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    const wet = isWater({ x, z });
    const y = worldFloorHeight(x, z);
    pos.setY(i, y);
    const trail = Math.min(
      ...REGIONS.slice(1).map((r) =>
        lineDistance(x, z, REGIONS[0].point, r.point),
      ),
    );
    groundColor.set(
      wet
        ? "#526d61"
        : x < coastlineX(z) + 5
          ? "#d5bd87"
          : y > 10
            ? "#7d8585"
            : x > 21
              ? "#527466"
              : "#a8a064",
    );
    if (!wet && (trail < 1.7 || distance({ x, z }, REGIONS[0].point) < 4))
      groundColor.set("#b6a684");
    if (onSnow({ x, z })) groundColor.set("#edf3f2");
    groundColor.multiplyScalar(0.94 + random() * 0.12);
    colors.push(groundColor.r, groundColor.g, groundColor.b);
  }
  terrain.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  const ground = mesh(
    terrain,
    mat("#ffffff", { vertexColors: true }),
    [0, 0, 0],
    [1, 1, 1],
  );
  ground.castShadow = false;
  // Ocean and a few quiet, moving tide lines.
  const waterMaterial = mat("#218ba8", {
    roughness: 0.38,
    metalness: 0.12,
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
  });
  const water = mesh(
    geo(new THREE.PlaneGeometry(540, 420)),
    waterMaterial,
    [-80, SEA_SURFACE, -90],
    [1, 1, 1],
  );
  water.rotation.x = -Math.PI / 2;
  water.castShadow = false;
  const waves: Instance[] = [];
  for (let i = 0; i < 100; i++)
    waves.push({
      x: -40 - random() * 130,
      y: -1.34,
      z: -110 + random() * 170,
      sx: 1 + random() * 6,
      sy: 0.018,
      sz: 0.1 + random() * 0.1,
    });
  const tides = instances(boxGeo, mat("#a4ccca"), waves, false);

  // A single instanced foam ribbon follows the same mathematical coastline used
  // by movement and swimming transitions, so the visible shore and gameplay shore
  // cannot drift apart.
  const shoreFoamPieces: Instance[] = [];
  for (let z = WORLD_BOUNDS.minZ + 8; z <= WORLD_BOUNDS.maxZ - 3; z += 2.4) {
    for (const side of ["west", "east"] as const) {
      const coast = side === "west" ? coastlineX : eastCoastlineX;
      const x = coast(z) + (side === "west" ? -0.42 : 0.42);
      const tangentX = coast(z + 0.7) - coast(z - 0.7);
      shoreFoamPieces.push({
        x,
        y: SEA_SURFACE + 0.035,
        z,
        sx: 0.16,
        sy: 0.025,
        sz: 1.35,
        ry: Math.atan2(tangentX, 1.4),
      });
    }
  }
  const shoreFoamMat = mat("#d9f1ee", {
    transparent: true,
    opacity: 0.62,
    emissive: "#8ebfbd",
    emissiveIntensity: 0.08,
  });
  const shoreFoam = instances(boxGeo, shoreFoamMat, shoreFoamPieces, false);

  // Far granite silhouettes echo the playable ridge without competing with it.
  const peaks: Instance[] = [],
    snow: Instance[] = [];
  for (let i = 0; i < 15; i++) {
    const x = -58 + i * 11,
      z = -150 - random() * 38,
      h = 28 + random() * 38;
    peaks.push({
      x,
      y: h / 2 - 4,
      z,
      sx: 18 + random() * 12,
      sy: h,
      sz: 18 + random() * 9,
      ry: i * 0.8,
    });
    snow.push({
      x,
      y: h - 4 - h * 0.17 + 0.1,
      z,
      sx: peaks[i].sx * 0.348,
      sy: h * 0.345,
      sz: peaks[i].sz * 0.348,
      ry: i * 0.8,
    });
  }
  instances(cone, mat("#738e90"), peaks, false);
  instances(cone, mat("#e2e7d6"), snow, false);
  const boulders: Instance[] = [];
  for (let i = 0; i < 95; i++) {
    const x = -34 + random() * 75,
      z = -43 + random() * 79;
    if (
      BOULDER_HOLDS.some(h => distance(h, { x, z }) < 5) ||
      REGIONS.some((r) => distance(r.point, { x, z }) < 7) ||
      MEMORY_POINTS.some((m) => distance(m.point, { x, z }) < 4)
    )
      continue;
    const s = 0.3 + random() * 2.2;
    boulders.push({
      x,
      y: terrainHeight(x, z) + s * 0.3,
      z,
      sx: s,
      sy: s * 0.7,
      sz: s * 1.2,
      ry: random() * 6,
    });
  }
  // Authored climbable ledges use the same footprint and top height as navigation.
  const climbRocks: THREE.Mesh[] = [];
  const ledgeGeometry = geo(new THREE.CylinderGeometry(1, 1.15, 1, 8));
  for (const hold of BOULDER_HOLDS) {
    const y = terrainHeight(hold.x, hold.z);
    climbRocks.push(mesh(ledgeGeometry, rockMat, [hold.x, y + hold.height / 2, hold.z], [hold.radius, hold.height, hold.radius]));
    mesh(boxGeo, mat("#e7b574"), [hold.x, y + hold.height + 0.03, hold.z], [0.35, 0.04, 0.35]);
  }
  // Decorative boulders are low enough to step over; tree trunks have collision.
  instances(rockGeo, rockMat, boulders);
  const trunks: Instance[] = [],
    branches: Instance[] = [],
    crowns: Instance[] = [],
    roots: Instance[] = [];
  const obstacles: Obstacle[] = [];
  const trees = [
    { x: -10, z: 6, h: 24, r: 1.4 },
    { x: 9, z: 1, h: 27, r: 1.5 },
    { x: -5, z: -7, h: 29, r: 1.7 },
    { x: 17, z: 15, h: 20, r: 1.1 },
    { x: -13, z: 23, h: 21, r: 1.2 },
  ];
  for (let i = 0; i < 27; i++) {
    const x = -25 + random() * 71,
      z = -40 + random() * 80;
    if (
      x < -17 || z < -15 ||
      BOULDER_HOLDS.some(h => distance(h, { x, z }) < 6) ||
      REGIONS.some((r) => distance(r.point, { x, z }) < 9) ||
      (x > 35 && x < 54 && z > -12 && z < 22) ||
      distance({ x, z }, SPAWN) < 8 ||
      distance({ x, z }, SECRET) < 5
    )
      continue;
    trees.push({ x, z, h: 10 + random() * 13, r: 0.55 + random() * 0.5 });
  }
  trees.forEach(({ x, z, h, r }, index) => {
    const y = terrainHeight(x, z);
    obstacles.push({ x, z, radius: r });
    trunks.push({
      x,
      y: y + h * 0.45,
      z,
      sx: r,
      sy: h * 0.9,
      sz: r,
      ry: random() * 6,
    });
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 0.4 + index;
      const end = new THREE.Vector3(
        x + Math.cos(a) * r * 3,
        terrainHeight(x + Math.cos(a) * r * 3, z + Math.sin(a) * r * 3) + 0.08,
        z + Math.sin(a) * r * 3,
      );
      roots.push(segment(new THREE.Vector3(x, y + 0.65, z), end, r * 0.3));
    }
    for (let j = 0; j < 8; j++) {
      const a = j * 2.4 + index,
        height = h * (0.51 + j * 0.05);
      const reach = r * (3.3 - j * 0.22);
      const end = new THREE.Vector3(
        x + Math.cos(a) * reach,
        y + height + 1.1,
        z + Math.sin(a) * reach,
      );
      branches.push(
        segment(new THREE.Vector3(x, y + height, z), end, r * 0.19),
      );
      crowns.push({
        x: end.x,
        y: end.y + 1.4,
        z: end.z,
        sx: reach * 0.8,
        sy: h * 0.12,
        sz: reach * 0.75,
        ry: a,
        color: index % 3 ? "#50806b" : "#668968",
      });
    }
    crowns.push({
      x,
      y: y + h * 0.91,
      z,
      sx: r * 1.7,
      sy: h * 0.15,
      sz: r * 1.8,
      color: "#5e846e",
    });
  });
  instances(cylinder, trunkMat, [...trunks, ...branches, ...roots]);
  instances(cone, leafMat, crowns);

  // A denser alpine tree run leaves readable lanes between collidable trunks.
  const skiTrunks: Instance[] = [], skiCrowns: Instance[] = [];
  for (let i = 0; i < 68; i++) {
    const x = -25 + random() * 62;
    const z = -84 + random() * 49;
    const laneCenter = 7 + Math.sin((z + 60) * 0.13) * 7;
    if (
      Math.abs(x - laneCenter) < 3.4 ||
      distance({ x, z }, REGIONS[1].point) < 7 ||
      RIDE_RAMPS.some(r => distance({ x, z }, r.point) < 5)
    ) continue;
    const y = terrainHeight(x, z);
    if (y < 7.5) continue;
    const h = 8 + random() * 8;
    const r = 0.38 + random() * 0.25;
    obstacles.push({ x, z, radius: r + 0.08 });
    skiTrunks.push({ x, y: y + h * 0.44, z, sx: r, sy: h * 0.88, sz: r });
    for (let layer = 0; layer < 3; layer++) {
      const width = 2.3 - layer * 0.45;
      skiCrowns.push({
        x,
        y: y + h * (0.52 + layer * 0.15),
        z,
        sx: width,
        sy: h * 0.3,
        sz: width,
        ry: i * 0.7 + layer,
        color: layer === 2 ? "#4e6f63" : "#405f55",
      });
    }
  }
  instances(cylinder, mat("#6f4936"), skiTrunks);
  instances(cone, leafMat, skiCrowns);

  // Fallen redwoods double as visible obstacles to jump and deterministic grind rails.
  const fallenLogVisuals: Instance[] = [];
  for (const log of FALLEN_LOGS) {
    const a = new THREE.Vector3(log.a.x, terrainHeight(log.a.x, log.a.z) + log.lift, log.a.z);
    const b = new THREE.Vector3(log.b.x, terrainHeight(log.b.x, log.b.z) + log.lift, log.b.z);
    fallenLogVisuals.push(segment(a, b, log.radius));
  }
  instances(cylinder, mat("#744530"), fallenLogVisuals);

  // Timber kickers use the same positions/headings as the launch mechanic.
  // Individual planks plus two stringers read as a built feature instead of a
  // floating brown slab, while remaining only two instanced draw calls.
  const rampPlanks: Instance[] = [], rampStringers: Instance[] = [];
  for (const ramp of RIDE_RAMPS) {
    const headingLength = Math.hypot(ramp.heading.x, ramp.heading.z);
    const forward = {
      x: ramp.heading.x / headingLength,
      z: ramp.heading.z / headingLength,
    };
    const right = { x: forward.z, z: -forward.x };
    const yaw = Math.atan2(forward.x, forward.z);
    const pitch = -0.2;
    const plankQ = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitch, yaw, 0, "YXZ"),
    );
    const baseY = terrainHeight(ramp.point.x, ramp.point.z);
    for (let plank = 0; plank < 8; plank++) {
      const t = plank / 7;
      const along = -1.75 + t * 3.5;
      rampPlanks.push({
        x: ramp.point.x + forward.x * along,
        y: baseY + 0.12 + t * 0.72,
        z: ramp.point.z + forward.z * along,
        sx: 2.55,
        sy: 0.11,
        sz: 0.48,
        q: plankQ,
      });
    }
    for (const side of [-1, 1]) {
      const start = new THREE.Vector3(
        ramp.point.x - forward.x * 1.9 + right.x * side * 0.92,
        baseY + 0.08,
        ramp.point.z - forward.z * 1.9 + right.z * side * 0.92,
      );
      const end = new THREE.Vector3(
        ramp.point.x + forward.x * 1.9 + right.x * side * 0.92,
        baseY + 0.86,
        ramp.point.z + forward.z * 1.9 + right.z * side * 0.92,
      );
      rampStringers.push(segment(start, end, 0.08));
    }
  }
  instances(boxGeo, mat("#815536"), rampPlanks);
  instances(cylinder, mat("#5e3b28"), rampStringers);
  // Small grasses share one geometry and one draw call.
  const grasses: Instance[] = [];
  for (let i = 0; i < 750; i++) {
    const x = -28 + random() * 74,
      z = -39 + random() * 77;
    if (
      REGIONS.some((r) => lineDistance(x, z, REGIONS[0].point, r.point) < 2.7)
    )
      continue;
    const h = 0.15 + random() * 0.45;
    grasses.push({
      x,
      y: terrainHeight(x, z) + h * 0.4,
      z,
      sx: 0.18,
      sy: h,
      sz: 0.18,
      ry: random() * 6,
    });
  }
  const grassMesh = instances(cone, mat("#8ca474"), grasses, false);
  // Coastal scrub replaces trees on the exposed bluffs. Species are documented in Field notes.
  const coyote: Instance[] = [], sage: Instance[] = [], stems: Instance[] = [], poppies: Instance[] = [];
  for (let i = 0; i < 160; i++) {
    const x = -33 + random() * 14, z = -25 + random() * 58;
    if (REGIONS.some(r => distance(r.point, { x, z }) < 4) || MEMORY_POINTS.some(m => distance(m.point, { x, z }) < 3) ||
        REGIONS.slice(1).some(r => lineDistance(x, z, REGIONS[0].point, r.point) < 2)) continue;
    const y = terrainHeight(x, z), size = 0.4 + random() * 0.6;
    if (i % 2) coyote.push({ x, y: y + size * 0.45, z, sx: size, sy: size * 0.65, sz: size * 0.8 });
    else for (let k = 0; k < 4; k++) sage.push({ x: x + Math.cos(k * 1.6) * 0.22, y: y + size * 0.5, z: z + Math.sin(k * 1.6) * 0.22, sx: size * 0.28, sy: size, sz: size * 0.28 });
  }
  for (let i = 0; i < 140; i++) {
    const x = -30 + random() * 13, z = 9 + random() * 23;
    if (MEMORY_POINTS.some(m => distance(m.point, { x, z }) < 2) || distance(REGIONS[3].point, { x, z }) < 3) continue;
    const y = terrainHeight(x, z), h = 0.2 + random() * 0.2;
    stems.push({ x, y: y + h / 2, z, sx: 0.025, sy: h, sz: 0.025 });
    poppies.push({ x, y: y + h, z, sx: 0.12, sy: 0.13, sz: 0.12 });
  }
  instances(rockGeo, mat("#687b3d"), coyote, false);
  instances(cone, mat("#9da68b"), sage, false);
  instances(cylinder, mat("#779174"), stems, false);
  const poppyCup = geo(new THREE.ConeGeometry(1, 1, 4, 1, true));
  poppyCup.rotateX(Math.PI);
  instances(poppyCup, mat("#ffa82e", { side: THREE.DoubleSide }), poppies, false);
  // Dendrites grow naturally out of the eastern grove. Quiet, sparse, no bloom pass.
  const dendrites: Instance[] = [],
    synapses: Instance[] = [];
  function branch(
    origin: THREE.Vector3,
    length: number,
    angle: number,
    depth: number,
  ) {
    const end = origin
      .clone()
      .add(
        new THREE.Vector3(
          Math.cos(angle) * length * 0.55,
          length * 0.75,
          Math.sin(angle) * length * 0.55,
        ),
      );
    dendrites.push(segment(origin, end, 0.08 + depth * 0.04));
    if (depth === 0) {
      synapses.push({
        x: end.x,
        y: end.y,
        z: end.z,
        sx: 0.16,
        sy: 0.16,
        sz: 0.16,
      });
      return;
    }
    branch(end, length * 0.69, angle + 0.95, depth - 1);
    branch(end, length * 0.69, angle - 1.4, depth - 1);
  }
  for (let i = 0; i < 5; i++) {
    const x = 24 + i * 3,
      z = -14 + Math.sin(i * 2) * 5;
    branch(new THREE.Vector3(x, terrainHeight(x, z), z), 4.5, i * 1.6, 3);
  }
  instances(cylinder, neuralMat, dendrites);
  instances(rockGeo, lightMat, synapses, false);
  const particles = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) {
    const x = 22 + random() * 17,
      z = -18 + random() * 23;
    particles.set([x, terrainHeight(x, z) + 0.7 + random() * 7, z], i * 3);
  }
  const particleGeo = geo(new THREE.BufferGeometry());
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particles, 3));
  const particleMat = new THREE.PointsMaterial({
    color: "#d4f9cb",
    size: 0.1,
    transparent: true,
    opacity: 0.65,
  });
  materials.add(particleMat);
  const fireflies = new THREE.Points(particleGeo, particleMat);
  scene.add(fireflies);
  // Natural trail cairns replace the old rectangular waypoint pillars. Invisible
  // hit volumes preserve the same pointer/discovery semantics without advertising UI
  // geometry inside the landscape.
  const markerData = [
    ...REGIONS.map((r) => ({ id: r.id, point: r.point })),
    ...MEMORY_POINTS.map((m) => ({ id: m.id, point: m.point })),
  ];
  const markerObjects: THREE.Mesh[] = [];
  const cairnPieces: Instance[] = [], markerHitVolumes: Instance[] = [];
  const markerIds: string[] = [];
  const markerHitMat = mat("#ffffff", {
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  markerHitMat.colorWrite = false;
  markerData.forEach((m, i) => {
    const x = m.point.x,
      z = m.point.z,
      y = terrainHeight(x, z),
      scale = i < REGIONS.length ? 1 : 0.72,
      twist = i * 0.83;
    cairnPieces.push(
      { x, y: y + 0.18 * scale, z, sx: 0.62 * scale, sy: 0.28 * scale, sz: 0.52 * scale, ry: twist },
      { x: x + 0.05 * scale, y: y + 0.47 * scale, z: z - 0.02 * scale, sx: 0.46 * scale, sy: 0.23 * scale, sz: 0.4 * scale, ry: twist + 0.7 },
      { x: x - 0.04 * scale, y: y + 0.7 * scale, z: z + 0.03 * scale, sx: 0.31 * scale, sy: 0.19 * scale, sz: 0.29 * scale, ry: twist + 1.4 },
    );
    markerHitVolumes.push({
      x,
      y: y + 0.52 * scale,
      z,
      sx: 1.25 * scale,
      sy: 1.35 * scale,
      sz: 1.1 * scale,
    });
    markerIds.push(m.id);
  });
  const markerHitMesh = instances(boxGeo, markerHitMat, markerHitVolumes, false);
  markerHitMesh.userData.discoveryByInstance = markerIds;
  markerObjects.push(markerHitMesh);
  instances(rockGeo, mat("#8d9185"), cairnPieces, false);
  // Explorer root carries world/terrain orientation. bodyRoot carries the human pose
  // independently so swimming and bike seating do not rotate/offset the equipment.
  const explorer = new THREE.Group();
  const bodyRoot = new THREE.Group();
  explorer.add(bodyRoot);
  scene.add(explorer);
  const jacket = mat("#d09a4f"),
    dark = mat("#233f48"),
    skin = mat("#b58668"),
    pack = mat("#48685e");
  mesh(cylinder, jacket, [0, 1.1, 0], [0.34, 0.69, 0.28], bodyRoot);
  mesh(rockGeo, skin, [0, 1.69, 0], [0.27, 0.31, 0.26], bodyRoot);
  mesh(cylinder, dark, [0, 1.93, 0], [0.29, 0.13, 0.28], bodyRoot);
  mesh(boxGeo, pack, [0, 1.16, -0.27], [0.48, 0.54, 0.25], bodyRoot);
  const legs = [-1, 1].map((side) =>
    mesh(boxGeo, dark, [side * 0.16, 0.39, 0], [0.19, 0.72, 0.23], bodyRoot),
  );
  const arms = [-1, 1].map((side) =>
    mesh(cylinder, jacket, [side * 0.38, 1.03, 0], [0.12, 0.6, 0.12], bodyRoot),
  );
  // Lightweight snorkel kit appears only in water so swimming reads immediately.
  const snorkel = new THREE.Group();
  bodyRoot.add(snorkel);
  const maskGlass = mat("#b7e5eb", { transparent: true, opacity: 0.72, roughness: 0.2 });
  const snorkelRubber = mat("#20373c");
  mesh(boxGeo, maskGlass, [0, 1.7, 0.24], [0.42, 0.18, 0.05], snorkel);
  const snorkelTube = mesh(cylinder, snorkelRubber, [0.31, 1.8, 0.16], [0.035, 0.5, 0.035], snorkel);
  snorkelTube.rotation.z = -0.08;
  const snorkelTop = mesh(cylinder, snorkelRubber, [0.31, 2.04, 0.12], [0.035, 0.18, 0.035], snorkel);
  snorkelTop.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    const fin = mesh(boxGeo, dark, [side * 0.17, -0.01, 0.35], [0.18, 0.07, 0.62], snorkel);
    fin.rotation.x = -0.12;
  }
  snorkel.visible = false;
  // A side canyon and waterfall make the expanded loop readable from a distance.
  const canyonStone: Instance[] = [], canyonMoss: Instance[] = [], fernFronds: Instance[] = [];
  for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
    const x = 29 + side * (4.6 + Math.sin(i) * 0.5), z = 24 + i * 2.8;
    const y = terrainHeight(x, z), h = 3.8 + Math.sin(i * 0.8) * 1.3;
    canyonStone.push({ x, y: y + h * 0.45, z, sx: 1.8, sy: h, sz: 2.1, ry: i });
    obstacles.push({ x, z, radius: 1.3 });
    canyonMoss.push({ x: x - side * 0.8, y: y + h * 0.65, z, sx: 1.2, sy: 0.4, sz: 1.5 });
    for (let j = 0; j < 3; j++) fernFronds.push({ x: x - side * 1.9, y: y + 0.45, z: z + j * 0.3, sx: 0.1, sy: 0.65, sz: 0.55, ry: j * 1.7 });
  }
  instances(rockGeo, mat("#687b75"), canyonStone);
  instances(rockGeo, mat("#648d3d"), canyonMoss, false);
  instances(cone, mat("#4d875d"), fernFronds, false); // Stylized fern forms; no species claim.
  const falls = REGIONS.find(r => r.id === "waterfall")!.point;
  const fallsY = terrainHeight(falls.x, falls.z);
  const cliff: Instance[] = [];
  for (let i = 0; i < 7; i++) {
    const x = falls.x - 6 + i * 2, z = falls.z - 5;
    cliff.push({ x, y: fallsY + 4.2, z, sx: 2, sy: 6.1, sz: 1.8 });
    obstacles.push({ x, z, radius: 1.3 });
  }
  instances(rockGeo, mat("#698983"), cliff);
  const waterfall = mesh(boxGeo, mat("#c9f1f6", { transparent: true, opacity: 0.75, emissive: "#6babb7", emissiveIntensity: 0.15 }), [falls.x, fallsY + 4, falls.z - 2.9], [2.5, 8.4, 0.1]);
  waterfall.castShadow = false;
  const pool = mesh(geo(new THREE.CircleGeometry(4.2, 24)), mat("#399eaa", { transparent: true, opacity: 0.85, roughness: 0.3 }), [falls.x, fallsY + 0.09, falls.z - 1], [1, 0.65, 1]);
  pool.rotation.x = -Math.PI / 2;
  pool.castShadow = false;
  const fallingWater = instances(boxGeo, mat("#efffff", { transparent: true, opacity: 0.55 }), Array.from({ length: 20 }, (_, i) => ({ x: falls.x - 1.1 + (i % 5) * 0.53, y: fallsY + (i / 20) * 8, z: falls.z - 2.8, sx: 0.045, sy: 0.65, sz: 0.03 })), false);
  const splash = mesh(geo(new THREE.TorusGeometry(2.1, 0.055, 4, 24)), mat("#d6f6ec"), [falls.x, fallsY + 0.12, falls.z - 1], [1, 1, 1]);
  splash.rotation.x = -Math.PI / 2;
  splash.castShadow = false;
  // A walk-in rock arch frames a physical cabinet; the actual games use their existing routes.
  const arcade = REGIONS.find(r => r.id === "cavern")!.point;
  const arcadeY = terrainHeight(arcade.x, arcade.z);
  const cave: Instance[] = [];
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI / 8;
    const crown = Math.sin(a) > 0.72;
    cave.push({
      x: arcade.x + Math.cos(a) * 5.55,
      y: arcadeY + Math.sin(a) * 6.15 + (crown ? 1.05 : 0),
      z: arcade.z - 3.0,
      sx: crown ? 1.12 : 1.35,
      sy: crown ? 0.98 : 1.25,
      sz: crown ? 1.72 : 2.05,
      ry: i * 0.74,
    });
  }
  instances(rockGeo, mat("#354d58"), cave);
  for (const side of [-1, 1])
    obstacles.push({ x: arcade.x + side * 5.35, z: arcade.z - 3.0, radius: 1.25 });

  // A shallow stone floor and warm local light make the wall read as an interior,
  // not a pile of dark exterior boulders.
  mesh(boxGeo, mat("#26383e"), [arcade.x, arcadeY + 0.03, arcade.z - 4.8], [10.2, 0.12, 7.6]);
  const caveLight = new THREE.PointLight("#ffd9a6", 17, 18, 2);
  caveLight.position.set(arcade.x, arcadeY + 3.4, arcade.z - 4.3);
  scene.add(caveLight);

  // The cavern wall is the game selector: broad recessed bands carry carved names.
  mesh(boxGeo, mat("#314850"), [arcade.x, arcadeY + 3.15, arcade.z - 6.75], [10.1, 6.45, 0.72]);
  const carvingBandMaterial = mat("#24363d");
  const carvingBands: Instance[] = Array.from({ length: 3 }, (_, row) => ({
    x: arcade.x,
    y: arcadeY + 4.42 - row * 1.42,
    z: arcade.z - 6.37,
    sx: 8.35,
    sy: 1.08,
    sz: 0.06,
  }));
  const carvingBandMesh = instances(boxGeo, carvingBandMaterial, carvingBands, false);
  carvingBandMesh.userData.discoveryByInstance = ["game:0", "game:1", "game:2"];
  markerObjects.push(carvingBandMesh);
  const glyphs: Record<string, string[]> = {
    A: ["010","101","111","101","101"], C: ["111","100","100","100","111"],
    D: ["110","101","101","101","110"], E: ["111","100","110","100","111"],
    H: ["101","101","111","101","101"], I: ["111","010","010","010","111"],
    M: ["101","111","111","101","101"], N: ["101","111","111","111","101"],
    O: ["111","101","101","101","111"], P: ["110","101","110","100","100"],
    R: ["110","101","110","101","101"], S: ["111","100","111","001","111"],
    T: ["111","010","010","010","010"], U: ["101","101","101","101","111"],
  };
  const carvingTitles = (gameTitles.length ? gameTitles : ["Stretchicorn", "uniRico", "Unicorn Stampede"]).slice(0, 3);
  canvas.dataset.carvedGames = String(carvingTitles.length);
  const carvingMaterial = mat("#dec995", { emissive: "#9b7741", emissiveIntensity: 0.62, roughness: 0.85 });
  const carvingGlyphs: Instance[] = [];
  carvingTitles.forEach((title, row) => {
    const text = title.toUpperCase();
    const scale = Math.min(0.12, 6.8 / Math.max(4, text.length * 4));
    const width = text.length * 4 * scale;
    const startX = arcade.x - width / 2 + scale * 0.5;
    const baseline = arcadeY + 4.6 - row * 1.42;
    [...text].forEach((letter, index) => {
      const pattern = letter === " " ? [] : glyphs[letter];
      if (!pattern) return;
      pattern.forEach((bits, py) => [...bits].forEach((bit, px) => {
        if (bit !== "1") return;
        carvingGlyphs.push({
          x: startX + index * 4 * scale + px * scale,
          y: baseline - py * scale,
          z: arcade.z - 6.34,
          sx: scale * 0.78,
          sy: scale * 0.78,
          sz: 0.05,
        });
      }));
    });
  });
  instances(boxGeo, carvingMaterial, carvingGlyphs, false);
  // A lower frieze keeps three abstract carved glyphs distinct from the game names:
  // a horn, a branching neuron, and a mountain.
  const runeZ = arcade.z - 6.31;
  const caveRunes = [
    segment(new THREE.Vector3(arcade.x - 3.2, arcadeY + 0.42, runeZ), new THREE.Vector3(arcade.x - 2.72, arcadeY + 0.98, runeZ), 0.05),
    segment(new THREE.Vector3(arcade.x - 2.72, arcadeY + 0.98, runeZ), new THREE.Vector3(arcade.x - 2.9, arcadeY + 0.68, runeZ), 0.04),
    segment(new THREE.Vector3(arcade.x, arcadeY + 0.38, runeZ), new THREE.Vector3(arcade.x, arcadeY + 1.02, runeZ), 0.045),
    segment(new THREE.Vector3(arcade.x, arcadeY + 0.78, runeZ), new THREE.Vector3(arcade.x - 0.42, arcadeY + 1.02, runeZ), 0.04),
    segment(new THREE.Vector3(arcade.x, arcadeY + 0.78, runeZ), new THREE.Vector3(arcade.x + 0.42, arcadeY + 1.02, runeZ), 0.04),
    segment(new THREE.Vector3(arcade.x, arcadeY + 0.58, runeZ), new THREE.Vector3(arcade.x - 0.34, arcadeY + 0.42, runeZ), 0.035),
    segment(new THREE.Vector3(arcade.x, arcadeY + 0.58, runeZ), new THREE.Vector3(arcade.x + 0.34, arcadeY + 0.42, runeZ), 0.035),
    segment(new THREE.Vector3(arcade.x + 2.55, arcadeY + 0.4, runeZ), new THREE.Vector3(arcade.x + 3.05, arcadeY + 1.04, runeZ), 0.05),
    segment(new THREE.Vector3(arcade.x + 3.05, arcadeY + 1.04, runeZ), new THREE.Vector3(arcade.x + 3.58, arcadeY + 0.4, runeZ), 0.05),
  ];
  instances(cylinder, mat("#a58f68"), caveRunes, false);

  // No arcade cabinet is duplicated here; the wall itself is the portfolio/game interface.
  // Sport equipment stays lightweight but uses recognizable proportions and materials.
  const board = new THREE.Group(), bike = new THREE.Group(), skis = new THREE.Group();
  explorer.add(board, bike, skis);
  const bikeSeatLocal = { y: 1.45, z: -0.42 };
  const riderHipLocal = { y: 0.73, z: 0 };
  const bikeBodyLean = 0.16;
  const rubber = mat("#20282b"),
    metal = mat("#b7c3c5"),
    charcoal = mat("#303638"),
    forkGold = mat("#c69b38"),
    boardDeck = mat("#334047"),
    boardEdge = mat("#c07b3d"),
    skiMat = mat("#38586f");

  // Skateboard: concave deck silhouette, trucks and four distinct wheels.
  mesh(boxGeo, boardEdge, [0, 0.08, 0], [0.6, 0.08, 1.94], board);
  mesh(boxGeo, boardDeck, [0, 0.15, 0], [0.56, 0.035, 1.86], board);
  mesh(boxGeo, mat("#171d1f"), [0, 0.172, 0], [0.5, 0.012, 1.72], board);
  for (const end of [-1, 1]) {
    const kick = mesh(boxGeo, boardEdge, [0, 0.2, end * 1.04], [0.52, 0.08, 0.34], board);
    kick.rotation.x = -end * 0.28;
    const axle = mesh(cylinder, metal, [0, 0.02, end * 0.63], [0.035, 0.62, 0.035], board);
    axle.rotation.z = Math.PI / 2;
  }
  const wheelGeo = geo(new THREE.TorusGeometry(0.43, 0.075, 5, 12));
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    const wheel = mesh(wheelGeo, rubber, [side * 0.33, -0.02, end * 0.63], [0.22, 0.22, 0.22], board);
    wheel.rotation.y = Math.PI / 2;
  }

  // Stumpjumper-inspired trail bike: charcoal frame, large tires and gold fork/dropper accents.
  const bikeWheels = [-1, 1].map(end => {
    const wheel = mesh(wheelGeo, rubber, [0, 0.5, end * 0.96], [1.16, 1.16, 1.16], bike);
    wheel.rotation.y = Math.PI / 2;
    const rim = mesh(wheelGeo, metal, [0, 0.5, end * 0.96], [0.94, 0.94, 0.94], bike);
    rim.rotation.y = Math.PI / 2;
    return wheel;
  });
  const framePoints = [
    [0, 0.5, -0.96], [0, 0.56, -0.08], [0, 1.22, -0.4],
    [0, 1.12, 0.56], [0, 0.5, 0.96],
  ];
  for (const [a, b] of [[0,1],[1,2],[2,0],[2,3],[3,1]]) {
    const part = segment(new THREE.Vector3(...framePoints[a]), new THREE.Vector3(...framePoints[b]), 0.055);
    const tube = mesh(cylinder, charcoal, [part.x, part.y, part.z], [part.sx, part.sy, part.sz], bike);
    tube.quaternion.copy(part.q!);
  }
  for (const side of [-1, 1]) {
    const fork = segment(
      new THREE.Vector3(side * 0.08, 1.12, 0.56),
      new THREE.Vector3(side * 0.08, 0.5, 0.96),
      0.035,
    );
    const tube = mesh(cylinder, forkGold, [fork.x, fork.y, fork.z], [fork.sx, fork.sy, fork.sz], bike);
    tube.quaternion.copy(fork.q!);
  }
  mesh(cylinder, forkGold, [0, 1.27, -0.4], [0.045, 0.34, 0.045], bike);
  mesh(boxGeo, rubber, [0, 1.45, -0.42], [0.34, 0.09, 0.42], bike);
  mesh(boxGeo, metal, [0, 1.34, 0.62], [0.86, 0.055, 0.075], bike);
  mesh(cylinder, metal, [0, 0.55, -0.08], [0.04, 0.46, 0.04], bike).rotation.z = Math.PI / 2;
  // Rear suspension, linkage and drivetrain give the silhouette a modern trail-bike read.
  const shock = segment(
    new THREE.Vector3(0, 1.16, -0.28),
    new THREE.Vector3(0, 0.72, 0.04),
    0.045,
  );
  const shockMesh = mesh(cylinder, forkGold, [shock.x, shock.y, shock.z], [shock.sx, shock.sy, shock.sz], bike);
  shockMesh.quaternion.copy(shock.q!);
  const chainStay = segment(
    new THREE.Vector3(0, 0.55, -0.08),
    new THREE.Vector3(0, 0.5, -0.96),
    0.035,
  );
  const chainStayMesh = mesh(cylinder, charcoal, [chainStay.x, chainStay.y, chainStay.z], [chainStay.sx, chainStay.sy, chainStay.sz], bike);
  chainStayMesh.quaternion.copy(chainStay.q!);
  const chainring = mesh(geo(new THREE.TorusGeometry(0.18, 0.025, 5, 14)), metal, [0, 0.56, -0.08], [1, 1, 1], bike);
  chainring.rotation.y = Math.PI / 2;
  for (const side of [-1, 1])
    mesh(boxGeo, rubber, [side * 0.28, 0.55, -0.08], [0.28, 0.035, 0.12], bike);
  for (const end of [-1, 1]) {
    const rotor = mesh(geo(new THREE.TorusGeometry(0.23, 0.018, 4, 14)), metal, [0, 0.5, end * 0.96], [1, 1, 1], bike);
    rotor.rotation.y = Math.PI / 2;
  }

  // Skis read as separate planks with upturned tips and poles.
  for (const side of [-1, 1]) {
    mesh(boxGeo, skiMat, [side * 0.23, 0.02, 0.1], [0.19, 0.065, 2.55], skis);
    const tip = mesh(boxGeo, skiMat, [side * 0.23, 0.15, 1.48], [0.19, 0.06, 0.34], skis);
    tip.rotation.x = -0.42;
    mesh(cylinder, metal, [side * 0.61, 0.6, 0], [0.024, 1.15, 0.024], skis);
  }
  const chalk = mesh(rockGeo, mat("#c4836d"), [0, 0.83, -0.35], [0.2, 0.2, 0.14], bodyRoot);
  board.visible = bike.visible = skis.visible = chalk.visible = false;
  // Shasta uses a husky silhouette: deep chest, tapered muzzle, upright ears and curled plume tail.
  // His many coat-colored subparts are instanced so a recognizable companion does not
  // cost dozens of persistent draw calls while following the player.
  const shasta = new THREE.Group();
  scene.add(shasta);
  const shastaRockMat = mat("#ffffff");
  const shastaRockParts: Instance[] = [
    { x: 0, y: 0.78, z: -0.08, sx: 0.32, sy: 0.38, sz: 0.8, color: SHASTA_COAT.white },
    { x: 0, y: 0.97, z: -0.1, sx: 0.31, sy: 0.18, sz: 0.74, color: SHASTA_COAT.topcoat },
    { x: 0, y: 0.87, z: 0.43, sx: 0.31, sy: 0.34, sz: 0.34, color: SHASTA_COAT.gold },
    { x: 0, y: 0.91, z: -0.68, sx: 0.27, sy: 0.23, sz: 0.28, color: SHASTA_COAT.tailBase },
    { x: 0, y: 1.08, z: 0.49, sx: 0.34, sy: 0.4, sz: 0.34, color: SHASTA_COAT.white },
    { x: 0, y: 1.28, z: 0.58, sx: 0.28, sy: 0.32, sz: 0.28, color: SHASTA_COAT.gold },
    { x: 0, y: 1.43, z: 0.72, sx: 0.26, sy: 0.3, sz: 0.28, color: SHASTA_COAT.white },
    { x: 0, y: 1.36, z: 0.99, sx: 0.22, sy: 0.16, sz: 0.34, color: SHASTA_COAT.white },
    { x: 0, y: 1.34, z: 1.24, sx: 0.11, sy: 0.08, sz: 0.08, color: SHASTA_COAT.nose },
  ];
  for (const side of [-1, 1]) {
    shastaRockParts.push(
      { x: side * 0.16, y: 1.53, z: 0.84, sx: 0.1, sy: 0.14, sz: 0.1, color: SHASTA_COAT.mask },
      { x: side * 0.14, y: 1.52, z: 1.04, sx: 0.04, sy: 0.035, sz: 0.028, color: SHASTA_COAT.eye },
    );
  }
  for (const x of [-1, 1]) for (const z of [-1, 1])
    shastaRockParts.push({
      x: x * 0.2,
      y: 0.06,
      z: z * 0.52 + 0.04,
      sx: 0.11,
      sy: 0.065,
      sz: 0.16,
      color: SHASTA_COAT.white,
    });
  instances(rockGeo, shastaRockMat, shastaRockParts, true, shasta);

  const shastaEarParts: Instance[] = [];
  for (const side of [-1, 1]) {
    shastaEarParts.push(
      {
        x: side * 0.18,
        y: 1.82,
        z: 0.68,
        sx: 0.14,
        sy: 0.44,
        sz: 0.16,
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -side * 0.08)),
        color: SHASTA_COAT.gold,
      },
      {
        x: side * 0.18,
        y: 1.81,
        z: 0.72,
        sx: 0.065,
        sy: 0.24,
        sz: 0.075,
        color: SHASTA_COAT.mask,
      },
    );
  }
  instances(cone, mat("#ffffff"), shastaEarParts, true, shasta);

  const shastaCylinderParts: Instance[] = [];
  const lowerLegInstanceIndices: number[] = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const forward = z > 0;
    shastaCylinderParts.push({
      x: x * 0.2,
      y: 0.54,
      z: z * 0.44,
      sx: 0.085,
      sy: 0.4,
      sz: 0.085,
      color: forward ? SHASTA_COAT.gold : SHASTA_COAT.topcoat,
    });
    lowerLegInstanceIndices.push(shastaCylinderParts.length);
    shastaCylinderParts.push({
      x: x * 0.2,
      y: 0.25,
      z: z * 0.48,
      sx: 0.075,
      sy: 0.36,
      sz: 0.075,
      color: SHASTA_COAT.white,
    });
  }
  shastaCylinderParts.push({
    x: 0,
    y: 1.08,
    z: -0.72,
    sx: 0.11,
    sy: 0.34,
    sz: 0.11,
    q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.7, 0, 0)),
    color: SHASTA_COAT.tailBase,
  });
  const shastaCylinderMesh = instances(
    cylinder,
    mat("#ffffff"),
    shastaCylinderParts,
    true,
    shasta,
  );

  // A high, curled plume tail remains independently animated.
  const tail = mesh(
    geo(new THREE.TorusGeometry(0.39, 0.13, 6, 14, Math.PI * 1.62)),
    mat(SHASTA_COAT.white),
    [0, 1.32, -0.76],
    [1, 1, 1],
    shasta,
  );
  tail.rotation.y = Math.PI / 2;
  tail.rotation.z = 0.2;
  // A barely visible paw-print detour; the dog heads here when you approach.
  const prints: Instance[] = [];
  for (let i = 0; i < 14; i++) {
    const x = 8 + i * 0.7,
      z = 19 + i * 0.22;
    prints.push({
      x,
      y: terrainHeight(x, z) + 0.035,
      z,
      sx: 0.08,
      sy: 0.025,
      sz: 0.13,
    });
  }
  instances(rockGeo, mat("#718266"), prints, false);

  // --- Cold-water kelp forest -------------------------------------------------
  // Reparent all submerged detail under one visibility gate so land scenes do not
  // pay for hidden reef draw calls.
  const reefRoot = new THREE.Group();
  reefRoot.visible = false;
  scene.add(reefRoot);
  const reefRockMat = mat("#53645f");
  const kelpStemMat = mat("#726d2f");
  const kelpBladeMat = mat("#8a8135", { side: THREE.DoubleSide });
  const reefRocks: Instance[] = [];
  for (let i = 0; i < 58; i++) {
    const x = -74 + random() * 29, z = -24 + random() * 63;
    const floor = seaFloorHeight(x, z), size = 0.35 + random() * 1.45;
    reefRocks.push({ x, y: floor + size * 0.35, z, sx: size, sy: size * 0.7, sz: size * 1.2, ry: random() * 6 });
  }
  instances(rockGeo, reefRockMat, reefRocks, false, reefRoot);

  const kelpStems: Instance[] = [], kelpBlades: Instance[] = [];
  for (let i = 0; i < 34; i++) {
    const x = -70 + random() * 25, z = -22 + random() * 58;
    const floor = seaFloorHeight(x, z);
    const height = Math.max(2.3, SEA_SURFACE - floor - 0.5 - random() * 1.2);
    kelpStems.push({
      x, y: floor + height / 2, z,
      sx: 0.055, sy: height, sz: 0.055,
    });
    for (let blade = 0; blade < 4; blade++) {
      const y = floor + height * (0.42 + blade * 0.15);
      const a = blade * 1.7 + i;
      kelpBlades.push({
        x: x + Math.cos(a) * 0.22,
        y,
        z: z + Math.sin(a) * 0.22,
        sx: 0.22,
        sy: 0.8 + random() * 0.6,
        sz: 0.13,
        ry: a,
      });
    }
  }
  instances(cylinder, kelpStemMat, kelpStems, false, reefRoot);
  const kelpBladeGeo = geo(new THREE.ConeGeometry(1, 1, 5, 1, true));
  instances(kelpBladeGeo, kelpBladeMat, kelpBlades, false, reefRoot);

  function makeFish(kind: "anchovy" | "rockfish", color: string, size: number) {
    const group = new THREE.Group();
    const bodyMat = mat(color);
    const bodyScale: number[] =
      kind === "anchovy"
        ? [size * 0.2, size * 0.13, size * 1.2]
        : [size * 0.42, size * 0.3, size * 0.88];
    mesh(rockGeo, bodyMat, [0, 0, 0], bodyScale, group);
    const tailFin = mesh(
      cone,
      bodyMat,
      [0, 0, -size * (kind === "anchovy" ? 1.08 : 0.86)],
      [size * 0.25, size * 0.4, size * 0.11],
      group,
    );
    tailFin.rotation.x = Math.PI / 2;
    if (kind === "rockfish") {
      const dorsal = mesh(
        cone,
        bodyMat,
        [0, size * 0.28, -size * 0.05],
        [size * 0.12, size * 0.3, size * 0.14],
        group,
      );
      dorsal.rotation.x = -0.2;
    }
    reefRoot.add(group);
    return group;
  }
  const reefSwimmers: { object: THREE.Group; radius: number; speed: number; phase: number; baseY: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const kind = i < 3 ? "anchovy" : "rockfish";
    const color =
      kind === "anchovy"
        ? i % 2 ? "#b7cad0" : "#8fb7c4"
        : i % 2 ? "#d07c3b" : "#c69b52";
    const fish = makeFish(kind, color, kind === "anchovy" ? 0.3 + random() * 0.12 : 0.42 + random() * 0.16);
    const radius = 5 + random() * 17, phase = random() * Math.PI * 2;
    reefSwimmers.push({ object: fish, radius, speed: 0.16 + random() * 0.16, phase, baseY: -3.2 - random() * 4.2 });
  }
  // Leopard-shark silhouettes: long body, dorsal fin and forked tail.
  const sharks: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const shark = new THREE.Group();
    const sharkMat = mat("#7f8f86");
    mesh(rockGeo, sharkMat, [0, 0, 0], [0.46, 0.32, 1.9], shark);
    const dorsal = mesh(cone, sharkMat, [0, 0.38, -0.1], [0.22, 0.55, 0.2], shark);
    dorsal.rotation.x = -0.18;
    for (const side of [-1, 1]) {
      const fin = mesh(cone, sharkMat, [side * 0.48, -0.04, 0.2], [0.18, 0.7, 0.12], shark);
      fin.rotation.z = side * 1.2;
    }
    const tailFin = mesh(cone, sharkMat, [0, 0, -1.75], [0.45, 0.7, 0.14], shark);
    tailFin.rotation.x = Math.PI / 2;
    reefRoot.add(shark);
    sharks.push(shark);
  }
  // Rays use four-sided discs and a long tapered tail.
  const rayGeo = geo(new THREE.CircleGeometry(1, 4));
  const rays: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const rayGroup = new THREE.Group();
    const rayBody = mesh(rayGeo, mat("#687d78", { side: THREE.DoubleSide }), [0, 0, 0], [1.2, 0.65, 1], rayGroup);
    rayBody.rotation.x = Math.PI / 2;
    const rayTail = segment(new THREE.Vector3(0, 0, -0.6), new THREE.Vector3(0, 0, -2), 0.035);
    const tailMesh = mesh(cylinder, mat("#566d68"), [rayTail.x, rayTail.y, rayTail.z], [rayTail.sx, rayTail.sy, rayTail.sz], rayGroup);
    tailMesh.quaternion.copy(rayTail.q!);
    reefRoot.add(rayGroup);
    rays.push(rayGroup);
  }

  // Octopuses, eels and jellies sit close to the rocky shelf.
  const octopuses: THREE.Group[] = [];
  for (let i = 0; i < 1; i++) {
    const o = new THREE.Group();
    const octMat = mat(i ? "#9b5b4f" : "#b66c58");
    mesh(rockGeo, octMat, [0, 0.35, 0], [0.42, 0.5, 0.4], o);
    for (let arm = 0; arm < 8; arm++) {
      const a = arm * Math.PI / 4;
      const tentacle = segment(new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(Math.cos(a) * 0.72, -0.05, Math.sin(a) * 0.72), 0.055);
      const limb = mesh(cylinder, octMat, [tentacle.x, tentacle.y, tentacle.z], [tentacle.sx, tentacle.sy, tentacle.sz], o);
      limb.quaternion.copy(tentacle.q!);
    }
    const px = -46 - i * 7, pz = 8 + i * 14;
    o.position.set(px, seaFloorHeight(px, pz) + 0.32, pz);
    reefRoot.add(o); octopuses.push(o);
  }
  const eels: THREE.Group[] = [];
  for (let i = 0; i < 1; i++) {
    const eel = new THREE.Group();
    const eelMat = mat("#5b6c4c");
    for (let segIndex = 0; segIndex < 5; segIndex++)
      mesh(rockGeo, eelMat, [0, 0, segIndex * 0.34], [0.16, 0.12, 0.28], eel);
    const px = -49 + i * 5, pz = -1 + i * 16;
    eel.position.set(px, seaFloorHeight(px, pz) + 0.4, pz);
    reefRoot.add(eel); eels.push(eel);
  }
  const jellyGeo = geo(new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2));
  const jellies: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const jelly = new THREE.Group();
    const jellyMat = mat("#a7cad1", { transparent: true, opacity: 0.62, emissive: "#79aebd", emissiveIntensity: 0.12 });
    mesh(jellyGeo, jellyMat, [0, 0, 0], [0.42, 0.28, 0.42], jelly);
    for (let t = -1; t <= 1; t++) mesh(cylinder, jellyMat, [t * 0.12, -0.38, 0], [0.018, 0.72, 0.018], jelly);
    reefRoot.add(jelly); jellies.push(jelly);
  }

  // Purple urchins get a spherical core plus instanced radial spines so they
  // read as urchins rather than decorative purple stones.
  const urchins: Instance[] = [], urchinSpines: Instance[] = [];
  for (let i = 0; i < 28; i++) {
    const x = -72 + random() * 26, z = -21 + random() * 57;
    const y = seaFloorHeight(x, z) + 0.15;
    urchins.push({ x, y, z, sx: 0.18, sy: 0.18, sz: 0.18 });
    for (let spike = 0; spike < 6; spike++) {
      const angle = (spike / 6) * Math.PI * 2 + i * 0.4;
      urchinSpines.push(
        segment(
          new THREE.Vector3(x, y + 0.03, z),
          new THREE.Vector3(
            x + Math.cos(angle) * 0.28,
            y + (spike % 2 ? 0.22 : 0.1),
            z + Math.sin(angle) * 0.28,
          ),
          0.018,
        ),
      );
    }
  }
  const urchinMat = mat("#72527e");
  instances(rockGeo, urchinMat, urchins, false, reefRoot);
  instances(cylinder, urchinMat, urchinSpines, false, reefRoot);

  const seaFans: Instance[] = [], cupCorals: Instance[] = [];
  for (let i = 0; i < 16; i++) {
    const x = -68 + random() * 20, z = -18 + random() * 52;
    const floor = seaFloorHeight(x, z);
    for (let branch = 0; branch < 4; branch++) {
      const a = (branch - 1.5) * 0.35;
      seaFans.push(segment(
        new THREE.Vector3(x, floor + 0.05, z),
        new THREE.Vector3(x + Math.sin(a) * 0.8, floor + 0.8 + random() * 0.55, z + Math.cos(a) * 0.15),
        0.035,
      ));
    }
    cupCorals.push({ x: x + 0.8, y: floor + 0.18, z: z + 0.6, sx: 0.18, sy: 0.35, sz: 0.18, ry: i });
  }
  instances(cylinder, mat("#b25f4e"), seaFans, false, reefRoot);
  instances(poppyCup, mat("#e6a264", { side: THREE.DoubleSide }), cupCorals, false, reefRoot);

  // One low-cost mote field gives the water column depth and motion without a
  // postprocessing pass or texture download.
  const reefMotePositions = new Float32Array(150 * 3);
  for (let i = 0; i < 150; i++) {
    const x = -66 + random() * 24;
    const z = -17 + random() * 48;
    const floor = seaFloorHeight(x, z);
    const y = floor + 0.7 + random() * Math.max(0.8, SEA_SURFACE - floor - 1.3);
    reefMotePositions.set([x, y, z], i * 3);
  }
  const reefMoteGeo = geo(new THREE.BufferGeometry());
  reefMoteGeo.setAttribute("position", new THREE.BufferAttribute(reefMotePositions, 3));
  const reefMoteMat = new THREE.PointsMaterial({
    color: "#c9eef0",
    size: 0.055,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  materials.add(reefMoteMat);
  const reefMotes = new THREE.Points(reefMoteGeo, reefMoteMat);
  reefRoot.add(reefMotes);
  canvas.dataset.reefSpecies = "8";

  // A tiny world-space bubble field follows the swimmer. The points rise independently
  // of the character's pitch so snorkeling/diving motion reads naturally.
  const bubblePositions = new Float32Array(36 * 3);
  const bubblePhase = Array.from({ length: 36 }, () => random() * 3);
  const bubbleOffset = Array.from({ length: 36 }, () => ({
    x: (random() - 0.5) * 0.8,
    z: (random() - 0.5) * 0.8,
  }));
  const bubbleGeo = geo(new THREE.BufferGeometry());
  bubbleGeo.setAttribute("position", new THREE.BufferAttribute(bubblePositions, 3));
  const bubbleMat = new THREE.PointsMaterial({
    color: "#e8fbff",
    size: 0.075,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  materials.add(bubbleMat);
  const bubbles = new THREE.Points(bubbleGeo, bubbleMat);
  reefRoot.add(bubbles);

  // One draw call of local snowfall follows the player whenever ski mode is equipped.
  const snowPositions = new Float32Array(220 * 3);
  for (let i = 0; i < 220; i++)
    snowPositions.set([(random() - 0.5) * 46, random() * 25, (random() - 0.5) * 46], i * 3);
  const snowGeo = geo(new THREE.BufferGeometry());
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3));
  const snowMat = new THREE.PointsMaterial({ color: "#ffffff", size: 0.16, transparent: true, opacity: 0.82 });
  materials.add(snowMat);
  const snowfall = new THREE.Points(snowGeo, snowMat);
  snowfall.visible = false;
  scene.add(snowfall);

  let state: State = {
    entered: false,
    paused: false,
    command: null,
    activity: "run",
    actionSerial: 0,
    waterAction: "dive",
    waterActionSerial: 0,
  };
  let disposed = false,
    raf = 0,
    last = 0,
    elapsed = 0,
    lastSerial = -1;
  const frameSampler = new FrameSampler();
  const quality = new QualityController();
  let yaw = 0.25,
    pitch = 0.32,
    zoom = 19;
  let player: Point = { ...SPAWN },
    destination: Point | null = null;
  let travel: Travel = { point: player, speed: 0, heading: { x: 0, z: -1 } };
  let airHeight = 0, verticalSpeed = 0, lastAction = 0, lastWaterAction = 0;
  let aquatic: AquaticMode = "land", swimDepth = 0, targetDepth = 0;
  let climb: { from: Point; to: Point; fromY: number; toY: number; progress: number } | null = null;
  let grind: {
    log: typeof FALLEN_LOGS[number];
    t: number;
    direction: number;
    style: GrindStyle;
    mode: "skate" | "ski";
  } | null = null;
  let lastRampAt = -10, lastRampId = "";
  let playerY = groundHeight(player);
  explorer.rotation.order = "YXZ";
  let dog: Point = { x: 3, z: 12 };
  let dogYaw = 0;
  let dogGroundY = terrainHeight(dog.x, dog.z);
  let dogGaitPhase = 0;
  let dogMoveBlend = 0;
  let dogMaxYawStep = 0;
  let dogMaxYStep = 0;
  let dogMaxMoveBlend = 0;
  let lastDogRenderY = dogGroundY;
  let locationKey = "",
    discovery: string | null = null,
    gazeCandidate: string | null = null,
    gazeStable: string | null = null,
    gazeCandidateSince = 0,
    gazeLastSeen = 0;
  const keys = new Set<string>();
  const targetCamera = new THREE.Vector3(),
    targetLook = new THREE.Vector3();
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: "#263f37",
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  materials.add(shadowMaterial);
  const contactGeometry = geo(new THREE.CircleGeometry(1, 16));
  contactGeometry.rotateX(-Math.PI / 2);
  const explorerContact = mesh(
    contactGeometry,
    shadowMaterial,
    [0, 0, 0],
    [0.5, 1, 0.4],
  );
  explorerContact.castShadow = false;
  const dogContact = mesh(
    contactGeometry,
    shadowMaterial,
    [0, 0, 0],
    [0.5, 1, 0.85],
  );
  dogContact.castShadow = false;
  const ray = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    gazePointer = new THREE.Vector2(0, 0);
  function discoveryForHit(hit: { object: THREE.Object3D; instanceId?: number }) {
    const direct = hit.object.userData.discovery as string | undefined;
    const byInstance = hit.object.userData.discoveryByInstance as string[] | undefined;
    return typeof hit.instanceId === "number"
      ? (byInstance?.[hit.instanceId] ?? direct)
      : direct;
  }
  let drag: {
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    id: number;
    moved: boolean;
  } | null = null;
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (state.paused) renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  function onDown(e: PointerEvent) {
    if (!state.entered || state.paused) return;
    canvas.focus({ preventScroll: true });
    drag = {
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      id: e.pointerId,
      moved: false,
    };
    canvas.setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5)
      drag.moved = true;
    if (drag.moved) {
      yaw -= (e.clientX - drag.lastX) * 0.005;
      pitch = THREE.MathUtils.clamp(
        pitch + (e.clientY - drag.lastY) * 0.003,
        0.22,
        0.95,
      );
    }
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
  }
  function onUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const wasClick = !drag.moved;
    drag = null;
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    if (!wasClick || state.paused) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const marker = ray.intersectObjects(markerObjects)[0];
    if (marker && marker.distance < 55) {
      const discoveryId = discoveryForHit(marker);
      if (discoveryId?.startsWith("game:")) {
        if (distance(player, arcade) < 8) callbacks.onInteract(discoveryId);
        else destination = { ...arcade };
        return;
      }
      const point = markerData.find((m) => m.id === discoveryId);
      if (point) {
        if (distance(player, point.point) < 7) callbacks.onInteract(point.id);
        else destination = { ...point.point };
        return;
      }
    }
    const hit = ray.intersectObjects([ground, ...climbRocks])[0];
    if (hit)
      destination = {
        x: THREE.MathUtils.clamp(hit.point.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
        z: THREE.MathUtils.clamp(hit.point.z, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ),
      };
  }
  function cancelPointer() {
    drag = null;
  }
  function onWheel(e: WheelEvent) {
    if (!state.entered || state.paused) return;
    e.preventDefault();
    zoom = THREE.MathUtils.clamp(zoom + e.deltaY * 0.015, 11, 28);
  }
  function onKey(e: KeyboardEvent) {
    if (!state.entered || state.paused || e.metaKey || e.ctrlKey || e.altKey)
      return;
    if (e.target !== canvas) return;
    const key = e.key.toLowerCase();
    if (key === "shift") keys.add(key);
    if (key === " " && !e.repeat && aquatic === "land") {
      e.preventDefault();
      performAction();
    }
    if (key === "v" && !e.repeat && aquatic !== "land") {
      e.preventDefault();
      applyWaterAction(aquatic === "dive" ? "surface" : "dive");
    }
    if (aquatic === "dive" && !e.repeat && (key === "q" || key === "e")) {
      e.preventDefault();
      applyWaterAction(key === "q" ? "deeper" : "shallower");
    }
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(key)
    ) {
      keys.add(key);
      destination = null;
      e.preventDefault();
    }
    if (key === "enter" && !e.repeat && discovery) {
      e.preventDefault();
      callbacks.onInteract(discovery);
    }
  }
  function keyUp(e: KeyboardEvent) {
    keys.delete(e.key.toLowerCase());
  }
  function setAquaticMode(next: AquaticMode) {
    if (next === aquatic) return;
    aquatic = next;
    callbacks.onAquatic(next);
  }
  function applyWaterAction(action: State["waterAction"]) {
    if (aquatic === "land") return;
    const available = maxDiveDepth(player);
    if (action === "dive" && aquatic === "surface" && available > 0.8) {
      targetDepth = Math.min(1.1, available);
      setAquaticMode("dive");
    } else if (action === "deeper" && aquatic === "dive") {
      targetDepth = Math.min(available, targetDepth + 1.35);
    } else if (action === "shallower" && aquatic === "dive") {
      targetDepth = Math.max(0.45, targetDepth - 1.35);
    } else if (action === "surface") {
      targetDepth = 0;
    }
  }
  function performAction() {
    if (!state.entered || state.paused || document.hidden || aquatic !== "land" || climb || grind || airHeight > 0.01) return;
    if ((state.activity === "skate" || state.activity === "ski") && travel.speed > 2.2) {
      const candidate = nearestGrind(player);
      if (candidate) {
        const dx = candidate.log.b.x - candidate.log.a.x;
        const dz = candidate.log.b.z - candidate.log.a.z;
        const lengthSquared = dx * dx + dz * dz;
        const future = {
          x: player.x + travel.heading.x,
          z: player.z + travel.heading.z,
        };
        const futureT = THREE.MathUtils.clamp(
          ((future.x - candidate.log.a.x) * dx +
            (future.z - candidate.log.a.z) * dz) /
            lengthSquared,
          0,
          1,
        );
        const direction =
          Math.abs(futureT - candidate.t) > 0.01
            ? futureT >= candidate.t
              ? 1
              : -1
            : travel.heading.x * dx + travel.heading.z * dz >= 0
              ? 1
              : -1;
        player = { ...candidate.point };
        grind = {
          log: candidate.log,
          t: candidate.t,
          direction,
          style: grindStyleForApproach(travel.heading, candidate.log),
          mode: state.activity,
        };
        destination = null;
        verticalSpeed = airHeight = 0;
        return;
      }
    }
    if (state.activity === "boulder") {
      const hold = nextHold(player);
      if (hold) {
        climb = { from: { ...player }, to: hold, fromY: groundHeight(player), toY: groundHeight(hold), progress: 0 };
        destination = null;
        travel.speed = 0;
        return;
      }
    }
    verticalSpeed = state.activity === "boulder" ? 7 : 5;
  }
  function clearInput() {
    keys.clear();
    travel.speed = 0;
    drag = null;
    destination = null;
  }
  function visibility() {
    clearInput();
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else schedule();
  }
  function contextLost(e: Event) {
    e.preventDefault();
    callbacks.onError();
  }
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", cancelPointer);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  canvas.addEventListener("blur", clearInput);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", clearInput);
  document.addEventListener("visibilitychange", visibility);
  canvas.addEventListener("webglcontextlost", contextLost);
  function schedule() {
    if (!disposed && !state.paused && !document.hidden && !raf) {
      frameSampler.reset();
      quality.reset();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }
  function frame(now: number) {
    raf = 0;
    if (disposed || document.hidden || state.paused) return;
    const rawDelta = (now - last) / 1000,
      dt = Math.min(rawDelta, 0.05);
    last = now;
    elapsed += dt;
    let dx = 0,
      dz = 0;
    if (state.entered) {
      const forward =
        Number(keys.has("w") || keys.has("arrowup")) -
        Number(keys.has("s") || keys.has("arrowdown"));
      const right =
        Number(keys.has("d") || keys.has("arrowright")) -
        Number(keys.has("a") || keys.has("arrowleft"));
      dx = -Math.sin(yaw) * forward + Math.cos(yaw) * right;
      dz = -Math.cos(yaw) * forward - Math.sin(yaw) * right;
      if (destination) {
        dx = destination.x - player.x;
        dz = destination.z - player.z;
        if (Math.hypot(dx, dz) < 0.3) {
          destination = null;
          travel.speed = 0;
          dx = 0;
          dz = 0;
        }
      }
      const previousPoint = { ...player };
      const previousY = playerY;
      if (climb) {
        climb.progress = Math.min(1, climb.progress + dt * 1.25);
        const t = climb.progress * climb.progress * (3 - 2 * climb.progress);
        player = {
          x: climb.from.x + (climb.to.x - climb.from.x) * t,
          z: climb.from.z + (climb.to.z - climb.from.z) * t,
        };
        playerY = climb.fromY + (climb.toY - climb.fromY) * t + Math.sin(t * Math.PI) * 0.7;
        explorer.rotation.y = Math.atan2(climb.to.x - climb.from.x, climb.to.z - climb.from.z);
        if (climb.progress === 1) climb = null;
        travel = { ...travel, point: player, speed: 0 };
      } else if (grind) {
        const dxLog = grind.log.b.x - grind.log.a.x;
        const dzLog = grind.log.b.z - grind.log.a.z;
        const logLength = Math.hypot(dxLog, dzLog);
        const grindSpeed = Math.max(4.2, travel.speed);
        grind.t += grind.direction * grindSpeed * dt / logLength;
        const finished = grind.t <= 0 || grind.t >= 1;
        grind.t = THREE.MathUtils.clamp(grind.t, 0, 1);
        player = {
          x: grind.log.a.x + dxLog * grind.t,
          z: grind.log.a.z + dzLog * grind.t,
        };
        const headingSign = grind.direction;
        travel = {
          point: player,
          speed: grindSpeed * 0.995,
          heading: { x: (dxLog / logLength) * headingSign, z: (dzLog / logLength) * headingSign },
        };
        const railGround =
          terrainHeight(grind.log.a.x, grind.log.a.z) * (1 - grind.t) +
          terrainHeight(grind.log.b.x, grind.log.b.z) * grind.t;
        playerY = railGround + grind.log.lift + 0.16;
        if (finished) {
          grind = null;
          airHeight = 0.08;
          verticalSpeed = 2.5;
        }
      } else if (aquatic !== "land") {
        const nextTravel = stepSwim(
          { ...travel, point: player },
          { x: dx, z: dz },
          rawDelta,
          destination,
        );
        if (!isWater(nextTravel.point)) {
          if (aquatic === "surface") {
            travel = nextTravel;
            player = nextTravel.point;
            swimDepth = targetDepth = 0;
            setAquaticMode("land");
            playerY = groundHeight(player);
          } else {
            travel = { ...travel, point: player, speed: 0 };
            targetDepth = 0;
          }
        } else {
          travel = nextTravel;
          player = travel.point;
          const availableDepth = maxDiveDepth(player);
          targetDepth = THREE.MathUtils.clamp(targetDepth, 0, availableDepth);
          if (aquatic === "dive") {
            const depthStep = 2.1 * dt;
            swimDepth += THREE.MathUtils.clamp(targetDepth - swimDepth, -depthStep, depthStep);
            if (targetDepth <= 0.05 && swimDepth <= 0.12) {
              swimDepth = 0;
              setAquaticMode("surface");
            }
          } else {
            swimDepth = targetDepth = 0;
          }
          playerY = SEA_SURFACE - (aquatic === "dive" ? Math.max(0.52, swimDepth) : 0.42);
        }
      } else {
        travel = stepTravel(
          { ...travel, point: player },
          { x: dx, z: dz },
          dt,
          state.activity,
          obstacles,
          keys.has("shift"),
          destination,
          airHeight,
        );
        if (
          destination &&
          (distance(travel.point, destination) < 0.3 ||
            (travel.speed === 0 && distance(player, destination) > 0.3))
        ) destination = null;
        player = travel.point;

        if (isWater(player)) {
          const steppedIn = !isWater(previousPoint) && airHeight < 0.12;
          if (steppedIn) {
            setAquaticMode("surface");
            swimDepth = targetDepth = 0;
            airHeight = verticalSpeed = 0;
            playerY = SEA_SURFACE - 0.42;
          } else {
            verticalSpeed -= dt * 12;
            playerY = previousY + verticalSpeed * dt;
            airHeight = Math.max(0, playerY - SEA_SURFACE);
            if (playerY <= SEA_SURFACE - 0.05) {
              setAquaticMode("surface");
              swimDepth = targetDepth = 0;
              airHeight = verticalSpeed = 0;
              playerY = SEA_SURFACE - 0.42;
            }
          }
        } else {
          verticalSpeed -= dt * 14;
          airHeight = Math.max(0, airHeight + verticalSpeed * dt);
          if (airHeight === 0) verticalSpeed = 0;
          playerY = groundHeight(player) + airHeight;
          const modeForRamp = effectiveActivity(state.activity, player);
          if (airHeight === 0 && elapsed - lastRampAt > 1.1) {
            const ramp = rampImpulseAt(player, travel.heading, modeForRamp, travel.speed);
            if (ramp && ramp.id !== lastRampId) {
              lastRampAt = elapsed;
              lastRampId = ramp.id;
              verticalSpeed = ramp.impulse;
              airHeight = 0.03;
            } else if (!ramp) {
              lastRampId = "";
            }
          }
        }
      }

      const mode = effectiveActivity(state.activity, player);
      const swimming = aquatic !== "land";
      const walking = travel.speed > 0.05
        ? Math.sin(elapsed * (swimming ? 9 : mode === "run" ? 14 : 10))
        : 0;
      board.visible = !swimming && mode === "skate";
      bike.visible = !swimming && mode === "bike";
      skis.visible = !swimming && mode === "ski";
      chalk.visible = !swimming && mode === "boulder";
      snorkel.visible = swimming;
      const running = !swimming && (mode === "run" || mode === "boulder");
      const headingYaw = travel.speed > 0.05
        ? Math.atan2(travel.heading.x, travel.heading.z)
        : explorer.rotation.y;

      if (swimming) {
        bodyRoot.position.set(0, 0, 0);
        bodyRoot.rotation.set(0, 0, 0);
        const kick = travel.speed > 0.05 ? Math.sin(elapsed * 8.5) : 0;
        legs[0].rotation.x = 0.18 + kick * 0.42;
        legs[1].rotation.x = 0.18 - kick * 0.42;
        arms[0].rotation.x = -1.45 + walking * 0.34;
        arms[1].rotation.x = -1.45 - walking * 0.34;
        // Local +Z is the explorer's forward direction. Positive X pitch points
        // the face/mask toward the ocean floor; the previous negative sign looked skyward.
        const pronePitch = aquatic === "dive" ? 1.36 : 1.5;
        explorer.rotation.set(
          pronePitch,
          headingYaw,
          Math.sin(elapsed * 1.2) * (aquatic === "dive" ? 0.035 : 0.055),
        );
        explorer.position.set(
          player.x,
          playerY + (aquatic === "surface" ? Math.sin(elapsed * 2.1) * 0.035 : 0),
          player.z,
        );
      } else {
        const bikePose = mode === "bike";
        bodyRoot.position.set(
          0,
          bikePose
            ? bikeSeatLocal.y - riderHipLocal.y * Math.cos(bikeBodyLean)
            : 0,
          bikePose
            ? bikeSeatLocal.z -
              (riderHipLocal.y * Math.sin(bikeBodyLean) +
                riderHipLocal.z * Math.cos(bikeBodyLean))
            : 0,
        );
        bodyRoot.rotation.set(bikePose ? bikeBodyLean : 0, 0, 0);
        legs[0].rotation.x = running ? walking * 0.6 : bikePose ? 0.58 + walking * 0.28 : 0.2;
        legs[1].rotation.x = running ? -walking * 0.6 : bikePose ? 0.58 - walking * 0.28 : 0.2;
        arms[0].rotation.x = climb ? -2 : running ? -walking * 0.4 : bikePose ? 0.82 : -0.75;
        arms[1].rotation.x = climb ? -1.6 : running ? walking * 0.4 : bikePose ? 0.82 : -0.75;
        const footprint = mode === "bike"
          ? { length: 1.05, width: 0.55 }
          : mode === "skate"
            ? { length: 1.1, width: 0.42 }
            : mode === "ski"
              ? { length: 1.35, width: 0.46 }
              : { length: 0.25, width: 0.2 };
        const contact = terrainContact(player, travel.heading, footprint.length, footprint.width);
        const gearMode = mode === "bike" || mode === "skate" || mode === "ski";
        const supportLift =
          gearMode && airHeight <= 0.001 && !climb && !grind
            ? Math.max(0, contact.support - terrainHeight(player.x, player.z))
            : 0;
        const pitchAngle = running || climb ? 0 : contact.pitch;
        const rollAngle =
          (gearMode ? contact.roll : 0) +
          (mode === "skate" ? Math.sin(elapsed * 2) * Math.min(travel.speed * 0.006, 0.06) : 0);
        explorer.rotation.set(pitchAngle, headingYaw, rollAngle);
        if (grind) {
          const logDx = grind.log.b.x - grind.log.a.x;
          const logDz = grind.log.b.z - grind.log.a.z;
          const logLength = Math.max(1e-6, Math.hypot(logDx, logDz));
          const alongX = (logDx / logLength) * grind.direction;
          const alongZ = (logDz / logLength) * grind.direction;
          const logYaw = Math.atan2(alongX, alongZ);
          const groundA = terrainHeight(grind.log.a.x, grind.log.a.z);
          const groundB = terrainHeight(grind.log.b.x, grind.log.b.z);
          const logPitch = -Math.atan2(
            (groundB - groundA) * grind.direction,
            logLength,
          );
          explorer.rotation.set(
            logPitch,
            logYaw + (grind.style === "boardslide" ? Math.PI / 2 : 0),
            grind.style === "boardslide" ? 0.06 : 0,
          );
        }
        bikeWheels.forEach(wheel => wheel.rotation.z += travel.speed * dt / 0.43);
        explorer.position.set(
          player.x,
          playerY + supportLift +
            (mode === "skate" ? 0.18 : mode === "bike" ? 0.2 : mode === "ski" ? 0.08 : 0) +
            (running ? Math.abs(walking) * 0.045 : 0),
          player.z,
        );
      }
      canvas.dataset.activity = mode;
      canvas.dataset.speed = travel.speed.toFixed(2);
      canvas.dataset.height = playerY.toFixed(2);
      canvas.dataset.airborne = String(airHeight > 0 || !!climb || !!grind);
      canvas.dataset.aquatic = aquatic;
      canvas.dataset.depth = swimDepth.toFixed(2);
      canvas.dataset.maxDepth = maxDiveDepth(player).toFixed(2);
      const grindCandidate =
        aquatic === "land" &&
        (mode === "skate" || mode === "ski") &&
        !grind &&
        airHeight < 0.1 &&
        travel.speed > 2.2
          ? nearestGrind(player)
          : undefined;
      const candidateGrindStyle = grindCandidate
        ? grindStyleForApproach(travel.heading, grindCandidate.log)
        : null;
      canvas.dataset.grindReady = String(!!grindCandidate);
      canvas.dataset.grindId = grind?.log.id ?? "";
      canvas.dataset.grindStyle = grind?.style ?? candidateGrindStyle ?? "";
      canvas.dataset.rampId = lastRampId;
      canvas.dataset.grinding = String(!!grind);
      canvas.dataset.surfacePitch = explorer.rotation.x.toFixed(3);
      canvas.dataset.surfaceRoll = explorer.rotation.z.toFixed(3);
      canvas.dataset.gearClearance = (
        aquatic === "land"
          ? explorer.position.y - groundHeight(player)
          : 0
      ).toFixed(3);
      const riderHipY =
        bodyRoot.position.y +
        riderHipLocal.y * Math.cos(bodyRoot.rotation.x) -
        riderHipLocal.z * Math.sin(bodyRoot.rotation.x);
      const riderHipZ =
        bodyRoot.position.z +
        riderHipLocal.y * Math.sin(bodyRoot.rotation.x) +
        riderHipLocal.z * Math.cos(bodyRoot.rotation.x);
      canvas.dataset.riderSeatError = (
        mode === "bike"
          ? Math.hypot(
              riderHipY - bikeSeatLocal.y,
              riderHipZ - bikeSeatLocal.z,
            )
          : 0
      ).toFixed(3);
      const r: RegionId = isWater(player) ? "coast" : nearestRegion(player);
      let rawGazeGame: string | null = null;
      const cavernCameraSettled =
        camera.position.distanceTo(targetCamera) < 1.35 &&
        look.distanceTo(targetLook) < 0.65;
      if (
        aquatic === "land" &&
        r === "cavern" &&
        distance(player, arcade) < 10 &&
        cavernCameraSettled
      ) {
        ray.setFromCamera(gazePointer, camera);
        const gazeHit = ray
          .intersectObjects(markerObjects, false)
          .find(hit => String(discoveryForHit(hit) ?? "").startsWith("game:"));
        if (gazeHit && gazeHit.distance < 45)
          rawGazeGame = discoveryForHit(gazeHit) ?? null;
      }
      if (rawGazeGame !== gazeCandidate) {
        gazeCandidate = rawGazeGame;
        gazeCandidateSince = now;
      }
      if (rawGazeGame) {
        gazeLastSeen = now;
        if (now - gazeCandidateSince >= 260)
          gazeStable = rawGazeGame;
      } else if (gazeStable && now - gazeLastSeen > 450) {
        gazeStable = null;
      }
      if (r !== "cavern" || aquatic !== "land") {
        gazeCandidate = gazeStable = null;
        gazeCandidateSince = gazeLastSeen = now;
      }
      const gazeGame = gazeStable;
      canvas.dataset.gazeGame = gazeGame ?? "";
      discovery = aquatic === "land" ? (gazeGame ?? nearbyDiscovery(player)) : null;
      const nextKey = `${r}:${discovery}`;
      if (nextKey !== locationKey) {
        locationKey = nextKey;
        callbacks.onLocation(r, discovery);
      }
      const cavernFraming =
        aquatic === "land" && r === "cavern" && distance(player, arcade) < 10;
      if (cavernFraming) {
        targetLook.set(arcade.x, arcadeY + 3.25, arcade.z - 6.3);
      } else {
        const aquaticLookAhead = aquatic === "land" ? 0 : aquatic === "dive" ? 3.2 : 2.2;
        targetLook.set(
          player.x + travel.heading.x * aquaticLookAhead,
          playerY + (aquatic === "dive" ? 0.55 : aquatic === "surface" ? 1.2 : 2.8),
          player.z + travel.heading.z * aquaticLookAhead,
        );
      }
      const cameraZoom =
        aquatic === "dive"
          ? Math.min(zoom, 13.5)
          : aquatic === "surface"
            ? Math.min(zoom, 14)
            : mode === "bike" || mode === "skate"
              ? Math.min(zoom, 16)
              : mode === "boulder"
                ? Math.min(zoom, 15)
                : zoom;
      const cameraYaw = aquatic === "dive" ? yaw + 0.28 : yaw;
      targetCamera.set(
        player.x + Math.sin(cameraYaw) * cameraZoom * Math.cos(pitch),
        targetLook.y + cameraZoom * Math.sin(pitch),
        player.z + Math.cos(cameraYaw) * cameraZoom * Math.cos(pitch),
      );
      // Keep a trunk from obscuring the explorer on land.
      if (aquatic === "land") {
        const bx = targetCamera.x - player.x,
          bz = targetCamera.z - player.z;
        let boom = 1;
        for (const o of obstacles) {
          const t =
            ((o.x - player.x) * bx + (o.z - player.z) * bz) / (bx * bx + bz * bz);
          if (
            t > 0.08 &&
            t < boom &&
            Math.hypot(player.x + bx * t - o.x, player.z + bz * t - o.z) <
              o.radius + 0.75
          ) boom = Math.max(0.25, t - 0.15);
        }
        if (boom < 1) targetCamera.lerpVectors(targetLook, targetCamera, boom);
        targetCamera.y = Math.max(
          targetCamera.y,
          worldFloorHeight(targetCamera.x, targetCamera.z) + 3.5,
        );
      } else if (aquatic === "surface") {
        targetCamera.y = Math.min(targetCamera.y, SEA_SURFACE + 4.8);
      } else if (aquatic === "dive") {
        // Preserve a useful third-person boom underwater. If the requested orbit
        // places the camera beneath the beach, mirror that horizontal boom offshore
        // rather than collapsing it onto the diver.
        const cameraDx = targetCamera.x - player.x;
        const cameraDz = targetCamera.z - player.z;
        if (!isWater({ x: targetCamera.x, z: targetCamera.z })) {
          const mirrored = {
            x: player.x - cameraDx,
            z: player.z - cameraDz,
          };
          if (isWater(mirrored)) {
            targetCamera.x = mirrored.x;
            targetCamera.z = mirrored.z;
          } else {
            const horizontalBoom = Math.max(7.5, Math.hypot(cameraDx, cameraDz) * 0.88);
            targetCamera.x = player.x - horizontalBoom;
            targetCamera.z = player.z + THREE.MathUtils.clamp(cameraDz * 0.2, -3, 3);
          }
          if (!isWater({ x: targetCamera.x, z: targetCamera.z }))
            targetCamera.x = coastlineX(targetCamera.z) - 1.3;
        }
        const floor = seaFloorHeight(targetCamera.x, targetCamera.z);
        targetCamera.y = THREE.MathUtils.clamp(
          targetCamera.y,
          floor + 1.05,
          SEA_SURFACE - 0.28,
        );
      }
      canvas.dataset.cameraWater = String(
        aquatic !== "dive" || isWater({ x: targetCamera.x, z: targetCamera.z }),
      );
      canvas.dataset.cameraDistance = Math.hypot(
        targetCamera.x - player.x,
        targetCamera.z - player.z,
      ).toFixed(2);
    } else {
      explorer.position.set(SPAWN.x, terrainHeight(SPAWN.x, SPAWN.z), SPAWN.z);
      explorer.rotation.y = -0.5;
      targetCamera.set(42 + Math.sin(elapsed * 0.035) * 1.5, 36, 86);
      targetLook.set(-12, 6, -12);
    }
    const shoreWait = {
      x: coastlineX(player.z) + 2.6,
      z: THREE.MathUtils.clamp(player.z, WORLD_BOUNDS.minZ + 4, WORLD_BOUNDS.maxZ - 4),
    };
    const dogTarget = state.entered
      ? aquatic !== "land" || isWater(player)
        ? shoreWait
        : distance(player, SECRET) < 13
          ? SECRET
          : { x: player.x + 2.7, z: player.z - 2.7 }
      : { x: 4 + Math.sin(elapsed * 0.13) * 2, z: 12 };
    const dogDelta = distance(dog, dogTarget);
    const dogBefore = { ...dog };
    let desiredDogYaw = dogYaw;
    if (dogDelta > 0.7) {
      const speed = Math.min(dt * Math.max(6, travel.speed + 2), dogDelta);
      desiredDogYaw = Math.atan2(dogTarget.x - dog.x, dogTarget.z - dog.z);
      const candidate = constrainMove(
        dog,
        {
          x: dog.x + Math.sin(desiredDogYaw) * speed,
          z: dog.z + Math.cos(desiredDogYaw) * speed,
        },
        obstacles,
      );
      if (!isWater(candidate)) dog = candidate;
    }
    const yawDelta = Math.atan2(
      Math.sin(desiredDogYaw - dogYaw),
      Math.cos(desiredDogYaw - dogYaw),
    );
    // Bound actual angular velocity rather than only easing toward the target.
    // This stays visually continuous even when a slow frame or obstacle causes
    // the desired heading to flip sharply.
    const maxDogTurnStep = Math.min(0.18, 4.2 * Math.max(0, Math.min(dt, 0.05)));
    const appliedDogYawStep = Math.max(
      -maxDogTurnStep,
      Math.min(maxDogTurnStep, yawDelta),
    );
    dogYaw += appliedDogYawStep;
    dogYaw = Math.atan2(Math.sin(dogYaw), Math.cos(dogYaw));
    dogMaxYawStep = Math.max(dogMaxYawStep, Math.abs(appliedDogYawStep));
    shasta.rotation.y = dogYaw;
    const dogStep = distance(dogBefore, dog);
    dogGaitPhase += dogStep * 5.4;
    const movingTarget = dogStep > 0.001 ? 1 : 0;
    dogMoveBlend += (movingTarget - dogMoveBlend) * (1 - Math.exp(-dt * 7));
    dogMaxMoveBlend = Math.max(dogMaxMoveBlend, dogMoveBlend);
    const targetDogY = terrainHeight(dog.x, dog.z);
    const dogGroundError = targetDogY - dogGroundY;
    const maxDogGroundStep = Math.min(0.1, 2.4 * Math.max(0, Math.min(dt, 0.05)));
    dogGroundY += Math.max(
      -maxDogGroundStep,
      Math.min(maxDogGroundStep, dogGroundError),
    );
    const dogBob = Math.sin(dogGaitPhase * 2) * 0.022 * dogMoveBlend;
    const dogRenderY = dogGroundY + dogBob;
    dogMaxYStep = Math.max(dogMaxYStep, Math.abs(dogRenderY - lastDogRenderY));
    lastDogRenderY = dogRenderY;
    shasta.position.set(dog.x, dogRenderY, dog.z);
    canvas.dataset.dogYaw = dogYaw.toFixed(3);
    canvas.dataset.dogY = dogRenderY.toFixed(3);
    canvas.dataset.dogMoveBlend = dogMoveBlend.toFixed(3);
    canvas.dataset.dogGaitPhase = dogGaitPhase.toFixed(3);
    canvas.dataset.dogMaxYawStep = dogMaxYawStep.toFixed(3);
    canvas.dataset.dogMaxYStep = dogMaxYStep.toFixed(3);
    canvas.dataset.dogMaxMoveBlend = dogMaxMoveBlend.toFixed(3);
    explorerContact.visible = aquatic === "land";
    explorerContact.position.set(
      explorer.position.x,
      aquatic === "land" ? groundHeight(player) + 0.04 : SEA_SURFACE,
      explorer.position.z,
    );
    dogContact.position.set(dog.x, terrainHeight(dog.x, dog.z) + 0.04, dog.z);
    const dogLegPhases = [0, Math.PI, Math.PI, 0];
    lowerLegInstanceIndices.forEach((instanceIndex, i) => {
      const part = shastaCylinderParts[instanceIndex];
      dummy.position.set(part.x, part.y, part.z);
      dummy.scale.set(part.sx, part.sy, part.sz);
      dummy.rotation.set(
        Math.sin(dogGaitPhase + dogLegPhases[i]) * 0.2 * dogMoveBlend,
        0,
        0,
      );
      dummy.updateMatrix();
      shastaCylinderMesh.setMatrixAt(instanceIndex, dummy.matrix);
    });
    shastaCylinderMesh.instanceMatrix.needsUpdate = true;
    tail.rotation.z =
      0.2 + Math.sin(elapsed * 2.2) * 0.07 + Math.sin(dogGaitPhase) * 0.05 * dogMoveBlend;
    camera.position.lerp(targetCamera, 1 - Math.exp(-dt * 3.6));
    look.lerp(targetLook, 1 - Math.exp(-dt * 4));
    camera.lookAt(look);

    // Underwater color and fog are stateful atmosphere, not a separate scene.
    const underwater = aquatic === "dive";
    reefRoot.visible = aquatic !== "land";
    shasta.visible = !underwater;
    dogContact.visible = !underwater;
    waterMaterial.opacity = underwater ? 0.48 : aquatic === "surface" ? 0.58 : 0.76;
    if (scene.background instanceof THREE.Color) scene.background.set(underwater ? "#0b6170" : "#67b7ef");
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(underwater ? "#196b72" : "#c4e2f1");
      scene.fog.near = underwater ? 7 : 85;
      scene.fog.far = underwater ? 58 : 270;
    }

    // Ski-mode snowfall follows the player anywhere in the world.
    snowfall.visible = state.activity === "ski" && aquatic !== "dive";
    canvas.dataset.snowing = String(snowfall.visible);
    canvas.dataset.reef = String(reefRoot.visible);
    if (snowfall.visible) {
      snowfall.position.set(player.x, playerY - 4, player.z);
      const snowAttribute = snowGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < snowAttribute.count; i++) {
        let y = snowAttribute.getY(i) - dt * (3.8 + (i % 7) * 0.42);
        if (y < 0) y += 25;
        snowAttribute.setY(i, y);
      }
      snowAttribute.needsUpdate = true;
    }

    // Reef animals move on simple deterministic paths so the coast feels alive.
    // Skip all aquatic animation work while the reef group is hidden on land.
    if (reefRoot.visible) {
      reefSwimmers.forEach((swimmer, i) => {
        const a = elapsed * swimmer.speed + swimmer.phase;
        swimmer.object.position.set(
          -51 + Math.cos(a) * swimmer.radius * 0.72,
          swimmer.baseY + Math.sin(a * 1.8 + i) * 0.55,
          10 + Math.sin(a) * swimmer.radius * 0.58,
        );
        swimmer.object.rotation.y = -a + Math.PI / 2;
      });
      sharks.forEach((shark, i) => {
        const a = elapsed * (0.1 + i * 0.018) + i * 2.2;
        const centerX = i === 0 ? -49 : -57;
        const radiusX = i === 0 ? 8.5 : 11.5;
        const radiusZ = i === 0 ? 11 : 17;
        shark.position.set(
          centerX + Math.cos(a) * radiusX,
          -4.2 - i * 1.1,
          10 + Math.sin(a) * radiusZ,
        );
        shark.rotation.y = -a + Math.PI / 2;
        shark.rotation.z = Math.sin(a * 2) * 0.04;
      });
      rays.forEach((rayGroup, i) => {
        const a = elapsed * (0.08 + i * 0.012) + i * 1.7;
        const centerX = i === 0 ? -47 : -55;
        const radiusX = i === 0 ? 6 : 9;
        const radiusZ = i === 0 ? 8 : 12;
        rayGroup.position.set(
          centerX + Math.cos(a) * radiusX,
          -5.1 - i * 0.6 + Math.sin(a * 2) * 0.35,
          11 + Math.sin(a) * radiusZ,
        );
        rayGroup.rotation.y = -a + Math.PI / 2;
        rayGroup.rotation.z = Math.sin(elapsed * 1.7 + i) * 0.09;
      });
      octopuses.forEach((o, i) => {
        o.rotation.y = Math.sin(elapsed * 0.42 + i) * 0.28;
        o.position.y += Math.sin(elapsed * 0.9 + i) * 0.0008;
      });
      eels.forEach((eel, i) => {
        eel.rotation.y = Math.sin(elapsed * 1.25 + i * 1.8) * 0.28;
        eel.rotation.x = Math.sin(elapsed * 0.8 + i) * 0.05;
      });
      jellies.forEach((jelly, i) => {
        const a = i * 1.9;
        jelly.position.set(
          -45 - (i % 3) * 4 + Math.sin(elapsed * 0.19 + a) * 2,
          -3.2 - (i % 2) * 2 + Math.sin(elapsed * 0.65 + a) * 0.75,
          5 + i * 6,
        );
        jelly.scale.y = 0.92 + Math.sin(elapsed * 1.8 + i) * 0.08;
      });

      reefMotes.rotation.y = Math.sin(elapsed * 0.08) * 0.018;
      reefMotes.position.y = Math.sin(elapsed * 0.22) * 0.05;
      const bubbleAttribute = bubbleGeo.attributes.position;
      for (let i = 0; i < bubbleAttribute.count; i++) {
        const rise = (elapsed * 0.72 + bubblePhase[i]) % 2.8;
        bubbleAttribute.setXYZ(
          i,
          player.x + bubbleOffset[i].x,
          playerY + 1.15 + rise,
          player.z + bubbleOffset[i].z,
        );
      }
      bubbleAttribute.needsUpdate = true;
    }
    bubbles.visible = reefRoot.visible;

    // Detail culling: distant grass and synaptic particles need no GPU work.
    grassMesh.visible = camera.position.y < 45 && aquatic === "land";
    fireflies.visible = !state.entered || player.x > 8;
    fireflies.position.y = Math.sin(elapsed * 0.4) * 0.12;
    neuralMat.emissiveIntensity = 0.4 + Math.sin(elapsed * 0.65) * 0.18;
    particleMat.opacity = 0.48 + Math.sin(elapsed) * 0.17;
    tides.position.x = Math.sin(elapsed * 0.2) * 0.5;
    shoreFoam.position.x = Math.sin(elapsed * 0.7) * 0.11;
    shoreFoam.position.y = Math.sin(elapsed * 1.25) * 0.018;
    shoreFoamMat.opacity = 0.52 + Math.sin(elapsed * 0.9) * 0.08;
    fallingWater.position.y = -(elapsed * 3.5 % 0.4);
    splash.scale.setScalar(1 + Math.sin(elapsed * 2) * 0.05);
    waterfall.scale.x = 2.5 + Math.sin(elapsed * 3) * 0.06;
    renderer.render(scene, camera);
    const metrics = frameSampler.add(rawDelta);
    if (metrics) {
      const { fps } = metrics;
      canvas.dataset.frameP50 = metrics.p50.toFixed(2);
      canvas.dataset.frameP95 = metrics.p95.toFixed(2);
      canvas.dataset.sampleFrames = String(metrics.frames);
      canvas.dataset.fps = fps.toFixed(0);
      canvas.dataset.drawCalls = String(renderer.info.render.calls);
      canvas.dataset.triangles = String(renderer.info.render.triangles);
      let visibleRenderables = 0;
      scene.traverseVisible((object) => {
        if (object instanceof THREE.Mesh ||
            object instanceof THREE.InstancedMesh ||
            object instanceof THREE.Points)
          visibleRenderables++;
      });
      canvas.dataset.visibleRenderables = String(visibleRenderables);
      canvas.dataset.player = `${player.x.toFixed(1)},${player.z.toFixed(1)}`;
      const nextDpr = quality.update(fps, dpr);
      if (nextDpr !== dpr) {
        dpr = nextDpr;
        renderer.setPixelRatio(dpr);
      }
      // DPR reduction is the first quality lever. If sustained load has already
      // pushed us to the floor, stop paying for the full shadow pass too.
      const shouldUseShadows = dpr > 0.75 || fps >= 24;
      if (adaptiveShadows !== shouldUseShadows) {
        adaptiveShadows = shouldUseShadows;
        renderer.shadowMap.enabled = adaptiveShadows;
        sun.castShadow = adaptiveShadows;
        if (adaptiveShadows) renderer.shadowMap.needsUpdate = true;
      }
      canvas.dataset.shadows = adaptiveShadows ? "on" : "off";
      canvas.dataset.dpr = dpr.toFixed(2);
    }
    raf = requestAnimationFrame(frame);
  }
  // Scenery is static; avoid redrawing its shadow map every animation frame.
  explorer.traverse((o) => {
    o.castShadow = false;
  });
  shasta.traverse((o) => {
    o.castShadow = false;
  });
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  callbacks.onAquatic("land");
  callbacks.onReady();
  schedule();
  return {
    setState(next) {
      const wasEntered = state.entered,
        wasPaused = state.paused;
      const changedActivity = next.activity !== state.activity;
      const requestedAction = next.actionSerial !== lastAction;
      const requestedWaterAction = next.waterActionSerial !== lastWaterAction;
      if (changedActivity) {
        clearInput();
        climb = null;
        grind = null;
        airHeight = verticalSpeed = 0;
      }
      state = next;
      if (next.entered && !wasEntered) {
        // Welcome mode has its own ambient dog wandering. Gait continuity metrics
        // judge entered-world following, so start that measurement at the moment
        // exploration begins instead of carrying welcome-transition motion forward.
        dogMaxYawStep = 0;
        dogMaxYStep = 0;
        dogMaxMoveBlend = 0;
        lastDogRenderY = shasta.position.y;
      }
      if (next.entered && !next.paused && (changedActivity || requestedAction || requestedWaterAction))
        canvas.focus({ preventScroll: true });
      if (next.actionSerial !== lastAction) {
        lastAction = next.actionSerial;
        performAction();
      }
      if (next.waterActionSerial !== lastWaterAction) {
        lastWaterAction = next.waterActionSerial;
        applyWaterAction(next.waterAction);
      }
      if (next.entered && (!wasEntered || (wasPaused && !next.paused)))
        canvas.focus({ preventScroll: true });
      if (next.command && next.command.serial !== lastSerial) {
        lastSerial = next.command.serial;
        const r = REGIONS.find((r) => r.id === next.command!.region)!;
        player =
          (next.command.activity && activityLanding(next.command.activity)) ||
          regionLanding(r.id);
        clearInput();
        travel = { point: player, speed: 0, heading: { x: 0, z: -1 } };
        airHeight = verticalSpeed = swimDepth = targetDepth = 0;
        climb = null;
        grind = null;
        setAquaticMode("land");
        playerY = groundHeight(player);
        dog = { x: player.x + 2, z: player.z - 2 };
        dogGroundY = terrainHeight(dog.x, dog.z);
        dogMoveBlend = 0;
        dogMaxYawStep = 0;
        dogMaxYStep = 0;
        dogMaxMoveBlend = 0;
        lastDogRenderY = dogGroundY;
        destination = null;
        if (next.command.activity === "ski") {
          const kicker = RIDE_RAMPS.find((ramp) => ramp.id === "ski-kicker")!;
          const approachX = kicker.point.x - player.x;
          const approachZ = kicker.point.z - player.z;
          yaw = Math.atan2(-approachX, -approachZ);
        } else {
          yaw =
            r.id === "cavern"
              ? 0
              : r.id === "coast"
                ? 1.15
                : r.id === "neural"
                  ? -0.6
                  : 0.25;
        }
        if (r.id === "cavern") {
          pitch = 0.22;
          zoom = Math.min(zoom, 16);
        }
        // Menu-driven semantic travel closes a dialog whose focus-restoration
        // target is the menu trigger. Exploration should immediately regain
        // keyboard authority after the jump.
        if (next.entered && !next.paused) canvas.focus({ preventScroll: true });
      }
      if (state.paused) {
        clearInput();
        cancelAnimationFrame(raf);
        raf = 0;
      } else schedule();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", cancelPointer);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("blur", clearInput);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost);
      scene.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
