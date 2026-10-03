import { FrameSampler, QualityController } from "@/lib/world/performance";
import * as THREE from "three/src/Three.Core.js";
import type { WebGLRenderer } from "three/src/renderers/WebGLRenderer.js";
import {
  constrainMove,
  distance,
  MEMORY_POINTS,
  nearestRegion,
  nearbyDiscovery,
  REGIONS,
  SECRET,
  SPAWN,
  terrainHeight,
  type Obstacle,
  type Point,
  type RegionId,
  type WorldCommand,
} from "@/lib/world/model";

type Callbacks = {
  onReady: () => void;
  onError: () => void;
  onLocation: (r: RegionId, d: string | null) => void;
  onInteract: (d: string) => void;
};
type State = {
  entered: boolean;
  paused: boolean;
  command: WorldCommand | null;
};
export type WorldRuntime = {
  setState: (state: State) => void;
  dispose: () => void;
};
const UP = new THREE.Vector3(0, 1, 0);

/** All art is deterministic geometry; no texture, model, physics or postprocessing downloads. */
export function createWorld(
  host: HTMLElement,
  callbacks: Callbacks,
  Renderer: typeof WebGLRenderer,
): WorldRuntime {
  const renderer = new Renderer({
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute(
    "aria-label",
    "Explore Sid’s world. Use arrow keys or WASD to walk, drag to look, Enter to discover, and M for the menu.",
  );
  host.appendChild(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#a3bfbc");
  scene.fog = new THREE.Fog("#a3bfbc", 45, 185);
  const camera = new THREE.PerspectiveCamera(47, 1, 0.15, 360);
  camera.position.set(46, 32, 62);
  const look = new THREE.Vector3(-1, 7, -5);
  camera.lookAt(look);
  scene.add(new THREE.HemisphereLight("#e6f3dc", "#435a62", 2.3));
  const sun = new THREE.DirectionalLight("#ffe0a0", 3.4);
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
    scene.add(mesh);
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
  // A continuous walkable patch: vertex colors draw trails into the terrain itself.
  const terrain = geo(new THREE.PlaneGeometry(124, 128, 90, 90));
  terrain.rotateX(-Math.PI / 2);
  terrain.translate(13, 0, -10);
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
    let y = terrainHeight(x, z);
    if (x < -35) y -= Math.pow((-35 - x) * 0.28, 1.4);
    pos.setY(i, y);
    const trail = Math.min(
      ...REGIONS.slice(1).map((r) =>
        lineDistance(x, z, REGIONS[0].point, r.point),
      ),
    );
    groundColor.set(
      x < -29 ? "#b7b39a" : y > 6 ? "#8c9b86" : x > 21 ? "#426960" : "#6e8460",
    );
    if (trail < 1.7 || distance({ x, z }, REGIONS[0].point) < 4)
      groundColor.set("#b6a684");
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
  const water = mesh(
    geo(new THREE.PlaneGeometry(430, 420)),
    mat("#5f9faa", { roughness: 0.5, metalness: 0.15 }),
    [-140, -1.4, -90],
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
  // Far granite silhouettes and snowcaps: shapes remain legible through the haze.
  const peaks: Instance[] = [],
    snow: Instance[] = [];
  for (let i = 0; i < 12; i++) {
    const x = -35 + i * 10,
      z = -108 - random() * 35,
      h = 20 + random() * 27;
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
  // Decorative boulders are low enough to step over; tree trunks have collision.
  instances(rockGeo, rockMat, boulders);
  const trunks: Instance[] = [],
    branches: Instance[] = [],
    crowns: Instance[] = [],
    roots: Instance[] = [];
  const obstacles: Obstacle[] = [];
  const trees = [
    { x: -10, z: 6, h: 31, r: 1.8 },
    { x: 9, z: 1, h: 35, r: 2 },
    { x: -5, z: -7, h: 38, r: 2.1 },
    { x: 17, z: 15, h: 27, r: 1.5 },
    { x: -13, z: 23, h: 30, r: 1.7 },
  ];
  for (let i = 0; i < 34; i++) {
    const x = -25 + random() * 71,
      z = -40 + random() * 80;
    if (
      REGIONS.some((r) => distance(r.point, { x, z }) < 9) ||
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
  instances(rockGeo, leafMat, crowns);
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
  // Four stone markers, and three low viewpoint stones. Only nearby discoveries show UI.
  const markerData = [
    ...REGIONS.map((r) => ({ id: r.id, point: r.point })),
    ...MEMORY_POINTS.map((m) => ({ id: m.id, point: m.point })),
  ];
  const markerObjects: THREE.Mesh[] = [];
  markerData.forEach((m, i) => {
    const x = m.point.x,
      z = m.point.z,
      y = terrainHeight(x, z);
    const stone = mesh(
      boxGeo,
      rockMat,
      [x, y + 0.68, z],
      [i < 4 ? 0.75 : 0.6, 1.35, 0.55],
    );
    stone.rotation.y = -0.25;
    stone.userData.discovery = m.id;
    markerObjects.push(stone);
    const inset = mesh(
      boxGeo,
      i === 2 ? neuralMat : lightMat,
      [x, y + 1.4, z],
      [0.52, 0.06, 0.4],
    );
    inset.rotation.y = -0.25;
  });
  // Explorer silhouette: ochre jacket, little backpack, dark cap. No skeletal payload.
  const explorer = new THREE.Group();
  scene.add(explorer);
  const jacket = mat("#d09a4f"),
    dark = mat("#233f48"),
    skin = mat("#b58668"),
    pack = mat("#48685e");
  mesh(cylinder, jacket, [0, 1.1, 0], [0.34, 0.69, 0.28], explorer);
  mesh(rockGeo, skin, [0, 1.69, 0], [0.27, 0.31, 0.26], explorer);
  mesh(cylinder, dark, [0, 1.93, 0], [0.29, 0.13, 0.28], explorer);
  mesh(boxGeo, pack, [0, 1.16, -0.27], [0.48, 0.54, 0.25], explorer);
  const legs = [-1, 1].map((side) =>
    mesh(boxGeo, dark, [side * 0.16, 0.39, 0], [0.19, 0.72, 0.23], explorer),
  );
  const arms = [-1, 1].map((side) =>
    mesh(cylinder, jacket, [side * 0.38, 1.03, 0], [0.12, 0.6, 0.12], explorer),
  );
  // Shasta: pale coat, pointed ears, darker saddle and a curled tail.
  const shasta = new THREE.Group();
  scene.add(shasta);
  const fur = mat("#eee9d7"),
    saddle = mat("#839493"),
    nose = mat("#263c43");
  mesh(rockGeo, fur, [0, 0.65, 0], [0.36, 0.43, 0.65], shasta);
  mesh(rockGeo, saddle, [0, 0.85, -0.08], [0.32, 0.22, 0.5], shasta);
  mesh(rockGeo, fur, [0, 1.01, 0.6], [0.32, 0.35, 0.3], shasta);
  mesh(rockGeo, fur, [0, 0.91, 0.87], [0.22, 0.17, 0.26], shasta);
  mesh(rockGeo, nose, [0, 0.94, 1.06], [0.1, 0.08, 0.06], shasta);
  [-1, 1].forEach((s) => {
    mesh(cone, saddle, [s * 0.22, 1.36, 0.53], [0.17, 0.4, 0.2], shasta);
    mesh(rockGeo, nose, [s * 0.17, 1.08, 0.83], [0.035, 0.035, 0.035], shasta);
  });
  const paws = [-1, 1].flatMap((x) =>
    [-1, 1].map((z) =>
      mesh(
        cylinder,
        fur,
        [x * 0.22, 0.28, z * 0.4],
        [0.085, 0.5, 0.085],
        shasta,
      ),
    ),
  );
  const tail = mesh(
    geo(new THREE.TorusGeometry(0.27, 0.1, 5, 9, Math.PI * 1.5)),
    fur,
    [0, 0.95, -0.66],
    [1, 1, 1],
    shasta,
  );
  tail.rotation.y = Math.PI / 2;
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

  let state: State = { entered: false, paused: false, command: null };
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
  let dog: Point = { x: 3, z: 12 };
  let locationKey = "",
    discovery: string | null = null;
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
    pointer = new THREE.Vector2();
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
      const point = markerData.find(
        (m) => m.id === marker.object.userData.discovery,
      )!;
      if (distance(player, point.point) < 7) callbacks.onInteract(point.id);
      else destination = { ...point.point };
      return;
    }
    const hit = ray.intersectObject(ground)[0];
    if (hit)
      destination = {
        x: THREE.MathUtils.clamp(hit.point.x, -34, 42),
        z: THREE.MathUtils.clamp(hit.point.z, -40, 36),
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
    const key = e.key.toLowerCase();
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
    if ((key === "enter" || key === " ") && e.target === canvas && discovery) {
      e.preventDefault();
      callbacks.onInteract(discovery);
    }
  }
  function keyUp(e: KeyboardEvent) {
    keys.delete(e.key.toLowerCase());
  }
  function clearInput() {
    keys.clear();
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
          dx = 0;
          dz = 0;
        }
      }
      const length = Math.hypot(dx, dz);
      if (length > 0.01) {
        const next = constrainMove(
          player,
          {
            x: player.x + (dx / length) * dt * 4.7,
            z: player.z + (dz / length) * dt * 4.7,
          },
          obstacles,
        );
        if (destination && distance(next, player) < 0.003) destination = null;
        player = next;
        explorer.rotation.y = Math.atan2(dx, dz);
      }
      const walking = length > 0.01 ? Math.sin(elapsed * 11) : 0;
      legs[0].rotation.x = walking * 0.5;
      legs[1].rotation.x = -walking * 0.5;
      arms[0].rotation.x = -walking * 0.35;
      arms[1].rotation.x = walking * 0.35;
      explorer.position.set(
        player.x,
        terrainHeight(player.x, player.z) + Math.abs(walking) * 0.04,
        player.z,
      );
      const r = nearestRegion(player);
      discovery = nearbyDiscovery(player);
      const nextKey = `${r}:${discovery}`;
      if (nextKey !== locationKey) {
        locationKey = nextKey;
        callbacks.onLocation(r, discovery);
      }
      targetLook.set(
        player.x,
        terrainHeight(player.x, player.z) + 2.8,
        player.z,
      );
      targetCamera.set(
        player.x + Math.sin(yaw) * zoom * Math.cos(pitch),
        targetLook.y + zoom * Math.sin(pitch),
        player.z + Math.cos(yaw) * zoom * Math.cos(pitch),
      );
      // Keep a trunk from obscuring the explorer: shorten the camera boom at contact.
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
        )
          boom = Math.max(0.25, t - 0.15);
      }
      if (boom < 1) targetCamera.lerpVectors(targetLook, targetCamera, boom);
      targetCamera.y = Math.max(
        targetCamera.y,
        terrainHeight(targetCamera.x, targetCamera.z) + 3.5,
      );
    } else {
      explorer.position.set(SPAWN.x, terrainHeight(SPAWN.x, SPAWN.z), SPAWN.z);
      explorer.rotation.y = -0.5;
      targetCamera.set(46 + Math.sin(elapsed * 0.035) * 1.5, 32, 62);
      targetLook.set(-1, 7, -5);
    }
    const dogTarget = state.entered
      ? distance(player, SECRET) < 13
        ? SECRET
        : { x: player.x + 2.7, z: player.z - 2.7 }
      : { x: 4 + Math.sin(elapsed * 0.13) * 2, z: 12 };
    const dogDelta = distance(dog, dogTarget);
    if (dogDelta > 0.7) {
      const speed = Math.min(dt * 4, dogDelta);
      const angle = Math.atan2(dogTarget.x - dog.x, dogTarget.z - dog.z);
      dog = constrainMove(
        dog,
        {
          x: dog.x + Math.sin(angle) * speed,
          z: dog.z + Math.cos(angle) * speed,
        },
        obstacles,
      );
      shasta.rotation.y = angle;
    }
    shasta.position.set(dog.x, terrainHeight(dog.x, dog.z), dog.z);
    explorerContact.position.set(
      explorer.position.x,
      terrainHeight(explorer.position.x, explorer.position.z) + 0.04,
      explorer.position.z,
    );
    dogContact.position.set(dog.x, terrainHeight(dog.x, dog.z) + 0.04, dog.z);
    paws.forEach(
      (p, i) =>
        (p.rotation.x =
          dogDelta > 0.7 ? Math.sin(elapsed * 12 + i * Math.PI) * 0.35 : 0),
    );
    tail.rotation.z = Math.sin(elapsed * 4) * 0.15;
    camera.position.lerp(targetCamera, 1 - Math.exp(-dt * 3.6));
    look.lerp(targetLook, 1 - Math.exp(-dt * 4));
    camera.lookAt(look);
    // Detail culling: distant grass and synaptic particles need no GPU work.
    grassMesh.visible = camera.position.y < 45;
    fireflies.visible = !state.entered || player.x > 8;
    fireflies.position.y = Math.sin(elapsed * 0.4) * 0.12;
    neuralMat.emissiveIntensity = 0.4 + Math.sin(elapsed * 0.65) * 0.18;
    particleMat.opacity = 0.48 + Math.sin(elapsed) * 0.17;
    tides.position.x = Math.sin(elapsed * 0.2) * 0.5;
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
      canvas.dataset.player = `${player.x.toFixed(1)},${player.z.toFixed(1)}`;
      const nextDpr = quality.update(fps, dpr);
      if (nextDpr !== dpr) {
        dpr = nextDpr;
        renderer.setPixelRatio(dpr);
      }
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
  callbacks.onReady();
  schedule();
  return {
    setState(next) {
      const wasEntered = state.entered,
        wasPaused = state.paused;
      state = next;
      if (next.entered && (!wasEntered || (wasPaused && !next.paused)))
        canvas.focus({ preventScroll: true });
      if (next.command && next.command.serial !== lastSerial) {
        lastSerial = next.command.serial;
        const r = REGIONS.find((r) => r.id === next.command!.region)!;
        player = { x: r.point.x, z: r.point.z + 3 };
        dog = { x: player.x + 2, z: player.z - 2 };
        destination = null;
        yaw = r.id === "coast" ? 1.15 : r.id === "neural" ? -0.6 : 0.25;
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
