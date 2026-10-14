import { desertTrackTreadBlend, desertTrackSampleAt, DESERT_GAP_DEBRIS, DESERT_JUMPS, DESERT_TRACK_LENGTH } from "@/lib/world/desertTrack";
import {SKATE_PARK,SKATE_PARK_RAILS,skateParkSurface,insideSkatePark} from "@/lib/world/skatepark";
import {skateLean} from "@/lib/world/skateDynamics";
import {idleSkateTrick,startSkateTrick,finishSkateTrick,setSkateGrab,skateTrickPose,flickTrick,scoreSkateGrind,queueSkateSpin,startSkateManual,stepSkateManual,finishSkateManual,type SkateTrickName,type SkateTrickState} from "@/lib/world/skateTricks";
import { JOSHUA_GATES, armJoshuaTrial, abortJoshuaTrial, tickJoshuaTrial, type TrialState } from "@/lib/world/trials";
import { createFishGeometry, createFishBodyGeometry, createCaudalFinGeometry, createDorsalFinGeometry, createPectoralFinGeometry, createSharkGeometry, createRayWingGeometry } from "./worldFaunaGeometry";
import { createReefGarden } from "./worldReef";
import { createTechnicalGeometry } from "./worldTechnicalGeometry";
import { createBigAirBirds } from "./worldBigAirBirds";
import { createDiscGolfGeometry } from "./worldDiscGolfGeometry";
import {createJetSkiDock,type JetSkiWakePoint} from "./worldJetSkiDock";
import {jetSkiPierHeight,nearJetSkiBoarding,JET_SKI_PIER} from "@/lib/world/jetSkiPier";
import {discGolfSurfaceHeight,discGolfSurfaceIsWater} from "@/lib/world/discGolfSurface";
import {jetSkiWaterSample} from "@/lib/world/jetSkiWater";
import {jetSkiControlInput} from "@/lib/world/jetSkiControls";
import {isBoostActivity,initialRideBoost,fireRideBoost,
 activeRideBoost,RIDE_BOOST_DURATION} from "@/lib/world/rideBoost";
import {JOSHUA_GHOSTS,joshuaRacePlace,joshuaPlayerFraction} from "@/lib/world/joshuaGhostRace";
import {createRideChallengeGeometry} from "./worldRideChallengeGeometry";
import {CameraVisibilityField,type CameraVolume} from "@/lib/world/cameraVisibility";
import {createJetSkiCoastGeometry} from "./worldJetSkiCourseGeometry";
import {jetSkiSectionName} from "@/lib/world/jetSkiCourse";
import {canStartWorldGame,type WorldGameMode} from "@/lib/world/gameMode";
import {JET_SKI_DOCK,JET_SKI_GATES,startJetSkiRace,stepJetSkiRace,jetSkiNavigableWater,jetSkiGateDistance,jetSkiBearingToGate,jetSkiOpponentInput,jetSkiRacePlace,type JetSkiState} from "@/lib/world/jetSkiRace";
import {
  DISC_GOLF_HOLES,discGolfOpeningClearance,discGolfCourseClearance,discGolfBasketPosition,discGolfNextTarget,discGolfThrowCameraPose,discGolfIntroPose,discGolfThrow,stepDiscGolf,
  startDiscGolf,idleDiscGolf,type DiscGolfState,type DiscShot,
  type DiscGolfSwingStage,
} from "@/lib/world/discGolf";
import {
  BIG_AIR,bigAirBirdCallout,bigAirCrossedLip,launchBigAir,mountainJumpEligible,mountainSkiTakeoff,mountainJumpOutwardGain,
  advanceBigAir,mountainJumpCameraPose,armBigAir,idleBigAir,type BigAirState,
} from "@/lib/world/bigAir";
import { createMarineSchools } from "./worldSchools";
import { createWorldTridents } from "./worldTridents";
import { nearbyUnderwaterTrident } from "@/lib/world/artifacts";
import { createHabitats } from "./worldHabitats";
import { ringSurface, ribbon } from "./worldGeometry";
import { drainagePoints, downstreamPoints, waterfallProfile, waterfallCrownRings } from "@/lib/world/hydrology";
import { biomeAt, BIOME_COLORS } from "@/lib/world/biomes";
import { stepAirborne, rampSurface, sportClearance, activityLanding, BOULDER_HOLDS, effectiveActivity, FALLEN_LOGS, grindStyleForApproach, groundHeight, nearestGrind, nextHold, onSnow, rampImpulseCrossing, RIDE_RAMPS, stepSwim, stepTravel, terrainContact, type Activity, type AquaticMode, type GrindStyle, type GrindRail, type Travel } from "@/lib/world/activities";
import { LAND_WILDLIFE, LAND_WILDLIFE_COLORS } from "@/lib/world/ecology";
import {stepCritterLocomotion} from "@/lib/world/landWildlifeMotion";
import { SHASTA_CHARACTER } from "@/lib/world/shastaCharacter";
import { FrameSampler, QualityController } from "@/lib/world/performance";
import { shastaDetour, initialChaseState, stepChase, gaitBlendForSpeed, smoothAngle, smoothPoint, smoothingAlpha, steerShastaVelocity } from "@/lib/world/shastaMotion";
import {idleFetchRunRoute,stepFetchRunRoute,steerFetchRun} from "@/lib/world/shastaFetchRun";
import {advanceShastaStride,shastaGaitPose,shastaStraightLeg} from "@/lib/world/shastaGait";
import {shastaCameraShot,stepShastaCameraAnchor,type ShastaCameraAnchor} from "@/lib/world/shastaCamera";
import {idleShastaSnowPlay,queueShastaSnowPlay,stepShastaSnowPlay,shastaSnowPose} from "@/lib/world/shastaPersonality";
import {idleDiscGolfFetch,startDiscGolfFetch,stepDiscGolfFetch,discGolfFetchCameraPhase,discGolfHandoffTarget} from "@/lib/world/discGolfFetch";
import * as THREE from "three/src/Three.Core.js";
import worldStyles from "./world.module.css";
import type { WebGLRenderer } from "three/src/renderers/WebGLRenderer.js";
import {
  ARCADE_CAVE,
  arcadeAccessTerrainMask,
  arcadeCaveFloorHeight,
  arcadeInside,
  shastaWaitsAtArcadeEntrance,
  paperCaveFloorHeight,
  paperCaveInside,
  paperCaveHalfWidth,
  caveObstacles,
  caveHalfWidth,
  mountainSurfaceHeight,
  nextCaveLayer,
  supportLayerAtPoint,
  constrainMove,
  distance,
  MEMORY_POINTS,
  WILDLIFE_DISCOVERIES,
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
  type CaveLayer,
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
  onChallenge: (trial:TrialState) => void;
  onBigAir: (flight:BigAirState) => void;
  onDiscGolf:(game:DiscGolfState)=>void;
  onJetSkiMode:(active:boolean)=>void;
};
type State = {
  activity: Activity;
  actionSerial: number;
  challengeSerial: number;
  bigAirSerial: number;
  discGolfStartSerial:number;
  discGolfHoleIndex:number;
  discGolfShotSerial:number;
  discGolfShot:DiscShot|null;
  discGolfPreview:DiscShot|null;
  discGolfExitSerial:number;
  discGolfSwingStage:DiscGolfSwingStage;
  discGolfSwingAmount:number;
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
  const rideHud=document.createElement("div");
  rideHud.className=worldStyles.rideBoostHud;
  rideHud.setAttribute("aria-label","Land sports target boost");
  rideHud.style.display="none";
  host.appendChild(rideHud);
  const skateHud=document.createElement("div");
  skateHud.setAttribute("aria-label","Skateboarding tricks and line score");
  skateHud.setAttribute("role","status");
  skateHud.style.cssText="display:none;position:absolute;bottom:14px;left:50%;transform:translateX(-50%);z-index:7;pointer-events:none;max-width:94%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:7px 13px;border-radius:10px;background:#12242bd9;color:#eef7f4;border:1px solid #bed9cc70;font:600 12px/1.3 system-ui,sans-serif;text-align:center";
  host.appendChild(skateHud);
  const skateTouch=document.createElement("div");
  skateTouch.setAttribute("aria-label","Skateboarding touch tricks");
  skateTouch.style.cssText="display:none;position:absolute;right:14px;bottom:66px;z-index:9;gap:7px";
  host.appendChild(skateTouch);
  for(const [name,label] of [["Ollie","POP"],["Kickflip","FLIP"],["Pop Shuvit","SHUV"]] as const){
    const button=document.createElement("button");
    button.textContent=label;button.type="button";button.setAttribute("aria-label",name);
    button.style.cssText="border:1px solid #e2ebed99;border-radius:12px;background:#183c44d9;color:#fff;padding:12px;font:700 13px system-ui,sans-serif;touch-action:manipulation";
    button.addEventListener("click",()=>launchSkateTrick(name));
    skateTouch.appendChild(button);
  }
  const rideReticle=document.createElement("div");
  rideReticle.className=worldStyles.rideBoostReticle;
  rideReticle.setAttribute("aria-hidden","true");
  rideReticle.style.display="none";host.appendChild(rideReticle);
  const rideAnnounce=document.createElement("span");
  rideAnnounce.style.cssText="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
  rideAnnounce.setAttribute("role","status");rideAnnounce.setAttribute("aria-live","polite");
  host.appendChild(rideAnnounce);
  const jetHud=document.createElement('div');
  jetHud.setAttribute('aria-label','Jet ski race status');
  jetHud.className=worldStyles.jetSkiHud;
  jetHud.style.display="none";
  host.appendChild(jetHud);
  const jetHudReadout=document.createElement("span");jetHud.appendChild(jetHudReadout);
  const jetTurboBar=document.createElement("div");
  jetTurboBar.setAttribute("role","progressbar");
  jetTurboBar.setAttribute("aria-label","Jet ski boost charge");
  jetTurboBar.setAttribute("aria-valuemin","0");
  jetTurboBar.setAttribute("aria-valuemax","100");
  jetTurboBar.style.cssText="display:none;height:5px;background:#ffffff44;border-radius:3px;margin-top:5px;overflow:hidden";
  const jetTurboFill=document.createElement("div");
  jetTurboFill.style.cssText="height:100%;width:100%;background:#91edcb;transition:width .1s linear";
  jetTurboBar.appendChild(jetTurboFill);jetHud.appendChild(jetTurboBar);
  const jetAnnounce=document.createElement('div');
  jetAnnounce.setAttribute('aria-live','polite');
  jetAnnounce.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
  host.appendChild(jetAnnounce);
  const jetNotice=document.createElement("div");
  jetNotice.setAttribute("role","status");
  jetNotice.style.cssText="display:none;position:absolute;top:18%;left:50%;transform:translateX(-50%);z-index:8;pointer-events:none;max-width:88%;padding:9px 17px;border-radius:12px;background:#153947b8;border:1px solid #ffffff55;color:white;text-align:center;font:700 18px/1.4 system-ui,sans-serif;text-shadow:0 1px 3px #10252f";
  host.appendChild(jetNotice);
  // Native DOM controls keep touch input separate from the world canvas and
  // never steal pointer drags used by exploration.
  const jetTouchEnabled=window.matchMedia("(pointer: coarse)").matches;
  const jetTouch=document.createElement("div");
  jetTouch.setAttribute("aria-label","Jet ski touch controls");
  jetTouch.className=worldStyles.jetSkiTouchControls;
  jetTouch.style.display="none";
  const jetTouchInput={throttle:0,steer:0,brake:false};
  const makeJetButton=(label:string)=>{
    const button=document.createElement("button");
    button.type="button";button.textContent=label;
    button.className=worldStyles.jetSkiTouchButton;
    jetTouch.appendChild(button);return button;
  };
  const jetBoardButton=makeJetButton("Ride");
  const jetLeftButton=makeJetButton("←");
  const jetThrottleButton=makeJetButton("Throttle");
  const jetBrakeButton=makeJetButton("Reverse / Brake");
  const jetBoostButton=makeJetButton("BOOST");
  const jetBoostState={active:false};
  const jetRightButton=makeJetButton("→");
  const jetDockButton=makeJetButton("Dock");
  const jetRetryButton=makeJetButton("Retry");
  const driveButtons=[jetLeftButton,jetThrottleButton,jetBrakeButton,
    jetBoostButton,jetRightButton,jetDockButton,jetRetryButton];
  for(const [i,button] of [jetLeftButton,jetThrottleButton,jetRightButton,
    jetBrakeButton,jetBoostButton,jetDockButton,jetRetryButton].entries()){
    button.style.order=String(i+1);
  }
  const holdJetButton=(button:HTMLButtonElement,press:()=>void,release:()=>void)=>{
    button.addEventListener("pointerdown",e=>{
      e.preventDefault();e.stopPropagation();press();
      button.setPointerCapture(e.pointerId);
    });
    button.addEventListener("pointerup",release);
    button.addEventListener("pointercancel",release);
    button.addEventListener("lostpointercapture",release);
    // Space/Enter must behave as hold controls for keyboard and switch users.
    button.addEventListener("keydown",e=>{
      if((e.key===" "||e.key==="Enter")&&!e.repeat){
        e.preventDefault();press();
      }
    });
    button.addEventListener("keyup",e=>{
      if(e.key===" "||e.key==="Enter"){e.preventDefault();release();}
    });
    button.addEventListener("blur",release);
  };
  holdJetButton(jetLeftButton,()=>{jetTouchInput.steer=-1;},()=>{jetTouchInput.steer=0;});
  holdJetButton(jetRightButton,()=>{jetTouchInput.steer=1;},()=>{jetTouchInput.steer=0;});
  holdJetButton(jetThrottleButton,()=>{jetTouchInput.throttle=1;},()=>{jetTouchInput.throttle=0;});
  holdJetButton(jetBoostButton,()=>{jetBoostState.active=true;},()=>{jetBoostState.active=false;});
  holdJetButton(jetBrakeButton,()=>{jetTouchInput.throttle=-1;jetTouchInput.brake=true;},
    ()=>{jetTouchInput.throttle=0;jetTouchInput.brake=false;});
  jetBoardButton.addEventListener("click",()=>openJetChooser());
  jetDockButton.addEventListener("click",()=>stopJetSki());
  jetRetryButton.addEventListener("click",()=>restartJetSki());
  host.appendChild(jetTouch);
  const jetChooser=document.createElement("div");
  jetChooser.setAttribute("role","dialog");
  jetChooser.setAttribute("aria-modal","true");
  jetChooser.setAttribute("aria-label","Choose a jet ski");
  jetChooser.className=worldStyles.jetSkiChooser;
  jetChooser.hidden=true;
  const jetChooserTitle=document.createElement("h2");
  jetChooserTitle.textContent="Choose your ride";
  jetChooserTitle.className=worldStyles.jetSkiChooserTitle;
  jetChooser.appendChild(jetChooserTitle);
  const jetChooserHint=document.createElement("p");
  jetChooserHint.textContent="Choose the experience you want on the water.";
  jetChooserHint.className=worldStyles.jetSkiChooserHint;
  jetChooser.appendChild(jetChooserHint);
  const jetChoicesGrid=document.createElement("div");
  jetChoicesGrid.className=worldStyles.jetSkiChoiceGrid;
  jetChooser.appendChild(jetChoicesGrid);
  const jetChoiceButtons:[HTMLButtonElement,string][]=[];
  for(const [label,detail,id] of [
    ["Touring","Relaxed speed · easy turning","touring"],
    ["Sport","Balanced acceleration and handling","sport"],
    ["Race","Highest speed · sharper challenge","race"],
    ["Free ride","Explore the coastline without a race","free"],
  ]){
    const button=document.createElement("button");
    button.type="button";
    button.dataset.kind=id;
    button.className=worldStyles.jetSkiChoice;
    const headline=document.createElement("strong");
    headline.textContent=label;
    const hint=document.createElement("small");
    hint.textContent=detail;
    button.append(headline,hint);
    button.addEventListener("click",()=>chooseJetSki(id));
    jetChoicesGrid.appendChild(button);
    jetChoiceButtons.push([button,id]);
  }
  const cancelJetChooserButton=document.createElement("button");
  cancelJetChooserButton.type="button";cancelJetChooserButton.textContent="Stay on pier";
  cancelJetChooserButton.className=worldStyles.jetSkiChooserCancel;
  cancelJetChooserButton.addEventListener("click",()=>closeJetChooser());
  jetChooser.appendChild(cancelJetChooserButton);
  jetChooser.addEventListener("keydown",event=>{
    if(event.key==="Escape"){event.preventDefault();closeJetChooser();}
    if(event.key==="Tab"){
      const buttons=[...jetChoiceButtons.map(pair=>pair[0]),cancelJetChooserButton];
      const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      if(index===buttons.length-1&&!event.shiftKey){event.preventDefault();buttons[0].focus();}
      else if(index===0&&event.shiftKey){event.preventDefault();buttons.at(-1)?.focus();}
    }
  });
  host.appendChild(jetChooser);
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
  const terrain = geo(new THREE.PlaneGeometry(terrainWidth, terrainDepth, 142, 132));
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
    const biome = biomeAt({x,z});
    groundColor.setRGB(0,0,0);
    for (const [id,weight] of Object.entries(biome.weights)) groundColor.add(new THREE.Color(BIOME_COLORS[id as keyof typeof BIOME_COLORS]).multiplyScalar(weight));
    if (!wet && (trail < 1.7 || distance({ x, z }, REGIONS[0].point) < 4)) groundColor.lerp(new THREE.Color("#b6a684"), .5);
    // Track pigment is bound to the modeled dirt tread, never a floating decal.
    if (!wet) groundColor.lerp(new THREE.Color("#9c7951"), desertTrackTreadBlend({ x, z }) * 0.82);
    const caveApproachMask = arcadeAccessTerrainMask(x, z);
    if (caveApproachMask > 0) {
      const caveApproachColor = new THREE.Color("#626766");
      groundColor.lerp(caveApproachColor, Math.min(0.62, caveApproachMask * 0.62));
    }
    groundColor.multiplyScalar(0.94 + random() * 0.12);
    colors.push(groundColor.r, groundColor.g, groundColor.b);
  }
  terrain.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  const ground = mesh(
    terrain,
    mat("#ffffff", { vertexColors: true, flatShading: false, roughness: 0.92 }),
    [0, 0, 0],
    [1, 1, 1],
  );
  ground.castShadow = false;
  // Soft north/south shoreline aprons join the finite island terrain to the
  // existing ocean plane. The outside racing channel starts beyond these
  // slopes; no exploration bounds, caves or ecology rules are expanded.
  for(const side of [-1,1]){
    const edgeZ=side>0?WORLD_BOUNDS.maxZ:WORLD_BOUNDS.minZ;
    const depth=20;
    const apron=geo(new THREE.PlaneGeometry(102,depth,64,18));
    apron.rotateX(-Math.PI/2);
    apron.translate(12,0,edgeZ+side*depth/2);
    const vertices=apron.attributes.position;
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),z=vertices.getZ(i);
      const u=THREE.MathUtils.clamp(side*(z-edgeZ)/depth,0,1);
      const blend=u*u*(3-2*u);
      const shoreY=worldFloorHeight(x,edgeZ);
      const seabed=SEA_SURFACE-3.7+Math.sin(x*.12)*.2;
      vertices.setY(i,shoreY*(1-blend)+seabed*blend);
    }
    apron.computeVertexNormals();
    const cap=mesh(apron,mat("#7b8272",{roughness:.98}),
      [0,0,0],[1,1,1]);
    cap.castShadow=false;
  }
  // Ocean and a few quiet, moving tide lines.
  const waterMaterial = mat("#218ba8", {
    roughness: 0.38,
    metalness: 0.12,
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
  });
  const water = mesh(
    geo(new THREE.PlaneGeometry(540, 420, 96, 72)),
    waterMaterial,
    [-80, SEA_SURFACE, -90],
    [1, 1, 1],
  );
  water.rotation.x = -Math.PI / 2;
  water.castShadow = false;
  const oceanPositions=water.geometry.attributes.position;
  // This plane never translates in X/Z. Cache its water/land mask once and
  // reuse one point object for wave sampling: the denser surface must not
  // allocate thousands of transient objects or recheck coastlines each tick.
  const oceanWet=new Uint8Array(oceanPositions.count);
  const oceanPoint={x:0,z:0};
  for(let i=0;i<oceanPositions.count;i++){
    oceanPoint.x=water.position.x+oceanPositions.getX(i);
    oceanPoint.z=water.position.z-oceanPositions.getY(i);
    oceanWet[i]=jetSkiNavigableWater(oceanPoint)||isWater(oceanPoint)?1:0;
  }
  let oceanWaveLast=-Infinity,oceanWaveActive=false;
  function updateRaceOceanWaves(time:number,racing:boolean){
    if(racing&&time-oceanWaveLast<.065)return;
    if(!racing&&!oceanWaveActive)return;
    oceanWaveLast=time;oceanWaveActive=racing;
    // Ocean PlaneGeometry is rotated -90deg about X; local +Z is world Y.
    // Race visuals sample the same world-space field as the watercraft hull.
    for(let i=0;i<oceanPositions.count;i++){
      oceanPoint.x=water.position.x+oceanPositions.getX(i);
      oceanPoint.z=water.position.z-oceanPositions.getY(i);
      oceanPositions.setZ(i,racing&&oceanWet[i]?
        jetSkiWaterSample(oceanPoint,time).height:0);
    }
    oceanPositions.needsUpdate=true;
    water.geometry.computeVertexNormals();
  }
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
      sportClearance({x,z}) ||
      discGolfOpeningClearance({x,z},3) || discGolfCourseClearance({x,z},2.7) ||
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
  const desertLedgeMat = mat("#c4b299");
  for (const hold of BOULDER_HOLDS) {
    const y = terrainHeight(hold.x, hold.z);
    climbRocks.push(mesh(ledgeGeometry, biomeAt(hold).weights.desert > 0.4 ? desertLedgeMat : rockMat, [hold.x, y + hold.height / 2, hold.z], [hold.radius, hold.height, hold.radius]));
    mesh(boxGeo, mat("#e7b574"), [hold.x, y + hold.height + 0.03, hold.z], [0.35, 0.04, 0.35]);
  }
  // Decorative boulders are low enough to step over; tree trunks have collision.
  instances(rockGeo, rockMat, boulders);
  const trunks: Instance[] = [],
    branches: Instance[] = [],
    crowns: Instance[] = [],
    roots: Instance[] = [];
  const obstacles: Obstacle[] = [];
  // World-coordinate ellipsoids, derived from actual rendered tree parts.
  // Unlike the trunk-only 2D collision list, these describe leaf crowns.
  const cameraCanopies:CameraVolume[]=[];
  const trees = [
    { x: -10, z: 6, h: 24, r: 1.4 },
    // Keep the large grove tree away from the new western scrub return.
    { x: 3, z: 1, h: 27, r: 1.5 },
    { x: -5, z: -7, h: 29, r: 1.7 },
    { x: 17, z: 15, h: 20, r: 1.1 },
    { x: -13, z: 23, h: 21, r: 1.2 },
  ];
  for (let i = 0; i < 27; i++) {
    const x = -25 + random() * 71,
      z = -40 + random() * 80;
    if (
      sportClearance({x,z}) || discGolfOpeningClearance({x,z},2) ||
      discGolfCourseClearance({x,z},2) ||
      biomeAt({x,z}).weights.redwood < .25 ||
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
    cameraCanopies.push({x,y:y+h*.45,z,rx:r+.3,ry:h*.45,rz:r+.3});
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
  for(const leaf of crowns)cameraCanopies.push({
    x:leaf.x,y:leaf.y,z:leaf.z,
    rx:leaf.sx+0.35,ry:leaf.sy*.58+0.25,rz:leaf.sz+0.35,
  });
  instances(cylinder, trunkMat, [...trunks, ...branches, ...roots]);
  instances(cone, leafMat, crowns);

  // A denser alpine tree run leaves readable lanes between collidable trunks.
  const skiTrunks: Instance[] = [], skiCrowns: Instance[] = [];
  for (let i = 0; i < 68; i++) {
    const x = -25 + random() * 62;
    const z = -84 + random() * 49;
    const laneCenter = 7 + Math.sin((z + 60) * 0.13) * 7;
    const inArcadeCaveCorridor =
      Math.abs(x - ARCADE_CAVE.entrance.x) <
        caveHalfWidth(z) + 2.6 &&
      z > ARCADE_CAVE.entrance.z - 3 &&
      z < ARCADE_CAVE.wall.z + 4;
    if (
      sportClearance({x,z}) ||
      discGolfOpeningClearance({x,z},2) ||
      discGolfCourseClearance({x,z},2) ||
      Math.abs(x - laneCenter) < 3.4 ||
      distance({ x, z }, REGIONS[1].point) < 7 ||
      RIDE_RAMPS.some(r => distance({ x, z }, r.point) < 5) ||
      inArcadeCaveCorridor
    ) continue;
    const y = terrainHeight(x, z);
    if (y < 7.5) continue;
    const h = 8 + random() * 8;
    const r = 0.38 + random() * 0.25;
    obstacles.push({ x, z, radius: r + 0.08 });
    cameraCanopies.push({x,y:y+h*.44,z,rx:r+.2,ry:h*.44,rz:r+.2});
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
  for(const leaf of skiCrowns)cameraCanopies.push({
    x:leaf.x,y:leaf.y,z:leaf.z,
    rx:leaf.sx+.3,ry:leaf.sy*.58+.3,rz:leaf.sz+.3,
  });
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
    // Joshua basin uses a molded earthen lip; no timber planks above the tread.
    if (ramp.id.startsWith("desert-")) continue;
    const headingLength = Math.hypot(ramp.heading.x, ramp.heading.z);
    const forward = {
      x: ramp.heading.x / headingLength,
      z: ramp.heading.z / headingLength,
    };
    const right = { x: forward.z, z: -forward.x };
    const yaw = Math.atan2(forward.x, forward.z);
    const entryY = terrainHeight(ramp.point.x-forward.x*3.5,ramp.point.z-forward.z*3.5)+.12;
    const lipY = terrainHeight(ramp.point.x,ramp.point.z)+.84;
    const pitch = -Math.atan2(lipY-entryY,3.5);
    const plankQ = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitch, yaw, 0, "YXZ"),
    );
    for (let plank = 0; plank < 8; plank++) {
      const t = plank / 7;
      const along = -3.5 + t * 3.5;
      rampPlanks.push({
        x: ramp.point.x + forward.x * along,
        y: rampSurface(ramp,{x:ramp.point.x+forward.x*along,z:ramp.point.z+forward.z*along}) ?? entryY+(lipY-entryY)*t,
        z: ramp.point.z + forward.z * along,
        sx: 2.55,
        sy: 0.11,
        sz: 0.48,
        q: plankQ,
      });
    }
    for (const side of [-1, 1]) {
      const start = new THREE.Vector3(
        ramp.point.x - forward.x * 3.5 + right.x * side * 0.92,
        entryY-.05,
        ramp.point.z - forward.z * 3.5 + right.z * side * 0.92,
      );
      const end = new THREE.Vector3(
        ramp.point.x + right.x * side * 0.92,
        lipY-.05,
        ramp.point.z + right.z * side * 0.92,
      );
      rampStringers.push(segment(start, end, 0.08));
    }
  }
  instances(boxGeo, mat("#815536"), rampPlanks);
  instances(cylinder, mat("#5e3b28"), rampStringers);
  // South-meadow skate plaza: one sampled mesh, same heightfield as tire contact.
  // The bowl, quarter transitions and pyramid are geometry, not decorations.
  const parkPositions:number[]=[],parkColors:number[]=[],parkIndices:number[]=[];
  const parkStepsX=32,parkStepsZ=30;
  const parkTint=new THREE.Color();
  for(let iz=0;iz<=parkStepsZ;iz++)for(let ix=0;ix<=parkStepsX;ix++){
    const x=SKATE_PARK.center.x-SKATE_PARK.halfWidth+
      ix*SKATE_PARK.halfWidth*2/parkStepsX;
    const z=SKATE_PARK.center.z-SKATE_PARK.halfDepth+
      iz*SKATE_PARK.halfDepth*2/parkStepsZ;
    const p={x,z},y=skateParkSurface(p)??terrainHeight(x,z);
    parkPositions.push(x,y+.026,z);
    const bowl=Math.hypot(x+12,z-40)<5.3;
    const tint=bowl?"#6f8a89":Math.abs(x+1)<2.6&&Math.abs(z-40)<3.4?"#a0aaa4":"#87938d";
    parkTint.set(tint);
    parkColors.push(parkTint.r,parkTint.g,parkTint.b);
  }
  for(let iz=0;iz<parkStepsZ;iz++)for(let ix=0;ix<parkStepsX;ix++){
    const a=iz*(parkStepsX+1)+ix,b=a+1,c=a+parkStepsX+1,d=c+1;
    parkIndices.push(a,c,b,b,c,d);
  }
  const parkGeo=geo(new THREE.BufferGeometry());
  parkGeo.setAttribute("position",new THREE.Float32BufferAttribute(parkPositions,3));
  parkGeo.setAttribute("color",new THREE.Float32BufferAttribute(parkColors,3));
  parkGeo.setIndex(parkIndices);parkGeo.computeVertexNormals();
  const plaza=mesh(parkGeo,mat("#ffffff",{vertexColors:true,flatShading:false,side:THREE.DoubleSide}),[0,0,0],[1,1,1]);
  plaza.castShadow=false;
  const parkSteel=mat("#b6c9c8"),parkPosts:Instance[]=[],parkBars:Instance[]=[];
  for(const rail of SKATE_PARK_RAILS){
    const a=new THREE.Vector3(rail.a.x,groundHeight(rail.a)+rail.lift,rail.a.z);
    const b=new THREE.Vector3(rail.b.x,groundHeight(rail.b)+rail.lift,rail.b.z);
    parkBars.push(segment(a,b,rail.radius));
    for(const end of [rail.a,rail.b]){
      parkPosts.push(segment(
        new THREE.Vector3(end.x,groundHeight(end)+.03,end.z),
        new THREE.Vector3(end.x,groundHeight(end)+rail.lift,end.z),.045));
    }
  }
  instances(cylinder,parkSteel,[...parkBars,...parkPosts]);
  // Continuous-looking coping is assembled from short pooled sections.
  // Every endpoint samples the same skatepark support as the riding wheels.
  // There are no invisible extra collision boxes or per-frame allocations.
  const parkCoping:Instance[]=[];
  const bowlSegments=24,bowlRadius=5.1;
  for(let i=0;i<bowlSegments;i++){
    const a=i*Math.PI*2/bowlSegments,b=(i+1)*Math.PI*2/bowlSegments;
    const p={x:-12+Math.cos(a)*bowlRadius,z:40+Math.sin(a)*bowlRadius};
    const q={x:-12+Math.cos(b)*bowlRadius,z:40+Math.sin(b)*bowlRadius};
    parkCoping.push(segment(
      new THREE.Vector3(p.x,groundHeight(p)+.085,p.z),
      new THREE.Vector3(q.x,groundHeight(q)+.085,q.z),.045));
  }
  for(const z of [30.9,49.1])for(let x=-2;x<6;x+=.8){
    const p={x,z},q={x:x+.8,z};
    parkCoping.push(segment(
      new THREE.Vector3(x,groundHeight(p)+.075,z),
      new THREE.Vector3(x+.8,groundHeight(q)+.075,z),.047));
  }
  instances(cylinder,mat("#d7d9cd",{metalness:.55,roughness:.38}),parkCoping,false);
  const parkPaint:Instance[]=[];
  for(const z of [35,45]){
    for(const x of [-2,0,2,4]){
      parkPaint.push({x,y:(skateParkSurface({x,z})??terrainHeight(x,z))+.057,
        z,sx:.65,sy:.025,sz:.075});
    }
  }
  instances(boxGeo,mat("#ecdbc0"),parkPaint,false);
  // Small grasses share one geometry and one draw call.
  const grasses: Instance[] = [];
  for (let i = 0; i < 750; i++) {
    const x = -28 + random() * 74,
      z = -39 + random() * 77;
    if (
      discGolfCourseClearance({x,z}) ||
      random() < biomeAt({x,z}).weights.desert || sportClearance({x,z}) ||
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
    if (discGolfCourseClearance({x,z},1.2) ||
        REGIONS.some(r => distance(r.point, { x, z }) < 4) || MEMORY_POINTS.some(m => distance(m.point, { x, z }) < 3) ||
        REGIONS.slice(1).some(r => lineDistance(x, z, REGIONS[0].point, r.point) < 2)) continue;
    const y = terrainHeight(x, z), size = 0.4 + random() * 0.6;
    if (i % 2) coyote.push({ x, y: y + size * 0.45, z, sx: size, sy: size * 0.65, sz: size * 0.8 });
    else for (let k = 0; k < 4; k++) sage.push({ x: x + Math.cos(k * 1.6) * 0.22, y: y + size * 0.5, z: z + Math.sin(k * 1.6) * 0.22, sx: size * 0.28, sy: size, sz: size * 0.28 });
  }
  for (let i = 0; i < 140; i++) {
    const x = -30 + random() * 13, z = 9 + random() * 23;
    if (discGolfCourseClearance({x,z}) ||
        MEMORY_POINTS.some(m => distance(m.point, { x, z }) < 2) || distance(REGIONS[3].point, { x, z }) < 3) continue;
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
    ...WILDLIFE_DISCOVERIES.map(m=>({id:m.id,point:m.point})),
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
  const habitats = createHabitats(scene, obstacles);
  // Low rock clusters and climb ledges can obstruct a low camera even
  // without vegetation. Include their render-authored extents as well.
  const cameraRocks:CameraVolume[]=[
    ...boulders.map(o=>({
      x:o.x,y:o.y,z:o.z,rx:o.sx+.2,ry:o.sy*.6+.2,rz:o.sz+.2,
    })),
    ...BOULDER_HOLDS.map(h=>({
      x:h.x,y:terrainHeight(h.x,h.z)+h.height*.5,z:h.z,
      rx:h.radius+.2,ry:h.height*.55+.2,rz:h.radius+.2,
    })),
  ];
  const cameraVisibility=new CameraVisibilityField([
    ...cameraCanopies,...habitats.cameraOccluders,...cameraRocks,
  ]);
  canvas.dataset.discGolfCameraVolumes=String(
    cameraCanopies.length+habitats.cameraOccluders.length+cameraRocks.length);
  const technicalFeatures = createTechnicalGeometry(scene);
  const flyingBirds=createBigAirBirds(scene);
  const discGolfObjects=createDiscGolfGeometry(scene);
  const jetskiVisual=createJetSkiDock(scene);
  const jetskiCoast=createJetSkiCoastGeometry(scene);
  const rideVisual=createRideChallengeGeometry(scene);
  canvas.dataset.jetSkiRocks=String(jetskiCoast.rockCount);
  canvas.dataset.jetSkiArches=String(jetskiCoast.archCount);
  canvas.dataset.discGolfHoles=String(DISC_GOLF_HOLES.length);
  canvas.dataset.bigAirBirds=String(flyingBirds.count);
  canvas.dataset.technicalFeatures = "3-gardens-3-beams";
  // Deep fallen-Joshua debris catches riders who underjump, but airborne
  // riders pass above it without an infinite-height 2D collision column.
  const groundedObstacles: Obstacle[] = [...obstacles, ...DESERT_GAP_DEBRIS];
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
  // Inspect actual generated collision footprints, not just analytic regions.
  // Browser QA can assert each starting throw and putting green is usable.
  const blockedGolfEnds=DISC_GOLF_HOLES.flatMap((h,index)=>{
    const blocked=(p:{x:number;z:number})=>obstacles.some(o=>
      Math.hypot(p.x-o.x,p.z-o.z)<o.radius+1.5);
    return [
      ...(blocked(h.tee)?[`hole-${index+1}-tee`]:[]),
      ...(blocked(h.target)?[`hole-${index+1}-green`]:[]),
    ];
  });
  canvas.dataset.discGolfLayoutClear=String(blockedGolfEnds.length===0);
  canvas.dataset.discGolfLayoutIssues=blockedGolfEnds.join(",");
  const fallsY = waterfallProfile().floorY;
  const waterRibbonMat=mat("#9dc6c5",{transparent:true,opacity:.7,roughness:.35,side:THREE.DoubleSide});
  const melt=drainagePoints();
  const upper=melt.map(p=>new THREE.Vector3(p.x,p.y,p.z));
  const lip=upper[upper.length-1];
  mesh(geo(ribbon(upper,upper.map((_,i)=>.6+1.6*i/(upper.length-1)))),waterRibbonMat,[0,0,0],[1,1,1]);
  const basin=mesh(geo(new THREE.CircleGeometry(2,20)),waterRibbonMat,[upper[0].x,upper[0].y,upper[0].z],[1,1,1]);basin.rotation.x=-Math.PI/2;
  const fallRings=Array.from({length:13},(_,i)=>{const t=i/12;return [new THREE.Vector3(-21.2-Math.sin(t*4)*.12,lip.y+(fallsY+.1-lip.y)*t,-30+t*.8),new THREE.Vector3(-18.8+Math.sin(t*6)*.18,lip.y+(fallsY+.1-lip.y)*t,-30+t*.8)];});
  const waterfall=mesh(geo(ringSurface(fallRings)),waterRibbonMat,[0,0,0],[1,1,1]);waterfall.castShadow=false;
  const paperRings=Array.from({length:7},(_,i)=>{
    const z=-30-i,w=paperCaveHalfWidth(z),floor=paperCaveFloorHeight({x:-20,z});
    const roofLimit=Math.min(
      mountainSurfaceHeight(-20,z),
      mountainSurfaceHeight(-20-w*.6,z),
      mountainSurfaceHeight(-20+w*.6,z),
    )-.28;
    const roof=Math.min(floor+4.4,roofLimit);
    const shoulder=floor+(roof-floor)*.66;
    return [
      new THREE.Vector3(-20-w,floor,z),
      new THREE.Vector3(-20-w,shoulder,z),
      new THREE.Vector3(-20-w*.625,roof-.18,z),
      new THREE.Vector3(-20,roof,z),
      new THREE.Vector3(-20+w*.625,roof-.18,z),
      new THREE.Vector3(-20+w,shoulder,z),
      new THREE.Vector3(-20+w,floor,z),
    ];
  });
  mesh(geo(ringSurface(paperRings)),mat("#465958",{side:THREE.DoubleSide}),[0,0,0],[1,1,1]);
  const paperBackFloor=paperCaveFloorHeight({x:-20,z:-36});
  mesh(boxGeo,mat("#43504e"),[-20,paperBackFloor+2.15,-36.2],[8,4.3,.5]);
  const paperFloorRings=paperRings.map(ring=>{
    const z=ring[0].z,w=paperCaveHalfWidth(z)-.12,y=paperCaveFloorHeight({x:-20,z})-.08;
    return [new THREE.Vector3(-20-w,y,z),new THREE.Vector3(-20+w,y,z)];
  });
  mesh(geo(ringSurface(paperFloorRings)),mat("#4d5a57",{side:THREE.DoubleSide}),[0,0,0],[1,1,1]);
  // Cave solids are active only on an underground navigation layer. Projecting
  // them into global x/z collision is what previously made the roof unwalkable.
  const caveSolids=caveObstacles();
  const paperRockRings = waterfallCrownRings().map(ring => ring.map(p => new THREE.Vector3(p.x, p.y, p.z)));
  // Close the rock above and beside the mouth without closing the passage.
  const paperRockSkin = [...paperRockRings, paperRings[0]];
  mesh(geo(ringSurface(paperRockSkin)),mat("#78867a",{side:THREE.DoubleSide}),[0,0,0],[1,1,1]);
  const paperTablets:Instance[]=Array.from({length:4},(_,i)=>({x:-22.4+i*1.6,y:fallsY+1.9,z:-35.75,sx:1.05,sy:1.5,sz:.16}));
  instances(boxGeo,mat("#8d9c96"),paperTablets,false);
  const paperGlyphs:Instance[]=paperTablets.flatMap(p=>Array.from({length:12},(_,i)=>({x:p.x-.4+i*.07,y:p.y+Math.sin(i*1.8)*.19,z:p.z+.1,sx:.05,sy:.055,sz:.025})));
  instances(boxGeo,mat("#394c4f"),paperGlyphs,false);
  const paperLight=new THREE.PointLight("#b2dce6",4,9,2);paperLight.position.set(-20,fallsY+3,-33);scene.add(paperLight);
  const pool=mesh(geo(new THREE.CircleGeometry(3.7,24)),waterRibbonMat,[-20,fallsY+.08,-27],[1,1,1]);pool.rotation.x=-Math.PI/2;
  const lower=downstreamPoints().map(p=>new THREE.Vector3(p.x,p.y,p.z));
  mesh(geo(ribbon(lower,lower.map(()=>1.2))),waterRibbonMat,[0,0,0],[1,1,1]);
  const fallingWater=instances(boxGeo,mat("#efffff",{transparent:true,opacity:.45}),Array.from({length:24},(_,i)=>({x:-21+(i%5)*.45,y:fallsY+.3+(i/24)*(lip.y-fallsY-.5),z:-29.55,sx:.025,sy:.3,sz:.025})),false);
  const splash=mesh(geo(new THREE.TorusGeometry(1.2,.04,4,20)),mat("#d6f6ec"),[-20,fallsY+.15,-29],[1,1,1]);splash.rotation.x=-Math.PI/2;
  canvas.dataset.waterSource="snowmelt";
  // The arcade now lives inside a real tunnel on the backside of Granite Ridge.
  // Menu travel lands outside the entrance; the player must walk uphill into the
  // mountain before the carved games become selectable.
  const arcade = ARCADE_CAVE.entrance;
  const arcadeY = arcadeCaveFloorHeight(arcade);
  const arcadeWall = ARCADE_CAVE.wall;
  const arcadeWallY = arcadeCaveFloorHeight(arcadeWall);
  // The cave is true layered negative space: its floor and interior shell live
  // below the untouched mountain support surface instead of replacing it.
  const caveFloorY = arcadeCaveFloorHeight({x:16,z:-78});
  const shellRings = Array.from({length:17},(_,i)=>{
    const z=arcade.z+i/16*ARCADE_CAVE.tunnelDepth,w=caveHalfWidth(z);
    const floor=arcadeCaveFloorHeight({x:16,z});
    const roofLimit=mountainSurfaceHeight(16,z)-.3;
    const roof=Math.min(floor+6.05,roofLimit);
    const jitter=Math.sin(i*1.7)*.08;
    const shoulder=floor+(roof-floor)*.58;
    return [
      new THREE.Vector3(16-w,floor-.08,z),
      new THREE.Vector3(16-w-.15,shoulder,z),
      new THREE.Vector3(16-w*.72,roof-.28+jitter,z),
      new THREE.Vector3(16,roof+jitter,z),
      new THREE.Vector3(16+w*.72,roof-.22,z),
      new THREE.Vector3(16+w+.15,shoulder,z),
      new THREE.Vector3(16+w,floor-.08,z),
    ];
  });
  mesh(geo(ringSurface(shellRings)),mat("#626766",{side:THREE.DoubleSide,flatShading:false}),[0,0,0],[1,1,1]);
  for(const side of [-1,1]){
    const shoulderRings=shellRings.map((ring)=>{
      const z=ring[0].z,w=caveHalfWidth(z),top=ring[3].y;
      return [new THREE.Vector3(16,top+.18,z),new THREE.Vector3(16+side*(w+1),Math.max(top+.32,mountainSurfaceHeight(16+side*(w+1),z)),z),new THREE.Vector3(16+side*(w+5),terrainHeight(16+side*(w+5),z),z)];
    });
    mesh(geo(ringSurface(shoulderRings)),mat("#969b94",{side:THREE.DoubleSide,flatShading:false}),[0,0,0],[1,1,1]);
  }
  const arcadeFloorRings=shellRings.map(ring=>{
    const z=ring[0].z,w=caveHalfWidth(z)-.14,y=arcadeCaveFloorHeight({x:16,z})-.08;
    return [new THREE.Vector3(16-w,y,z),new THREE.Vector3(16+w,y,z)];
  });
  mesh(geo(ringSurface(arcadeFloorRings)),mat("#535b59",{side:THREE.DoubleSide}),[0,0,0],[1,1,1]);
  // Recessed throat baffle blocks the direct exterior view of the rear niche.
  const baffleFloor=arcadeCaveFloorHeight({x:16,z:-74.5});
  mesh(boxGeo,mat("#646b67"),[14.2,baffleFloor+2.35,-74.5],[4.8,4.7,.7]);
  // A single small hanging lantern provides the cave's warm interior light.
  const lanternFloor = arcadeCaveFloorHeight(ARCADE_CAVE.lantern);
  const lanternY = lanternFloor + ARCADE_CAVE.ceilingClearance - 0.85;
  const lanternChain = segment(
    new THREE.Vector3(ARCADE_CAVE.lantern.x, lanternY + 0.95, ARCADE_CAVE.lantern.z),
    new THREE.Vector3(ARCADE_CAVE.lantern.x, lanternY + 0.28, ARCADE_CAVE.lantern.z),
    0.026,
  );
  const chainMesh = mesh(
    cylinder,
    mat("#3d3730"),
    [lanternChain.x, lanternChain.y, lanternChain.z],
    [lanternChain.sx, lanternChain.sy, lanternChain.sz],
  );
  chainMesh.quaternion.copy(lanternChain.q!);
  const lanternMetal = mat("#5a4631", { roughness: 0.9 });
  const lanternGlow = mat("#ffd08a", {
    emissive: "#f3a43b",
    emissiveIntensity: 2.2,
    transparent: true,
    opacity: 0.9,
    roughness: 0.24,
  });
  mesh(
    cylinder,
    lanternMetal,
    [ARCADE_CAVE.lantern.x, lanternY + 0.19, ARCADE_CAVE.lantern.z],
    [0.19, 0.08, 0.19],
  );
  mesh(
    cylinder,
    lanternMetal,
    [ARCADE_CAVE.lantern.x, lanternY - 0.19, ARCADE_CAVE.lantern.z],
    [0.2, 0.08, 0.2],
  );
  mesh(
    cylinder,
    lanternGlow,
    [ARCADE_CAVE.lantern.x, lanternY, ARCADE_CAVE.lantern.z],
    [0.11, 0.31, 0.11],
  );
  const lanternCage: Instance[] = [];
  for (const [dx, dz] of [
    [-0.13, -0.13],
    [-0.13, 0.13],
    [0.13, -0.13],
    [0.13, 0.13],
  ] as const)
    lanternCage.push({
      x: ARCADE_CAVE.lantern.x + dx,
      y: lanternY,
      z: ARCADE_CAVE.lantern.z + dz,
      sx: 0.018,
      sy: 0.38,
      sz: 0.018,
    });
  instances(cylinder, lanternMetal, lanternCage, false);
  const caveLight = new THREE.PointLight("#ffcb83", 9, 14, 1.8);
  caveLight.position.set(ARCADE_CAVE.lantern.x, lanternY - 0.05, ARCADE_CAVE.lantern.z);
  scene.add(caveLight);

  // Build a rough back wall from stone, then inset three separate game panels.
  // They are horizontally spaced so gaze/click selection has generous hit areas.
  mesh(boxGeo,mat("#424b49"),[16,arcadeWallY+3,-62.9],[12.8,6.2,.8]);
  const carvingBandMaterial = mat("#11191b", {
    transparent: true,
    opacity: 0.001,
    depthWrite: false,
    roughness: 1,
  });
  const panelY = arcadeWallY + 2.35;
  const gameNiches = [
    {x:10.35,z:-67,yaw:Math.PI/2}, {x:16,z:-63.45,yaw:0}, {x:21.65,z:-67,yaw:-Math.PI/2},
  ];
  const carvingBands: Instance[] = gameNiches.map(p=>({x:p.x,y:panelY,z:p.z,sx:3.6,sy:2.65,sz:.13,ry:p.yaw}));
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
  canvas.dataset.caveStyle = "backside-mountain-tunnel";
  canvas.dataset.caveLantern = "true";
  canvas.dataset.caveGamePanels = String(carvingBands.length);
  canvas.dataset.caveSealed = "true";
  canvas.dataset.caveVegetationClear = "true";
  canvas.dataset.caveTerrainCarved = "true";
  canvas.dataset.caveSurfaceWalkable = "true";
  canvas.dataset.caveLayeredSupport = "true";
  canvas.dataset.rainforestPersistent = "true";
  const carvingMaterial = mat("#d7bc82", {
    emissive: "#9b6d31",
    emissiveIntensity: 0.55,
    roughness: 0.9,
  });
  const carvingGlyphs: Instance[] = [];
  carvingTitles.forEach((title, panelIndex) => {
    const words = title.toUpperCase().split(" ");
    const lines =
      title.length > 11 && words.length > 1
        ? words
        : [title.toUpperCase()];
    const maxChars = Math.max(...lines.map((line) => line.length));
    const scale = Math.min(0.055, 2.15 / Math.max(4, maxChars * 4));
    const lineStep = 6.2 * scale;
    lines.forEach((line, lineIndex) => {
      const width = line.length * 4 * scale;
      // Positions are defined in panel-local coordinates, not global X.
      const baseline =
        panelY + ((lines.length - 1) * lineStep) / 2 - lineIndex * lineStep + scale * 2;
      [...line].forEach((letter, index) => {
        const pattern = glyphs[letter];
        if (!pattern) return;
        pattern.forEach((bits, py) =>
          [...bits].forEach((bit, px) => {
            if (bit !== "1") return;
            const niche = gameNiches[panelIndex];
            // Each panel has its own viewer-facing tangent. Side niches already
            // face toward the chamber, so mirroring them produced backwards text.
            // Only the rear (+Z-facing view) needs horizontal reversal.
            const leftToRight = -width / 2 + scale * 0.5 + index * 4 * scale + px * scale;
            const localX = panelIndex === 1
              ? -leftToRight
              : leftToRight;
            carvingGlyphs.push({
              // Local tangent points viewer-right on both side niches; the rear
              // niche alone reverses its tangent for readable lettering.
              x: niche.x+Math.cos(niche.yaw)*localX-Math.sin(niche.yaw)*.14,
              y: baseline - py * scale,
              z: niche.z-Math.sin(niche.yaw)*localX-Math.cos(niche.yaw)*.14,
              ry:niche.yaw,
              sx: scale * 0.78,
              sy: scale * 0.78,
              sz: 0.04,
            });
          }),
        );
      });
    });
  });
  const gameCarvings = instances(boxGeo, carvingMaterial, carvingGlyphs, false);

  // Subtle carved symbols below each game keep the wall personal without adding
  // UI chrome: horn, branching neuron, mountain.
  const caveRunes: Instance[] = gameNiches.flatMap((p,i)=>Array.from({length:3+i},(_,k)=>({x:p.x+Math.cos(p.yaw)*(k*.17-.3)-Math.sin(p.yaw)*.15,y:caveFloorY+1.1+Math.sin(k)*.15,z:p.z-Math.sin(p.yaw)*(k*.17-.3)-Math.cos(p.yaw)*.15,sx:.08,sy:.12,sz:.04,ry:p.yaw})));
  const runeMesh = instances(boxGeo,mat("#9a8462"),caveRunes,false);
  gameCarvings.visible = runeMesh.visible = carvingBandMesh.visible = false;

  // No arcade cabinet is duplicated here; the mountain wall itself is the portfolio/game interface.

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
  // Shasta is defined from Sid's supplied photo set rather than a generic husky palette.
  // Keep the character-specific appearance data in shastaCharacter.ts so geometry,
  // texture blocking and future model upgrades share one source of truth.
  const shasta = new THREE.Group();
  shasta.rotation.order = "YXZ";
  scene.add(shasta);
  // Root follows ground, while the full-body pose rotates around Shasta's
  // approximate center of mass instead of spinning about his paws.
  const shastaPose=new THREE.Group(),shastaArt=new THREE.Group();
  shastaPose.position.y=.79;shastaArt.position.y=-.79;
  shastaPose.add(shastaArt);shasta.add(shastaPose);
  const shastaPalette = SHASTA_CHARACTER.palette;
  const shastaBodyGeo = geo(
    new THREE.SphereGeometry(
      1,
      SHASTA_CHARACTER.rendering.bodySegments,
      SHASTA_CHARACTER.rendering.bodyRings,
    ),
  );
  const shastaRockMat = mat(shastaPalette.creamWhite, {
    flatShading: false,
    roughness: 0.94,
  });
  const p = SHASTA_CHARACTER.proportions;
  const coat = SHASTA_CHARACTER.coat;
  const face = SHASTA_CHARACTER.face;

  const shastaRockParts: Instance[] = [
    // Cream-white base coat and underside.
    { x: 0, y: 0.78, z: -0.08, sx: p.torso.x, sy: p.torso.y, sz: p.torso.z, color: shastaPalette.creamWhite },
    { x: 0, y: 0.87, z: 0.43, sx: p.chest.x, sy: p.chest.y, sz: p.chest.z, color: shastaPalette.brightWhite },
    { x: 0, y: 1.08, z: 0.49, sx: 0.33, sy: 0.39, sz: 0.33, color: shastaPalette.brightWhite },
    { x: 0, y: 1.28, z: 0.59, sx: p.neck.x, sy: p.neck.y, sz: p.neck.z, color: shastaPalette.creamWhite },
    { x: 0, y: 1.43, z: 0.73, sx: p.head.x, sy: p.head.y, sz: p.head.z, color: shastaPalette.creamWhite },
    { x: 0, y: 1.36, z: 0.995, sx: p.muzzle.x, sy: p.muzzle.y, sz: p.muzzle.z, color: shastaPalette.brightWhite },

    // Shasta's warm saddle is concentrated along the upper back rather than
    // forming a dark generic husky mask across the whole body.
    { x: coat.saddleCenter.x, y: coat.saddleCenter.y, z: coat.saddleCenter.z, sx: coat.saddleCenter.sx, sy: coat.saddleCenter.sy, sz: coat.saddleCenter.sz, color: shastaPalette.warmTan },
    { x: coat.saddleSpine.x, y: coat.saddleSpine.y, z: coat.saddleSpine.z, sx: coat.saddleSpine.sx, sy: coat.saddleSpine.sy, sz: coat.saddleSpine.sz, color: shastaPalette.sable },
    { x: coat.shoulderTan.x, y: coat.shoulderTan.y, z: coat.shoulderTan.z, sx: coat.shoulderTan.sx, sy: coat.shoulderTan.sy, sz: coat.shoulderTan.sz, color: shastaPalette.lightTan },
    { x: 0, y: 0.91, z: -0.63, sx: 0.27, sy: 0.21, sz: 0.3, color: shastaPalette.lightTan },

    // Keep the forehead volume clean. Shasta's subtle tan facial coloration is
    // not modeled as extra geometry, which would incorrectly change his skull silhouette.
    { x: 0, y: face.noseY, z: face.noseZ, sx: 0.105, sy: 0.075, sz: 0.075, color: shastaPalette.pinkBrownNose },
  ];

  for (const side of [-1, 1]) {
    // Flat almond-shaped eye sockets sit on the curved head, not floating
    // spherical amber beads projecting past it. Low-key rims preserve the
    // familiar alert husky expression without large whites or bulky brows.
    shastaRockParts.push(
      { x: side * face.cheekX, y: face.cheekY, z: face.cheekZ, sx: p.cheek.x, sy: p.cheek.y, sz: p.cheek.z, color: shastaPalette.brightWhite },
      { x: side * face.eyeX, y: face.eyeY, z: face.rimZ,
        sx: face.rimRadius.x, sy: face.rimRadius.y, sz: face.rimRadius.z, color: shastaPalette.eyeRim },
      { x: side * face.eyeX, y: face.eyeY, z: face.irisZ,
        sx: face.irisRadius.x, sy: face.irisRadius.y, sz: face.irisRadius.z, color: shastaPalette.amberEye },
      { x: side * face.eyeX, y: face.eyeY, z: face.pupilZ,
        sx: face.pupilRadius.x, sy: face.pupilRadius.y, sz: face.pupilRadius.z, color: shastaPalette.pupil },
    );
  }

  // Observed relaxed panting and bright alert expression, with an actual
  // small mouth/tongue rather than a permanently expressionless snout.
  const shastaMouthIndex=shastaRockParts.length;
  shastaRockParts.push({x:0,y:1.267,z:1.16,
    sx:.116,sy:.043,sz:.07,color:"#51433e"});
  const shastaTongueIndex=shastaRockParts.length;
  shastaRockParts.push({x:0,y:1.235,z:1.205,
    sx:.058,sy:.023,sz:.082,color:"#c58b89"});
  const shastaHeadIndices=[
    4,5,10,11,12,13,14,15,16,17,18,shastaMouthIndex,shastaTongueIndex,
  ];
  // Four compact, rounded paws only. No toe lobes, hock spheres or knee
  // blobs: the clean low-poly silhouette matches the simple leg columns.
  const pawInstanceIndices:number[]=[];
  for(const side of [-1,1])for(const fore of [-1,1]){
    pawInstanceIndices.push(shastaRockParts.length);
    shastaRockParts.push({
      x:side*.2,y:.06,z:fore*.44+.018,
      sx:p.paw.x,sy:p.paw.y,sz:p.paw.z,
      color:shastaPalette.brightWhite,
    });
  }
  const shastaRockMesh = instances(shastaBodyGeo, shastaRockMat, shastaRockParts, true, shastaArt);

  const shastaEarParts: Instance[] = [];
  for (const side of [-1, 1]) {
    shastaEarParts.push(
      {
        x: side * 0.18,
        y: 1.82,
        z: 0.69,
        sx: p.ear.x,
        sy: p.ear.y,
        sz: p.ear.z,
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -side * 0.075)),
        color: shastaPalette.warmTan,
      },
      {
        x: side * 0.18,
        y: 1.81,
        z: 0.73,
        sx: 0.062,
        sy: 0.235,
        sz: 0.072,
        color: shastaPalette.innerEar,
      },
    );
  }
  const shastaEarMesh=instances(cone,mat(shastaPalette.creamWhite),
    shastaEarParts,true,shastaArt);
  const shastaHeadPivot=new THREE.Vector3(0,1.25,.58);
  const shastaHeadPos=new THREE.Vector3(),shastaHeadQuat=new THREE.Quaternion(),
    shastaEarQuat=new THREE.Quaternion();

  const shastaCylinderParts:Instance[]=[];
  const shastaLegs:{
    x:number;z:number;legIndex:number;pawIndex:number;
  }[]=[];
  let legIndex=0;
  for(const side of [-1,1])for(const fore of [-1,1]){
    const index=shastaCylinderParts.length;
    // Same lateral scale as the compact paw, visually one continuous limb.
    shastaCylinderParts.push({
      x:side*.2,y:.4,z:fore*.44,
      sx:p.paw.x,sy:.75,sz:.086,
      color:fore>0?shastaPalette.creamWhite:shastaPalette.brightWhite,
    });
    shastaLegs.push({
      x:side*.2,z:fore*.44,legIndex:index,
      pawIndex:pawInstanceIndices[legIndex],
    });
    legIndex++;
  }

  // Warm tail base transitions into Shasta's broad cream-white plume.
  shastaCylinderParts.push({
    x: 0,
    y: 1.0,
    z: -0.73,
    sx: 0.11,
    sy: 0.33,
    sz: 0.11,
    q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.62, 0, 0)),
    color: shastaPalette.warmTan,
  });
  const shastaLimbUp=new THREE.Vector3(0,1,0);
  const shastaLimbDir=new THREE.Vector3();
  const shastaCylinderMesh = instances(
    cylinder,
    mat(shastaPalette.creamWhite),
    shastaCylinderParts,
    true,
    shastaArt,
  );

  // Photo-matched tail: six hidden control points drive one continuous plume
  // that drops behind the hips, broadens through the middle, then curls softly
  // outward. Vertex colors transition from Shasta's warm tail base into his
  // cream-white plume without adding another draw call.
  const shastaTail = new THREE.Group();
  shastaTail.position.set(0, 1.0, -0.72);
  shastaArt.add(shastaTail);
  const tailPivotY = 1.0;
  const tailPivotZ = -0.72;
  const tailCurve = new THREE.CatmullRomCurve3(
    SHASTA_CHARACTER.tail.plume.map(
      (part) =>
        new THREE.Vector3(
          part.x,
          part.y - tailPivotY,
          part.z - tailPivotZ,
        ),
    ),
    false,
    "centripetal",
  );
  const tailTubularSegments = 20;
  const tailRadialSegments = 7;
  const tailGeometry = geo(
    new THREE.TubeGeometry(
      tailCurve,
      tailTubularSegments,
      0.17,
      tailRadialSegments,
      false,
    ),
  );
  const tailPosition = tailGeometry.getAttribute("position") as THREE.BufferAttribute;
  const tailColors = new Float32Array(tailPosition.count * 3);
  const tailBaseColor = new THREE.Color(shastaPalette.warmTan);
  const tailMidColor = new THREE.Color(shastaPalette.creamWhite);
  const tailTipColor = new THREE.Color(shastaPalette.brightWhite);
  const tailCenter = new THREE.Vector3();
  const tailVertex = new THREE.Vector3();
  const verticesPerTailRing = tailRadialSegments + 1;
  for (let ring = 0; ring <= tailTubularSegments; ring++) {
    const t = ring / tailTubularSegments;
    tailCurve.getPointAt(t, tailCenter);
    // Broadest around the middle of the plume; narrower at the rump and tip.
    const plumeScale = 0.78 + Math.sin(Math.PI * t) * 0.38;
    const color =
      t < 0.45
        ? tailBaseColor.clone().lerp(tailMidColor, t / 0.45)
        : tailMidColor.clone().lerp(tailTipColor, (t - 0.45) / 0.55);
    for (let radial = 0; radial <= tailRadialSegments; radial++) {
      const index = ring * verticesPerTailRing + radial;
      tailVertex.fromBufferAttribute(tailPosition, index);
      tailVertex.sub(tailCenter).multiplyScalar(plumeScale).add(tailCenter);
      tailPosition.setXYZ(index, tailVertex.x, tailVertex.y, tailVertex.z);
      tailColors[index * 3] = color.r;
      tailColors[index * 3 + 1] = color.g;
      tailColors[index * 3 + 2] = color.b;
    }
  }
  tailPosition.needsUpdate = true;
  tailGeometry.setAttribute("color", new THREE.BufferAttribute(tailColors, 3));
  tailGeometry.computeVertexNormals();
  const shastaTailMesh = mesh(
    tailGeometry,
    mat("#ffffff", { vertexColors: true }),
    [0, 0, 0],
    [1, 1, 1],
    shastaTail,
  );
  shastaTailMesh.castShadow = false;
  // The tubular tail is open at both ends, so the white end-cap was
  // literally missing despite the plume having white vertex colors.
  // Close it with an overlapping ellipsoid that follows the tail pivot.
  const tailTipPoint=tailCurve.getPointAt(1);
  const tailTipTangent=tailCurve.getTangentAt(.995).normalize();
  const shastaTailTip=mesh(
    shastaBodyGeo,mat(shastaPalette.brightWhite,{roughness:.94}),
    [tailTipPoint.x+tailTipTangent.x*.064,
      tailTipPoint.y+tailTipTangent.y*.064,
      tailTipPoint.z+tailTipTangent.z*.064],
    [.143,.194,.143],shastaTail,
  );
  shastaTailTip.quaternion.setFromUnitVectors(
    new THREE.Vector3(0,1,0),tailTipTangent,
  );
  shastaTailTip.castShadow=false;
  canvas.dataset.shastaTailTip="closed-white";
  shastaTail.rotation.z = SHASTA_CHARACTER.tail.restAngleZ;
  shastaTail.rotation.y = SHASTA_CHARACTER.tail.restAngleY;

  // Ground-level snow scatter reuses one tiny instanced draw call. Puffs are
  // only visible during the alpine zoom/run/roll event, never during fetch.
  const snowPuffGeo=geo(new THREE.IcosahedronGeometry(1,0));
  const snowPuffMat=mat("#eff8f6",{transparent:true,opacity:.66,depthWrite:false});
  const snowPuffs=instances(snowPuffGeo,snowPuffMat,
    Array.from({length:12},()=>({x:0,y:-100,z:0,sx:.1,sy:.06,sz:.1})),false);
  snowPuffs.frustumCulled=false;
  snowPuffs.visible=false;
  // Default World Mode shows Shasta without accessories so his natural coat and
  // body silhouette remain unobstructed.

  canvas.dataset.shastaSex = SHASTA_CHARACTER.identity.sex;
  canvas.dataset.shastaProfile = `${SHASTA_CHARACTER.identity.type}:${SHASTA_CHARACTER.identity.build}`;
  canvas.dataset.shastaTailParts = String(SHASTA_CHARACTER.tail.plume.length);
  canvas.dataset.shastaEye = shastaPalette.amberEye;
  canvas.dataset.shastaNose = shastaPalette.pinkBrownNose;
  canvas.dataset.shastaProfileVersion = SHASTA_CHARACTER.rendering.profileVersion;
  canvas.dataset.shastaTailStyle = SHASTA_CHARACTER.rendering.tailStyle;
  canvas.dataset.shastaHarness = String(SHASTA_CHARACTER.accessories.harnessInWorld);
  // Lightweight exact-build browser audit contract; no debug teleport paths.
  canvas.dataset.desertLapLength = DESERT_TRACK_LENGTH.toFixed(3);
  canvas.dataset.desertGapCount = String(DESERT_JUMPS.filter(j=>j.kind==="gap").length);
  canvas.dataset.desertBypasses = "2";

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

  // Land wildlife shares a small anatomical vocabulary instead of one generic
  // body + stick-tail silhouette. Heads, ears/crests and tail families are still
  // instanced across all animals so realism costs only a few draw calls.
  type CritterState = {
    kind: typeof LAND_WILDLIFE[number]["kind"];
    home: Point;
    point: Point;
    phase: number;
    heading: number;
    roam: number;
    speed: number;
    panicUntil:number;
    fleeFrom:Point|null;
    bodyScale: { x: number; y: number; z: number };
    headScale: { x: number; y: number; z: number };
    headForward: number;
    headLift: number;
    earScale: { x: number; y: number; z: number } | null;
    tailStyle: "plume" | "thin" | "puff" | "feather";
    tailLength: number;
    tailRadius: number;
  };
  const critters: CritterState[] = LAND_WILDLIFE.map((animal, i) => {
    const shape =
      animal.kind === "lizard"
        ? {
            bodyScale: { x: 0.11, y: 0.065, z: 0.34 },
            headScale: { x: 0.095, y: 0.07, z: 0.14 },
            headForward: 0.3,
            headLift: 0.015,
            earScale: null,
            tailStyle: "thin" as const,
            tailLength: 0.62,
            tailRadius: 0.024,
          }
        : animal.kind === "mouse"
          ? {
              bodyScale: { x: 0.12, y: 0.105, z: 0.19 },
              headScale: { x: 0.1, y: 0.095, z: 0.12 },
              headForward: 0.17,
              headLift: 0.035,
              earScale: { x: 0.045, y: 0.07, z: 0.04 },
              tailStyle: "thin" as const,
              tailLength: 0.46,
              tailRadius: 0.015,
            }
          : animal.kind === "woodrat"
            ? {
                bodyScale: { x: 0.17, y: 0.145, z: 0.25 },
                headScale: { x: 0.125, y: 0.12, z: 0.145 },
                headForward: 0.22,
                headLift: 0.045,
                earScale: { x: 0.052, y: 0.078, z: 0.046 },
                tailStyle: "thin" as const,
                tailLength: 0.52,
                tailRadius: 0.019,
              }
            : animal.kind === "rabbit"
              ? {
                  bodyScale: { x: 0.23, y: 0.27, z: 0.34 },
                  headScale: { x: 0.15, y: 0.17, z: 0.17 },
                  headForward: 0.3,
                  headLift: 0.12,
                  earScale: { x: 0.055, y: 0.28, z: 0.052 },
                  tailStyle: "puff" as const,
                  tailLength: 0.15,
                  tailRadius: 0.1,
                }
              : animal.kind === "quail"
                ? {
                    bodyScale: { x: 0.19, y: 0.2, z: 0.27 },
                    headScale: { x: 0.12, y: 0.13, z: 0.14 },
                    headForward: 0.22,
                    headLift: 0.1,
                    earScale: { x: 0.028, y: 0.15, z: 0.025 },
                    tailStyle: "feather" as const,
                    tailLength: 0.24,
                    tailRadius: 0.055,
                  }
                : {
                    bodyScale: { x: 0.18, y: 0.18, z: 0.29 },
                    headScale: { x: 0.125, y: 0.14, z: 0.155 },
                    headForward: 0.24,
                    headLift: 0.09,
                    earScale: { x: 0.048, y: 0.125, z: 0.043 },
                    tailStyle: "plume" as const,
                    tailLength: 0.64,
                    tailRadius: 0.115,
                  };
    return {
      kind: animal.kind,
      home: { ...animal.point },
      point: { ...animal.point },
      phase: i * 1.47 + random() * Math.PI,
      heading: random() * Math.PI * 2,
      roam: animal.roam,
      speed: animal.speed,
      panicUntil:0,
      fleeFrom:null,
      ...shape,
    };
  });
  const wildlifeMat = mat("#ffffff", { flatShading: false, roughness: 0.96 });
  const critterBodies = instances(
    shastaBodyGeo,
    wildlifeMat,
    critters.map((critter) => ({
      x: critter.point.x,
      y: terrainHeight(critter.point.x, critter.point.z) + critter.bodyScale.y,
      z: critter.point.z,
      sx: critter.bodyScale.x,
      sy: critter.bodyScale.y,
      sz: critter.bodyScale.z,
      color: LAND_WILDLIFE_COLORS[critter.kind],
    })),
    false,
  );
  const critterHeads = instances(
    shastaBodyGeo,
    wildlifeMat,
    critters.map((critter) => ({
      x: critter.point.x,
      y: terrainHeight(critter.point.x, critter.point.z) + critter.bodyScale.y + critter.headLift,
      z: critter.point.z,
      sx: critter.headScale.x,
      sy: critter.headScale.y,
      sz: critter.headScale.z,
      color: LAND_WILDLIFE_COLORS[critter.kind],
    })),
    false,
  );

  type CritterEarPart = { critterIndex: number; side: number; crest: boolean };
  const critterEarParts: CritterEarPart[] = [];
  critters.forEach((critter, critterIndex) => {
    if (!critter.earScale) return;
    if (critter.kind === "quail") {
      critterEarParts.push({ critterIndex, side: 0, crest: true });
    } else {
      critterEarParts.push(
        { critterIndex, side: -1, crest: false },
        { critterIndex, side: 1, crest: false },
      );
    }
  });
  const critterEarIndicesByCritter: number[][] = critters.map(() => []);
  critterEarParts.forEach((part, index) =>
    critterEarIndicesByCritter[part.critterIndex].push(index),
  );
  const critterEars = instances(
    cone,
    wildlifeMat,
    critterEarParts.map(({ critterIndex }) => {
      const critter = critters[critterIndex];
      const ear = critter.earScale!;
      return {
        x: critter.point.x,
        y: terrainHeight(critter.point.x, critter.point.z) + 0.4,
        z: critter.point.z,
        sx: ear.x,
        sy: ear.y,
        sz: ear.z,
        color: LAND_WILDLIFE_COLORS[critter.kind],
      };
    }),
    false,
  );

  type CritterEyePart = { critterIndex: number; side: -1 | 1 };
  const critterEyeParts: CritterEyePart[] = critters.flatMap((_, critterIndex) => [
    { critterIndex, side: -1 },
    { critterIndex, side: 1 },
  ]);
  const critterEyeIndicesByCritter: number[][] = critters.map(() => []);
  critterEyeParts.forEach((part, index) =>
    critterEyeIndicesByCritter[part.critterIndex].push(index),
  );
  const critterEyes = instances(
    shastaBodyGeo,
    mat("#201b17", { flatShading: false, roughness: 0.48 }),
    critterEyeParts.map(({ critterIndex }) => {
      const critter = critters[critterIndex];
      return {
        x: critter.point.x,
        y: terrainHeight(critter.point.x, critter.point.z) + 0.2,
        z: critter.point.z,
        sx: Math.max(0.012, critter.headScale.x * 0.12),
        sy: Math.max(0.012, critter.headScale.y * 0.11),
        sz: Math.max(0.009, critter.headScale.z * 0.08),
      };
    }),
    false,
  );

  const critterMuzzleColors: Record<typeof critters[number]["kind"], string> = {
    squirrel: "#a98a70",
    mouse: "#a59a8e",
    woodrat: "#91877c",
    lizard: "#829069",
    rabbit: "#c8baa4",
    quail: "#c79b52",
  };
  const critterMuzzleIndices = critters
    .map((critter, critterIndex) => ({ critter, critterIndex }))
    .filter(({ critter }) => critter.kind !== "quail")
    .map(({ critterIndex }) => critterIndex);
  const critterMuzzleInstanceByCritter = new Map<number, number>();
  critterMuzzleIndices.forEach((critterIndex, instanceIndex) =>
    critterMuzzleInstanceByCritter.set(critterIndex, instanceIndex),
  );
  const critterMuzzles = instances(
    shastaBodyGeo,
    mat("#ffffff", { flatShading: false, roughness: 0.96 }),
    critterMuzzleIndices.map((critterIndex) => {
      const critter = critters[critterIndex];
      return {
        x: critter.point.x,
        y: terrainHeight(critter.point.x, critter.point.z) + 0.2,
        z: critter.point.z,
        sx: 0.07,
        sy: 0.055,
        sz: 0.09,
        color: critterMuzzleColors[critter.kind],
      };
    }),
    false,
  );
  const critterBeakIndices = critters
    .map((critter, critterIndex) => ({ critter, critterIndex }))
    .filter(({ critter }) => critter.kind === "quail")
    .map(({ critterIndex }) => critterIndex);
  const critterBeakInstanceByCritter = new Map<number, number>();
  critterBeakIndices.forEach((critterIndex, instanceIndex) =>
    critterBeakInstanceByCritter.set(critterIndex, instanceIndex),
  );
  const critterBeaks = instances(
    cone,
    mat("#c79b52", { roughness: 0.92 }),
    critterBeakIndices.map((critterIndex) => ({
      x: critters[critterIndex].point.x,
      y: terrainHeight(
        critters[critterIndex].point.x,
        critters[critterIndex].point.z,
      ) + 0.2,
      z: critters[critterIndex].point.z,
      sx: 0.045,
      sy: 0.1,
      sz: 0.045,
    })),
    false,
  );

  type CritterLegPart = {
    critterIndex: number;
    side: -1 | 1;
    fore: -1 | 0 | 1;
  };
  const critterLegParts: CritterLegPart[] = [];
  critters.forEach((critter, critterIndex) => {
    if (critter.kind === "quail") {
      critterLegParts.push(
        { critterIndex, side: -1, fore: 0 },
        { critterIndex, side: 1, fore: 0 },
      );
    } else {
      for (const side of [-1, 1] as const)
        for (const fore of [-1, 1] as const)
          critterLegParts.push({ critterIndex, side, fore });
    }
  });
  const critterLegIndicesByCritter: number[][] = critters.map(() => []);
  critterLegParts.forEach((part, index) =>
    critterLegIndicesByCritter[part.critterIndex].push(index),
  );
  const critterLegs = instances(
    cylinder,
    wildlifeMat,
    critterLegParts.map(({ critterIndex }) => {
      const critter = critters[critterIndex];
      const legHeight =
        critter.kind === "lizard"
          ? 0.07
          : critter.kind === "mouse"
            ? 0.09
            : critter.kind === "woodrat"
              ? 0.11
              : critter.kind === "rabbit"
                ? 0.18
                : critter.kind === "quail"
                  ? 0.16
                  : 0.13;
      const legRadius =
        critter.kind === "rabbit" ? 0.035 : critter.kind === "quail" ? 0.021 : 0.026;
      return {
        x: critter.point.x,
        y: terrainHeight(critter.point.x, critter.point.z) + legHeight * 0.5,
        z: critter.point.z,
        sx: legRadius,
        sy: legHeight,
        sz: legRadius,
        color: LAND_WILDLIFE_COLORS[critter.kind],
      };
    }),
    false,
  );

  type CritterPlumePart = { critterIndex: number; segment: number; segments: number };
  const critterPlumeParts: CritterPlumePart[] = [];
  type CritterThinTailPart = { critterIndex: number; segment: number; segments: number };
  const critterThinTailParts: CritterThinTailPart[] = [];
  critters.forEach((critter, critterIndex) => {
    if (critter.tailStyle === "thin") {
      for (let segment = 0; segment < 3; segment++)
        critterThinTailParts.push({ critterIndex, segment, segments: 3 });
    } else {
      const segments = critter.tailStyle === "plume" ? 4 : critter.tailStyle === "feather" ? 2 : 1;
      for (let segment = 0; segment < segments; segment++)
        critterPlumeParts.push({ critterIndex, segment, segments });
    }
  });
  const critterPlumeIndicesByCritter: number[][] = critters.map(() => []);
  critterPlumeParts.forEach((part, index) =>
    critterPlumeIndicesByCritter[part.critterIndex].push(index),
  );
  const critterThinTailIndicesByCritter: number[][] = critters.map(() => []);
  critterThinTailParts.forEach((part, index) =>
    critterThinTailIndicesByCritter[part.critterIndex].push(index),
  );
  const critterPlumes = instances(
    shastaBodyGeo,
    wildlifeMat,
    critterPlumeParts.map(({ critterIndex, segment, segments }) => {
      const critter = critters[critterIndex];
      const fraction = (segment + 1) / segments;
      return {
        x: critter.point.x,
        y: terrainHeight(critter.point.x, critter.point.z) + 0.15,
        z: critter.point.z,
        sx: critter.tailRadius * (1.45 - fraction * 0.45),
        sy: critter.tailRadius * (1.7 - fraction * 0.35),
        sz: (critter.tailLength / segments) * 0.78,
        color: LAND_WILDLIFE_COLORS[critter.kind],
      };
    }),
    false,
  );
  const critterThinTails = instances(
    cylinder,
    wildlifeMat,
    critterThinTailParts.map(({ critterIndex, segment, segments }) => {
      const critter = critters[critterIndex];
      const taper = 1 - segment / (segments * 1.15);
      return {
        x: critter.point.x,
        y: terrainHeight(critter.point.x, critter.point.z) + 0.1,
        z: critter.point.z,
        sx: critter.tailRadius * taper,
        sy: critter.tailLength / segments,
        sz: critter.tailRadius * taper,
        color: LAND_WILDLIFE_COLORS[critter.kind],
      };
    }),
    false,
  );
  canvas.dataset.landWildlife = String(critters.length);
  canvas.dataset.landWildlifeStyle = "anatomical-v4";

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
    mesh(geo(createFishGeometry(kind, color)), mat("#ffffff", { vertexColors: true, flatShading: false, roughness: 0.88 }), [0, 0, 0], [size, size, size], group);
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
  // Leopard sharks use a smooth fusiform body, tapered snout, paired fins and
  // recognizable dark saddle/spot accents rather than a faceted stone shape.
  const sharks: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const shark = new THREE.Group();
    mesh(geo(createSharkGeometry("leopard")), mat("#ffffff", { vertexColors: true, flatShading: false, roughness: 0.86 }), [0, 0, 0], [1, 1, 1], shark);
    reefRoot.add(shark);
    sharks.push(shark);
  }

  // A curved wing outline gives rays a recognizable organic planform while
  // remaining a single low-cost surface.
  const rayGeo = geo(createRayWingGeometry());
  const rayOriginal = new Float32Array(rayGeo.attributes.position.array);
  if (rayGeo.boundingSphere) rayGeo.boundingSphere.radius += 0.16;
  const rays: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const rayGroup = new THREE.Group();
    const rayMat = mat("#687d78", {
      side: THREE.DoubleSide,
      flatShading: false,
      roughness: 0.9,
    });
    const rayBody = mesh(rayGeo, rayMat, [0, 0, 0], [1.18, 0.95, 1], rayGroup);
    rayBody.rotation.x = Math.PI / 2;
    mesh(shastaBodyGeo, rayMat, [0, 0.045, 0.12], [0.28, 0.1, 0.58], rayGroup);
    const rayTail = segment(
      new THREE.Vector3(0, 0, -0.58),
      new THREE.Vector3(0, -0.015, -2.15),
      0.028,
    );
    const tailMesh = mesh(
      cylinder,
      mat("#566d68"),
      [rayTail.x, rayTail.y, rayTail.z],
      [rayTail.sx, rayTail.sy, rayTail.sz],
      rayGroup,
    );
    tailMesh.quaternion.copy(rayTail.q!);
    reefRoot.add(rayGroup);
    rays.push(rayGroup);
  }

  // Octopus, eel and jelly silhouettes use smooth bodies and batched appendages.
  const octopuses: THREE.Group[] = [];
  for (let i = 0; i < 1; i++) {
    const o = new THREE.Group();
    const octMat = mat("#b66c58", { flatShading: false, roughness: 0.92 });
    mesh(shastaBodyGeo, octMat, [0, 0.4, 0], [0.33, 0.46, 0.31], o);
    mesh(shastaBodyGeo, octMat, [0, 0.14, 0.03], [0.39, 0.23, 0.37], o);
    const octEyeMat = mat("#171514", { roughness: 0.42 });
    for (const side of [-1, 1])
      mesh(
        shastaBodyGeo,
        octEyeMat,
        [side * 0.18, 0.44, 0.24],
        [0.045, 0.035, 0.026],
        o,
      );
    const tentacles: Instance[] = [];
    for (let arm = 0; arm < 8; arm++) {
      const a = (arm * Math.PI) / 4;
      const root = new THREE.Vector3(Math.cos(a) * 0.12, 0.1, Math.sin(a) * 0.12);
      const mid = new THREE.Vector3(
        Math.cos(a + 0.12 * Math.sin(arm)) * 0.43,
        0.015,
        Math.sin(a + 0.12 * Math.sin(arm)) * 0.43,
      );
      const tip = new THREE.Vector3(
        Math.cos(a + 0.22 * Math.sin(arm + 1)) * 0.78,
        -0.055,
        Math.sin(a + 0.22 * Math.sin(arm + 1)) * 0.78,
      );
      tentacles.push(segment(root, mid, 0.058), segment(mid, tip, 0.038));
    }
    instances(cylinder, octMat, tentacles, false, o);
    const px = -46, pz = 8;
    o.position.set(px, seaFloorHeight(px, pz) + 0.32, pz);
    reefRoot.add(o);
    octopuses.push(o);
  }

  const eels: THREE.Group[] = [];
  for (let i = 0; i < 1; i++) {
    const eel = new THREE.Group();
    const eelMat = mat("#5b6c4c", { flatShading: false, roughness: 0.9 });
    const eelSegments: Instance[] = [];
    for (let segIndex = 0; segIndex < 7; segIndex++) {
      const taper = 1 - segIndex * 0.075;
      eelSegments.push({
        x: Math.sin(segIndex * 0.55) * 0.075,
        y: Math.sin(segIndex * 0.65) * 0.025,
        z: segIndex * 0.27,
        sx: 0.17 * taper,
        sy: 0.125 * taper,
        sz: 0.25,
      });
    }
    instances(shastaBodyGeo, eelMat, eelSegments, false, eel);
    const px = -49, pz = -1;
    eel.position.set(px, seaFloorHeight(px, pz) + 0.4, pz);
    reefRoot.add(eel);
    eels.push(eel);
  }

  const jellyGeo = geo(
    new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  );
  const jellies: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const jelly = new THREE.Group();
    const jellyMat = mat("#a7cad1", {
      transparent: true,
      opacity: 0.62,
      emissive: "#79aebd",
      emissiveIntensity: 0.12,
      flatShading: false,
    });
    mesh(jellyGeo, jellyMat, [0, 0, 0], [0.42, 0.28, 0.42], jelly);
    const tentacles: Instance[] = [-1, 0, 1].map((t) => ({
      x: t * 0.12,
      y: -0.38,
      z: 0,
      sx: 0.018,
      sy: 0.72,
      sz: 0.018,
    }));
    instances(cylinder, jellyMat, tentacles, false, jelly);
    reefRoot.add(jelly);
    jellies.push(jelly);
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

  // --- Warm-water Society Islands-inspired lagoon -----------------------------
  // This second reef lives on the island's east shelf and stays fully culled while
  // the player is in the California kelp coast. Most detail is instanced so adding
  // coral/fish density costs instances rather than draw calls.
  const tropicalReefRoot = new THREE.Group();
  tropicalReefRoot.visible = false;
  scene.add(tropicalReefRoot);

  const reefGarden = createReefGarden(tropicalReefRoot);
  const marineSchools = createMarineSchools(reefRoot,tropicalReefRoot);
  const goldenTridents = createWorldTridents(reefRoot,tropicalReefRoot);
  canvas.dataset.schoolingFish = String(marineSchools.count);
  canvas.dataset.goldenTridents = String(goldenTridents.count);


  type TropicalFishState = {
    centerX: number;
    centerZ: number;
    radiusX: number;
    radiusZ: number;
    baseY: number;
    speed: number;
    phase: number;
    size: number;
    color: string;
    bodyX: number;
    bodyY: number;
    bodyZ: number;
  };
  const tropicalFishPalette = [
    "#f0c84b",
    "#5eb8cb",
    "#6b73c9",
    "#e57f55",
    "#75b86d",
    "#e9e1c2",
    "#9d63bd",
  ];
  const tropicalFishStates: TropicalFishState[] = Array.from(
    { length: 34 },
    (_, i) => {
      const centerZ = -15 + (i % 7) * 8 + random() * 3;
      const centerX = eastCoastlineX(centerZ) + 9 + random() * 9;
      const shape = i % 3;
      const proportions =
        shape === 0
          ? { bodyX: 0.3, bodyY: 0.2, bodyZ: 1.15 } // slender fusiform
          : shape === 1
            ? { bodyX: 0.48, bodyY: 0.42, bodyZ: 0.78 } // deep-bodied reef fish
            : { bodyX: 0.4, bodyY: 0.27, bodyZ: 0.94 }; // general oval
      return {
        centerX,
        centerZ,
        radiusX: 1.7 + random() * 5.2,
        radiusZ: 2.4 + random() * 6.6,
        baseY: -2.8 - random() * 4.8,
        speed: 0.18 + random() * 0.24,
        phase: random() * Math.PI * 2,
        size: 0.22 + random() * 0.34,
        color: tropicalFishPalette[i % tropicalFishPalette.length],
        ...proportions,
      };
    },
  );
  const tropicalFishBodies = instances(
    geo(createFishBodyGeometry()),
    mat("#ffffff", { flatShading: false, roughness: 0.86 }),
    tropicalFishStates.map((fish) => ({
      x: fish.centerX,
      y: fish.baseY,
      z: fish.centerZ,
      sx: fish.size * fish.bodyX,
      sy: fish.size * fish.bodyY,
      sz: fish.size * fish.bodyZ,
      color: fish.color,
    })),
    false,
    tropicalReefRoot,
  );
  const tropicalFishTails = instances(
    geo(createCaudalFinGeometry()),
    mat("#ffffff"),
    tropicalFishStates.map((fish) => ({
      x: fish.centerX,
      y: fish.baseY,
      z: fish.centerZ - fish.size,
      sx: fish.size * (fish.bodyX * 0.58),
      sy: fish.size * (fish.bodyY * 1.5),
      sz: fish.size * 0.11,
      color: fish.color,
    })),
    false,
    tropicalReefRoot,
  );
  const tropicalFishDorsals = instances(
    geo(createDorsalFinGeometry()),
    mat("#ffffff"),
    tropicalFishStates.map((fish) => ({
      x: fish.centerX,
      y: fish.baseY + fish.size * fish.bodyY * 0.8,
      z: fish.centerZ - fish.size * 0.05,
      sx: fish.size * 0.07,
      sy: fish.size * (fish.bodyY * 0.9),
      sz: fish.size * 0.1,
      color: fish.color,
    })),
    false,
    tropicalReefRoot,
  );

  type TropicalFishPectoral = { fishIndex: number; side: -1 | 1 };
  const tropicalFishPectoralStates: TropicalFishPectoral[] =
    tropicalFishStates.flatMap((_, fishIndex) => [
      { fishIndex, side: -1 as const },
      { fishIndex, side: 1 as const },
    ]);
  const tropicalFishPectorals = instances(
    geo(createPectoralFinGeometry()),
    mat("#ffffff", { roughness: 0.9 }),
    tropicalFishPectoralStates.map(({ fishIndex }) => {
      const fish = tropicalFishStates[fishIndex];
      return {
        x: fish.centerX,
        y: fish.baseY,
        z: fish.centerZ,
        sx: fish.size * 0.055,
        sy: fish.size * fish.bodyX * 0.62,
        sz: fish.size * 0.05,
        color: fish.color,
      };
    }),
    false,
    tropicalReefRoot,
  );
  type TropicalFishEye = { fishIndex: number; side: number };
  const tropicalFishEyeStates: TropicalFishEye[] = tropicalFishStates.flatMap(
    (_, fishIndex) => [
      { fishIndex, side: -1 },
      { fishIndex, side: 1 },
    ],
  );
  const tropicalFishEyes = instances(
    shastaBodyGeo,
    mat("#172226", { flatShading: false, roughness: 0.6 }),
    tropicalFishEyeStates.map(({ fishIndex }) => {
      const fish = tropicalFishStates[fishIndex];
      return {
        x: fish.centerX,
        y: fish.baseY,
        z: fish.centerZ + fish.size * fish.bodyZ * 0.55,
        sx: fish.size * 0.045,
        sy: fish.size * 0.045,
        sz: fish.size * 0.03,
      };
    }),
    false,
    tropicalReefRoot,
  );

  type TropicalRay = {
    object: THREE.Group;
    kind: "manta" | "eagle" | "sting";
    radiusX: number;
    radiusZ: number;
    speed: number;
    phase: number;
    baseY: number;
  };
  const tropicalRays: TropicalRay[] = [];
  function makeTropicalRay(
    kind: TropicalRay["kind"],
    color: string,
    radiusX: number,
    radiusZ: number,
    speed: number,
    phase: number,
    baseY: number,
  ) {
    const group = new THREE.Group();
    const scale =
      kind === "manta"
        ? { x: 2.25, z: 1.55 }
        : kind === "eagle"
          ? { x: 1.55, z: 1.18 }
          : { x: 1.15, z: 0.98 };
    const rayMat = mat(color, {
      side: THREE.DoubleSide,
      flatShading: false,
      roughness: 0.88,
    });
    const body = mesh(
      rayGeo,
      rayMat,
      [0, 0, 0],
      [scale.x, scale.z, 1],
      group,
    );
    body.rotation.x = Math.PI / 2;
    mesh(
      shastaBodyGeo,
      rayMat,
      [0, 0.045, 0.12],
      [
        kind === "manta" ? 0.4 : 0.3,
        kind === "manta" ? 0.12 : 0.1,
        kind === "manta" ? 0.68 : 0.52,
      ],
      group,
    );
    const tailLength = kind === "manta" ? 2.1 : kind === "eagle" ? 2.8 : 2.2;
    const rayTail = segment(
      new THREE.Vector3(0, 0, -0.55),
      new THREE.Vector3(0, 0, -tailLength),
      kind === "manta" ? 0.04 : 0.03,
    );
    const tailMesh = mesh(
      cylinder,
      mat(kind === "eagle" ? "#565f5b" : color),
      [rayTail.x, rayTail.y, rayTail.z],
      [rayTail.sx, rayTail.sy, rayTail.sz],
      group,
    );
    tailMesh.quaternion.copy(rayTail.q!);
    if (kind === "manta") {
      for (const side of [-1, 1]) {
        const lobe = mesh(cone, mat("#485b62"), [side * 0.3, 0.02, 0.72], [0.16, 0.34, 0.14], group);
        lobe.rotation.x = -Math.PI / 2;
      }
    } else if (kind === "eagle") {
      const spots: Instance[] = [];
      for (let i = 0; i < 9; i++)
        spots.push({
          x: (random() - 0.5) * 1.6,
          y: 0.035,
          z: (random() - 0.5) * 0.9,
          sx: 0.055,
          sy: 0.025,
          sz: 0.055,
        });
      instances(shastaBodyGeo, mat("#d8e1d5", { flatShading: false }), spots, false, group);
    }
    tropicalReefRoot.add(group);
    tropicalRays.push({ object: group, kind, radiusX, radiusZ, speed, phase, baseY });
  }
  makeTropicalRay("manta", "#526870", 8.5, 13.5, 0.075, 0.2, -5.4);
  makeTropicalRay("eagle", "#65716a", 7.2, 10.5, 0.095, 2.1, -4.2);
  makeTropicalRay("sting", "#a48e6b", 5.8, 8.2, 0.11, 4.0, -3.6);

  const tropicalSharks: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const shark = new THREE.Group();
    mesh(geo(createSharkGeometry("blacktip")), mat("#ffffff", { vertexColors: true, flatShading: false, roughness: 0.86 }), [0, 0, 0], [1, 1, 1], shark);
    tropicalReefRoot.add(shark);
    tropicalSharks.push(shark);
  }

  const tropicalMotePositions = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    const z = -20 + random() * 58;
    const x = eastCoastlineX(z) + 4 + random() * 19;
    const floor = seaFloorHeight(x, z);
    tropicalMotePositions.set(
      [x, floor + 0.5 + random() * Math.max(0.8, SEA_SURFACE - floor - 1.0), z],
      i * 3,
    );
  }
  const tropicalMoteGeo = geo(new THREE.BufferGeometry());
  tropicalMoteGeo.setAttribute("position", new THREE.BufferAttribute(tropicalMotePositions, 3));
  const tropicalMoteMat = new THREE.PointsMaterial({
    color: "#e7f7e6",
    size: 0.05,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  materials.add(tropicalMoteMat);
  const tropicalMotes = new THREE.Points(tropicalMoteGeo, tropicalMoteMat);
  tropicalReefRoot.add(tropicalMotes);
  canvas.dataset.lagoonSpecies = "8";
  canvas.dataset.coralForms = "9";
  canvas.dataset.marineWildlifeStyle = "anatomical-v3";

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
  scene.add(bubbles);
  bubbles.visible = false;

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
    challengeSerial: 0,
    bigAirSerial: 0,
    discGolfStartSerial:0,
    discGolfHoleIndex:0,
    discGolfShotSerial:0,
    discGolfShot:null,
    discGolfPreview:null,
    discGolfExitSerial:0,
    discGolfSwingStage:"idle",
    discGolfSwingAmount:0,
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
  let caveLayer: CaveLayer = "surface";
  let travel: Travel = { point: player, speed: 0, heading: { x: 0, z: -1 } };
  let airHeight = 0, verticalSpeed = 0, lastAction = 0, lastWaterAction = 0;
  let lastChallengeSerial=0, lastTrialUpdate=0;
  let lastBigAirSerial=0,lastBigAirUpdate=0;
  let bigAir:BigAirState=idleBigAir();
  let discGolf:DiscGolfState=idleDiscGolf();
  let jetSki:JetSkiState|null=null;
  let jetRivals:JetSkiState[]=[];
  let jetMilestone='';
  let jetCountdown=0;
  let jetNoticeUntil=0;
  let jetSessionBest:number|null=null;
  let jetWakeSamples:JetSkiWakePoint[]=[];
  let jetWakeAccumulator=0;
  let selectedJetSki:"touring"|"sport"|"race"="sport";
  let jetRideMode:"race"|"free"="race";
  let jetChoosing=false;
  let discFetch=idleDiscGolfFetch();
  let lastDiscStart=0,lastDiscShot=0,lastDiscExit=0,lastDiscUpdate=0;
  let lastDiscPreview:DiscShot|null=null,lastPreviewTick=-Infinity;
  let lastDiscPreviewPhase=discGolf.phase;
  // Local camera-only state: it never mutates the simulation, scoring or lie.
  let discGolfIntro:{startedAt:number;reducedMotion:boolean}|null=null;
  let snapDiscCamera=false;
  let lastDiscCameraSolve:{
    desired:THREE.Vector3;focus:THREE.Vector3;position:THREE.Vector3;
    clear:boolean;adjusted:boolean;blocking:number;
  }|null=null;
  let trial:TrialState={phase:"idle",nextGate:0,elapsedMs:0,splitsMs:[]};
  let rideBoost=initialRideBoost();
  let rideBoostNoticeUntil=0;
  let rideBoostNotice="";
  function resetRideBoost(){
    rideBoost=initialRideBoost();
    rideBoostNoticeUntil=0;rideBoostNotice="";
  }
  let aquatic: AquaticMode = "land", swimDepth = 0, targetDepth = 0;
  let climb: { from: Point; to: Point; fromY: number; toY: number; progress: number } | null = null;
  let grind: {
    log: GrindRail;
    t: number;
    direction: number;
    style: GrindStyle;
    mode: "skate" | "ski";
    covered: number;
  } | null = null;
  let lastRampAt = -10, lastRampId = "";
  const skateBestKey="sid-world:skate-line-best-v1";
  let skateTrick=idleSkateTrick(),skateWindupAt=-Infinity,skatePadPrimed=false;
  try {
    const saved=Number(window.localStorage.getItem(skateBestKey));
    if(Number.isFinite(saved)&&saved>=0)skateTrick.best=Math.min(saved,1e9);
  }catch{/* Persistent records remain optional in privacy-restricted browsers. */}
  function saveSkateBest(next:SkateTrickState){
    if(next.best<=skateTrick.best)return;
    try{window.localStorage.setItem(skateBestKey,String(next.best));}
    catch{/* Gameplay keeps its in-memory best. */}
  }
  let skateHasBeenAirborne=false,skatePadPushHeld=false,skateCarveLean=0;
  let playerY = groundHeight(player);
  // Single source of truth for mutually exclusive minigame entrances.
  const occupiedByOtherMode=(requested:WorldGameMode)=>
    !canStartWorldGame(requested,{
      jet:!!jetSki||jetChoosing,
      ski:bigAir.phase==="armed"||bigAir.phase==="flying",
      disc:discGolf.phase!=="off",
      trial:trial.phase==="armed"||trial.phase==="running",
    });
  function stopJetSki(){
    if(!jetSki)return;
    jetSki=null;jetRivals=[];jetMilestone="";
    callbacks.onJetSkiMode(false);
    jetRideMode="race";
    jetCountdown=0;jetNoticeUntil=0;jetNotice.style.display="none";
    jetWakeSamples=[];jetWakeAccumulator=0;
    jetTouchInput.throttle=0;jetTouchInput.steer=0;jetTouchInput.brake=false;
    jetBoostState.active=false;
    player={x:JET_SKI_PIER.rampEndX+1,z:JET_SKI_PIER.centerZ};
    playerY=groundHeight(player);
    travel={point:player,speed:0,heading:{x:1,z:0}};
    destination=null;
    jetHud.style.display="none";
    canvas.dataset.jetSkiStatus="docked";
    canvas.focus({preventScroll:true});
  }
  function closeJetChooser(){
    jetChoosing=false;
    jetChooser.hidden=true;
    canvas.dataset.jetSkiChooser="closed";
    callbacks.onJetSkiMode(false);
    keys.clear();
    canvas.focus({preventScroll:true});
  }
  function openJetChooser(){
    if(!state.entered||state.paused||jetSki||occupiedByOtherMode("jet")||
       aquatic!=="land"||!nearJetSkiBoarding(player))return;
    jetChoosing=true;
    jetskiVisual.activeHull.material.color.set("#e96c48");
    jetChooser.hidden=false;
    canvas.dataset.jetSkiChooser="open";
    callbacks.onJetSkiMode(true);
    destination=null;travel.speed=0;keys.clear();
    jetChoiceButtons[0][0].focus({preventScroll:true});
  }
  function chooseJetSki(choice:string){
    if(!jetChoosing)return;
    const craft=choice==="touring"?"touring":choice==="race"?"race":"sport";
    jetRideMode=choice==="free"?"free":"race";
    selectedJetSki=craft;
    closeJetChooser();
    boardJetSki();
  }
  function boardJetSki(){
    if(!state.entered||state.paused||jetSki||occupiedByOtherMode("jet")||
       aquatic!=="land"||!nearJetSkiBoarding(player))return;
    resetRideBoost();
    jetSki=startJetSkiRace(selectedJetSki);jetMilestone="";
    callbacks.onJetSkiMode(true);
    jetCountdown=jetRideMode==="race"?3.3:0;jetNoticeUntil=0;
    jetWakeSamples=[];jetWakeAccumulator=0;
    jetRivals=jetRideMode==="race"?[
      {...startJetSkiRace("sport"),position:{x:70,z:7}},
      {...startJetSkiRace("touring"),position:{x:73,z:5}},
    ]:[];
    jetskiVisual.activeHull.material.color.set(
      selectedJetSki==="touring"?"#f3c24d":selectedJetSki==="sport"?"#e96c48":"#39bdc5");
    destination=null;setAquaticMode("land");canvas.dataset.jetSkiStatus="racing";
    canvas.dataset.jetSkiMode=jetRideMode;
    canvas.focus({preventScroll:true});
  }
  function restartJetSki(){
    if(!jetSki)return;
    const selected=jetSki.craft;
    const currentMode=jetRideMode;
    stopJetSki();
    selectedJetSki=selected;
    jetRideMode=currentMode;
    boardJetSki();
  }
  const supportHeight = (p: Point) => {
    const layer = supportLayerAtPoint(caveLayer, p, playerY);
    if (layer === "arcade") return arcadeCaveFloorHeight(p);
    if (layer === "paper") return paperCaveFloorHeight(p);
    return groundHeight(p);
  };
  explorer.rotation.order = "YXZ";
  let dog: Point = { x: 3, z: 12 };
  let dogVelocity: Point = { x: 0, z: 0 };
  let dogSmoothedTarget: Point = { ...dog };
  let fetchRunRoute=idleFetchRunRoute();
  // Broadphase: terrain/vegetation obstacles are static. Only reselect a
  // padded local working set when Shasta has actually traveled several units.
  let dogObstacleAnchor:Point|null=null;
  let dogLocalObstacles:Obstacle[]=[];
  let dogObstacleRefreshes=0;
  let dogYaw = 0;
  let dogPitch = 0;
  let dogRoll = 0;
  let dogGroundY = discGolfSurfaceHeight(dog);
  const dogFootGround=[0,0,0,0];
  let dogCameraAnchor:ShastaCameraAnchor|null=null;
  let dogGaitPhase = 0;
  let dogMoveBlend = 0;
  let shastaSnow=idleShastaSnowPlay();
  let snowStagesSeen:string[]=[];
  let snowMaxRoll=0;
  let dogAnimSpeed = 0;
  let dogInterestCritterIndex: number | null = null;
  let dogChase = initialChaseState();

  let dogTargetSwitches = 0;
  let dogMaxYawStep = 0;
  let dogMaxYStep = 0;
  let dogMaxMoveBlend = 0;
  let dogMaxAcceleration = 0;
  let lastDogSpeed = 0;
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
  function fireRideShot(x:number,y:number){
    const currentMode=effectiveActivity(state.activity,player);
    if(!isBoostActivity(currentMode)||aquatic!=="land"||jetSki||jetChoosing||
      discGolf.phase!=="off"||bigAir.phase==="flying"||state.paused)return false;
    const rect=canvas.getBoundingClientRect();
    pointer.set(((x-rect.left)/rect.width)*2-1,
      (-(y-rect.top)/rect.height)*2+1);
    ray.setFromCamera(pointer,camera);
    const hit=ray.intersectObjects(rideVisual.targets,false)
      .find(h=>h.object.parent?.visible);
    // The shooter must have visual line of sight. Hills can hide an offshore
    // marker from some approaches; do not score hits through the terrain.
    const terrainHit=ray.intersectObject(ground,false)[0];
    const clear=!!hit&&(!terrainHit||terrainHit.distance>hit.distance+.08);
    const target=clear&&hit&&hit.distance<=65?
      rideVisual.targetFromHit(hit.object):null;
    const endpoint=hit&&clear?hit.point:terrainHit&&terrainHit.distance<28?
      terrainHit.point:ray.ray.at(28,new THREE.Vector3());
    rideVisual.fireTracer(new THREE.Vector3(player.x,playerY+1.35,player.z),
      endpoint,elapsed);
    const previous=rideBoost;
    if(target)rideBoost=fireRideBoost(target,currentMode,player,
      travel.speed,elapsed,rideBoost);
    const success=rideBoost!==previous;
    rideBoostNotice=success?"BOOST HIT · +"+RIDE_BOOST_DURATION.toFixed(1)+"s":
      travel.speed<2.25?"BUILD SPEED TO FIRE":
      target?"TARGET RECHARGING OR TOO FAR":"MISS · AIM AT A GLOWING RING";
    rideBoostNoticeUntil=elapsed+1.35;
    rideAnnounce.textContent=rideBoostNotice;
    canvas.dataset.rideBoostLastShot=success?"hit":"miss";
    return true;
  }
  function onUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const wasClick = !drag.moved;
    drag = null;
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    if (!wasClick || state.paused || discGolf.phase!=="off" || jetSki) return;
    // While moving on sport gear the pointer is a skill shot, never an
    // accidental click-to-move. Drag retains normal orbit-camera behavior.
    if(travel.speed>1.5&&fireRideShot(e.clientX,e.clientY))return;
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
        if (caveLayer === "arcade" && arcadeInside(player) && distance(player, arcadeWall) < 7.4) callbacks.onInteract(discoveryId);
        else destination = { x: arcadeWall.x, z: arcadeWall.z - 4.2 };
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
    // Aiming or throwing interrupts the introductory flyback immediately.
    // Let the HUD handle the same keystroke; do not fire world actions here.
    if(discGolf.phase!=="off"){
      const k=e.key.toLowerCase();
      if(discGolfIntro && (k==="escape"||k===" "||
        ["w","a","s","d","q","e","arrowup","arrowdown","arrowleft","arrowright"].includes(k))){
        discGolfIntro=null;snapDiscCamera=true;
        if(k==="escape")e.preventDefault();
      }
      return;
    }
    // Canvas focus can move to a touch/accessible control while riding.
    // Keep steering active inside the world, but never grab keys from the
    // surrounding site or a text field.
    if(e.target !== canvas && !(jetSki&&
      (e.target===document.body||host.contains(e.target as Node))))return;
    const key = e.key.toLowerCase();
    if(key==="escape"&&jetSki){stopJetSki();e.preventDefault();return;}
    if(key==="r"&&!e.repeat&&jetSki){restartJetSki();e.preventDefault();return;}
    if(key==="f"&&!e.repeat&&!jetSki&&isBoostActivity(state.activity)){
      e.preventDefault();
      const rect=canvas.getBoundingClientRect();
      fireRideShot(rect.left+rect.width/2,rect.top+rect.height/2);
      return;
    }
    if(state.activity==="skate"&&!jetSki&&aquatic==="land"&&!e.repeat){
      if(key==="arrowdown"){
        skateWindupAt=elapsed;e.preventDefault();return;
      }
      if(["arrowup","arrowleft","arrowright"].includes(key)){
        const hold=Number.isFinite(skateWindupAt)?Math.max(0,elapsed-skateWindupAt):0;
        skateWindupAt=-Infinity;
        launchSkateTrick(flickTrick(key.slice(5) as "up"|"left"|"right",hold));
        e.preventDefault();return;
      }
      if(key==="q"||key==="e"){
        skateTrick=setSkateGrab(skateTrick,key==="q"?"left":"right");
        e.preventDefault();return;
      }
      if(key==="j"||key==="l"){
        skateTrick=queueSkateSpin(skateTrick,key==="j"?-1:1,elapsed);
        e.preventDefault();return;
      }
      if(key==="c"||key==="x"){
        skateTrick=startSkateManual(skateTrick,key==="c"?"manual":"nose-manual",travel.speed);
        e.preventDefault();return;
      }
    }
    // The land jump action must not fire while steering a jet ski.
    if(jetSki&&key===" "){if(e.target===canvas)e.preventDefault();return;}
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
      if(state.activity!=="skate"||!key.startsWith("arrow"))keys.add(key);
      destination = null;
      e.preventDefault();
    }
    if (key === "enter" && !e.repeat && !jetSki&&nearJetSkiBoarding(player)&&aquatic==="land") {
      e.preventDefault();openJetChooser();return;
    }
    if (key === "enter" && !e.repeat && discovery) {
      e.preventDefault();
      callbacks.onInteract(discovery);
    }
  }
  function keyUp(e: KeyboardEvent) {
    const key=e.key.toLowerCase();
    keys.delete(key);
    if(key==="q"||key==="e")skateTrick=setSkateGrab(skateTrick,"none");
    if(key==="c"||key==="x"){
      const next=finishSkateManual(skateTrick,elapsed);
      saveSkateBest(next);skateTrick=next;
    }
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
  function launchSkateTrick(name:SkateTrickName){
    if(state.activity!=="skate"||!state.entered||state.paused||document.hidden||
      aquatic!=="land"||jetSki||jetChoosing||discGolf.phase!=="off"||
      trial.phase==="armed"||trial.phase==="running"||
      bigAir.phase==="flying"||bigAir.phase==="armed"||climb||
      (airHeight>.08&&verticalSpeed<=0)||skateTrick.phase==="air")return;
    const naturalFlight=airHeight>.08&&verticalSpeed>0;
    if(grind)grind=null; // pop off a rail instead of locking the player on it
    const next=startSkateTrick(skateTrick,name,elapsed,travel.speed);
    if(next===skateTrick)return;
    saveSkateBest(next);skateTrick=next;skateHasBeenAirborne=false;
    if(!naturalFlight){
      verticalSpeed=Math.min(7.6,5.9+Math.min(14,travel.speed)*.1);
      playerY=Math.max(playerY,supportHeight(player)+.04);airHeight=.04;
    }else skateHasBeenAirborne=true;
    destination=null;
  }
  function performAction() {
    if (!state.entered || state.paused || document.hidden || aquatic !== "land" ||
      discGolf.phase!=="off"||jetSki||jetChoosing||
      trial.phase==="armed"||trial.phase==="running"||
      (bigAir.phase!=="idle"&&bigAir.phase!=="armed")||
      climb||(grind&&state.activity!=="skate")||
      (airHeight>0.01&&!(state.activity==="skate"&&verticalSpeed>0.1)))return;
    if(state.activity==="ski"&&mountainJumpEligible(player,supportHeight(player),travel.speed)){
      const ahead={x:player.x+travel.heading.x*2.1,
        z:player.z+travel.heading.z*2.1};
      const drop=Math.max(0,supportHeight(player)-supportHeight(ahead));
      bigAir=launchBigAir(player,supportHeight(player),travel.speed,travel.heading,true,drop);
      playerY=bigAir.y;airHeight=.04;verticalSpeed=bigAir.verticalSpeed;
      callbacks.onBigAir(bigAir);
      return;
    }
    if(state.activity==="skate"&&airHeight>.08){launchSkateTrick("Ollie");return;}
    if(grind&&state.activity==="skate"){launchSkateTrick("Ollie");return;}
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
          covered:0,
        };
        destination = null;
        verticalSpeed = airHeight = 0;
        return;
      }
    }
    if(state.activity==="skate"){launchSkateTrick("Ollie");return;}
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
    if(skateTrick.manual!=="none"){
      const next=finishSkateManual(skateTrick,elapsed);
      saveSkateBest(next);skateTrick=next;
    }
    skateWindupAt=-Infinity;skatePadPrimed=false;skatePadPushHeld=false;skateCarveLean=0;
    keys.clear();
    travel.speed = 0;
    drag = null;
    destination = null;
  }
  function clearHeldJetControls(){
    clearInput();
    jetTouchInput.throttle=0;jetTouchInput.steer=0;jetTouchInput.brake=false;
    jetBoostState.active=false;
  }
  function visibility() {
    clearHeldJetControls();
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
  window.addEventListener("blur", clearHeldJetControls);
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
    const fetchNow=now*.001;
    const rawDelta = (now - last) / 1000,
      dt = Math.min(rawDelta, 0.05);
    last = now;
    elapsed += dt;
    let dx = 0,
      dz = 0;
    let showingDiscGolfIntro=false;
    if (state.entered) {
      const forward =
        Number(keys.has("w") || keys.has("arrowup")) -
        Number(keys.has("s") || keys.has("arrowdown"));
      const right =
        Number(keys.has("d") || keys.has("arrowright")) -
        Number(keys.has("a") || keys.has("arrowleft"));
      dx = -Math.sin(yaw) * forward + Math.cos(yaw) * right;
      dz = -Math.cos(yaw) * forward - Math.sin(yaw) * right;
      if(state.activity==="skate"&&!jetSki&&discGolf.phase==="off"){
        const pads=navigator.getGamepads?.();
        const pad=pads?Array.from(pads).find(p=>p?.connected):null;
        if(pad){
          const lx=pad.axes[0]??0,ly=pad.axes[1]??0;
          if(Math.hypot(lx,ly)>.22){
            dx=Math.cos(yaw)*lx+Math.sin(yaw)*ly;
            dz=-Math.sin(yaw)*lx+Math.cos(yaw)*ly;
          }
          const fx=pad.axes[2]??0,fy=pad.axes[3]??0;
          if(fy>.65&&!skatePadPrimed){skatePadPrimed=true;skateWindupAt=elapsed;}
          if(skatePadPrimed&&(fy<-.58||Math.abs(fx)>.7)){
            const direction=fy<-.58?"up":fx<0?"left":"right";
            launchSkateTrick(flickTrick(direction,Math.max(0,elapsed-skateWindupAt)));
            skatePadPrimed=false;skateWindupAt=-Infinity;
          }
          if(pad.buttons[0]?.pressed&&!keys.has(" ")){
            // Edge-trigger on A so holding push never repeats an ollie.
            if(!skatePadPushHeld)launchSkateTrick("Ollie");
            skatePadPushHeld=true;
          }else skatePadPushHeld=false;
        }else skatePadPushHeld=false;
      }
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
      if(jetSki){
        const drive=jetSkiControlInput(keys,jetTouchInput,jetBoostState.active,jetSki.speed);
        const previousGate=jetSki.checkpoint;
        const previousLap=jetSki.lap;
        const previousPhase=jetSki.phase;
        if(jetCountdown>0){
          // Countdown follows real elapsed time, not tiny fixed physics ticks
          // on slow GPUs or accessibility/reduced-motion hardware.
          jetCountdown=Math.max(0,jetCountdown-Math.min(rawDelta,.35));
          if(jetCountdown===0){
            jetNotice.textContent="GO!";
            jetNoticeUntil=elapsed+.85;
          }
        }else{
          jetSki=stepJetSkiRace(jetSki,dt,drive,
            jetSkiNavigableWater,jetRideMode==="race");
          jetRivals=jetRivals.map(rival=>stepJetSkiRace(
            rival,dt,jetSkiOpponentInput(rival),jetSkiNavigableWater));
        }
        if(jetRideMode==="race"&&jetSki.phase!==previousPhase&&jetSki.phase==="finished"){
          if(jetSessionBest===null||jetSki.elapsed<jetSessionBest)
            jetSessionBest=jetSki.elapsed;
          jetNotice.textContent="FINISH · "+jetSki.elapsed.toFixed(1)+"s";
          jetNoticeUntil=elapsed+3.5;
        }else if(jetRideMode==="race"&&jetSki.lap>previousLap){
          jetNotice.textContent="LAP "+jetSki.lap+" COMPLETE · +8 TURBO";
          jetNoticeUntil=elapsed+2;
        }else if(jetRideMode==="race"&&jetSki.checkpoint!==previousGate){
          jetNotice.textContent="CHECKPOINT "+jetSki.checkpoint+" · +8 TURBO";
          jetNoticeUntil=elapsed+1.25;
        }
        jetNotice.style.display=jetCountdown>0||elapsed<jetNoticeUntil?"block":"none";
        if(jetCountdown>0)jetNotice.textContent=String(Math.ceil(jetCountdown));
        jetskiVisual.opponents.forEach((object,i)=>{
          const rival=jetRivals[i];
          object.visible=!!rival;
          if(!rival)return;
          object.position.set(rival.position.x,SEA_SURFACE+.2+rival.waterHeight+
            rival.jumpHeight,rival.position.z);
          object.rotation.y=rival.heading;
          object.rotation.z=rival.roll;
          object.rotation.x=rival.pitch;
        });
        player={...jetSki.position};playerY=SEA_SURFACE+.65;
        travel={point:player,speed:jetSki.speed,
          heading:{x:Math.sin(jetSki.heading),z:Math.cos(jetSki.heading)}};
        explorer.rotation.y=jetSki.heading;
        airHeight=verticalSpeed=0;destination=null;
        jetskiVisual.activeSki.visible=true;
        jetskiVisual.activeSki.position.set(player.x,
          SEA_SURFACE+.2+jetSki.waterHeight+jetSki.jumpHeight,player.z);
        jetskiVisual.activeSki.rotation.y=jetSki.heading;
        jetskiVisual.activeSki.rotation.z=jetSki.roll;
        jetskiVisual.activeSki.rotation.x=jetSki.pitch;
        jetskiVisual.wake.visible=jetSki.speed>2&&jetSki.jumpHeight<.1;
        jetskiVisual.wake.position.x=player.x-Math.sin(jetSki.heading)*1.1;
        jetskiVisual.wake.position.z=player.z-Math.cos(jetSki.heading)*1.1;
        jetskiVisual.wake.rotation.z=-jetSki.heading;
        jetskiVisual.wake.material.opacity=jetSki.boosting?.9:.58;
        jetskiVisual.wake.scale.setScalar(1+Math.min(3.4,Math.abs(jetSki.speed)/9));
        // A bounded foam history makes acceleration and turns visible, with
        // no per-frame mesh allocation or extra individual draw calls.
        jetWakeSamples=jetWakeSamples.filter(p=>{
          p.age+=dt;return p.age<1.9;
        });
        if(jetSki.phase==="racing"&&jetSki.speed>3&&jetSki.jumpHeight<.12){
          jetWakeAccumulator+=dt;
          if(jetWakeAccumulator>=.09){
            jetWakeAccumulator%= .09;
            const h=jetSki.heading;
            jetWakeSamples.unshift({
              x:player.x-Math.sin(h)*1.55,z:player.z-Math.cos(h)*1.55,
              heading:h,speed:jetSki.speed,age:0,boosting:jetSki.boosting,
            });
            if(jetWakeSamples.length>38)jetWakeSamples.length=38;
          }
        }else jetWakeAccumulator=0;
        jetskiVisual.updateWakeTrail(jetWakeSamples,elapsed);
        jetskiVisual.updateGateFocus(jetSki.checkpoint,elapsed,
          jetRideMode==="race"&&jetSki.phase==="racing");
        jetskiVisual.buoys.forEach((b,i)=>{b.visible=jetRideMode==="race";
          b.scale.setScalar(i===jetSki!.checkpoint?1.7:1);});
        canvas.dataset.jetSkiStatus=jetSki.phase;
        const milestone=`${jetSki.phase}:${jetSki.lap}:${jetSki.checkpoint}`;
        if(milestone!==jetMilestone&&jetRideMode==="race"){
          jetMilestone=milestone;
          jetAnnounce.textContent=jetSki.phase==="finished"?"Jet ski race finished":
            `Lap ${jetSki.lap+1}, checkpoint ${jetSki.checkpoint+1}`;
        }
        canvas.dataset.jetSkiLap=String(jetSki.lap+1);
        canvas.dataset.jetSkiGate=String(jetSki.checkpoint+1);
        canvas.dataset.jetSkiSpeed=jetSki.speed.toFixed(1);
        canvas.dataset.jetSkiHeading=jetSki.heading.toFixed(3);
        canvas.dataset.jetSkiTime=jetSki.elapsed.toFixed(1);
        canvas.dataset.jetSkiTurbo=jetSki.turbo.toFixed(0);
        canvas.dataset.jetSkiBoosting=String(jetSki.boosting);
        canvas.dataset.jetSkiBoostLocked=String(jetSki.boostLocked);
        canvas.dataset.jetSkiWaveHeight=jetSki.waterHeight.toFixed(2);
        canvas.dataset.jetSkiJump=jetSki.jumpHeight.toFixed(2);
        canvas.dataset.jetSkiRockHits=String(jetSki.rockHits);
        canvas.dataset.jetSkiCourseWater=String(jetSkiNavigableWater(player));
        const place=jetSkiRacePlace(jetSki,jetRivals);
        canvas.dataset.jetSkiPlace=String(place);
        jetskiVisual.skis.forEach((ski,i)=>{ski.visible=i!==(
          selectedJetSki==="touring"?0:selectedJetSki==="sport"?1:2);});
        jetHud.style.display="block";
        jetTurboBar.style.display="block";
        jetTurboFill.style.width=jetSki.turbo.toFixed(1)+"%";
        jetTurboBar.setAttribute("aria-valuenow",jetSki.turbo.toFixed(0));
        const boostStatus=jetSki.boosting?"BOOSTING":
          jetSki.boostLocked?"BOOST RECHARGING":
          jetSki.turbo>=20?"BOOST READY":"BOOST LOW";
        jetBoostButton.dataset.boostState=jetSki.boosting?"active":
          jetSki.boostLocked?"charging":"ready";
        jetBoostButton.setAttribute("aria-description",boostStatus+
          ". Hold for acceleration; releasing rearms a recharged boost.");
        jetTurboFill.style.background=jetSki.boosting?"#f2d16d":
          jetSki.boostLocked?"#8da8b0":"#91edcb";
        const gateBearing=jetSkiBearingToGate(jetSki);
        const turnGuide=Math.abs(gateBearing)<.22?"↑":
          Math.abs(gateBearing)<.72?(gateBearing>0?"↗":"↖"):
          gateBearing>0?"→":"←";
        const swellStatus=jetSki.roughness>1.05?" · BIG SWELLS":"";
        const compactJetHud=jetCountdown>0?
          `START IN ${Math.ceil(jetCountdown)} · ${jetSki.craft.toUpperCase()}`:
          jetSki.phase==="finished"?
          `FINISH · ${jetSki.elapsed.toFixed(1)}s · Place ${place}/3`:
          jetRideMode==="free"?
          `FREE RIDE · ${jetSki.speed<-.2?"REV ":""}${Math.abs(jetSki.speed).toFixed(0)} m/s · ${boostStatus} ${jetSki.turbo.toFixed(0)}%${swellStatus}`:
          `Lap ${Math.min(2,jetSki.lap+1)}/2 · Gate ${jetSki.checkpoint+1}/${JET_SKI_GATES.length} ${turnGuide} · ${jetSki.speed<-.2?"REV ":""}${Math.abs(jetSki.speed).toFixed(0)} m/s · ${boostStatus} ${jetSki.turbo.toFixed(0)}%${swellStatus}`;
        jetHudReadout.textContent=jetTouchEnabled?compactJetHud:jetRideMode==="free"?
          `FREE RIDE · ${jetSki.speed<-.2?"REVERSE ":""}${Math.abs(jetSki.speed).toFixed(0)} m/s · ${boostStatus} ${jetSki.turbo.toFixed(0)}%${swellStatus} · W/↑ forward · S/↓ reverse · A/D steer · Shift BOOST · Esc dock`:
          jetCountdown>0?
          `START IN ${Math.ceil(jetCountdown)} · ${jetSki.craft.toUpperCase()} · Hold throttle to launch`:
          jetSki.phase==="finished"?
          `FINISH · ${jetSki.elapsed.toFixed(1)}s · Place ${place}/3 · Session best ${jetSessionBest?.toFixed(1)??"·"}s · R Retry / Esc Dock`:
          `${jetSkiSectionName(jetSki.checkpoint)} · Place ${place}/3 · Lap ${Math.min(2,jetSki.lap+1)}/2 · Gate ${jetSki.checkpoint+1}/${JET_SKI_GATES.length} ${turnGuide} ${jetSkiGateDistance(jetSki).toFixed(0)}m · ${jetSki.speed<-.2?"REV ":""}${Math.abs(jetSki.speed).toFixed(0)} m/s · ${boostStatus} ${jetSki.turbo.toFixed(0)}%${swellStatus}${jetSki.jumpHeight>.2?" · AIR":""} · W/↑ forward · S/↓ reverse · A/D steer · Shift BOOST · R reset · Esc Dock`;
        explorer.visible=false;
      }else if (discGolf.phase!=="off") {
        const previous=discGolf.phase;
        const wasPresentationPending=!!discGolf.presentationPending;
        discGolf=stepDiscGolf(discGolf,dt,discGolfSurfaceHeight,
          discGolfSurfaceIsWater,SEA_SURFACE,obstacles);
        const previousFetch=discFetch;
        discFetch=stepDiscGolfFetch(discFetch,discGolf,dog,fetchNow);
        const handoff=discGolfHandoffTarget(previousFetch,discFetch,discGolf);
        if(handoff){
          // The physics has already committed the real lie and stroke.
          // Leave the avatar at its PREVIOUS throw position until Shasta's
          // run and find animation have completed, then move it once.
          player=handoff;playerY=groundHeight(player);
          const nextTarget=discGolfNextTarget(discGolf);
          const faceX=nextTarget.x-player.x,faceZ=nextTarget.z-player.z;
          const len=Math.hypot(faceX,faceZ)||1;
          travel={point:player,speed:0,heading:{x:faceX/len,z:faceZ/len}};
          explorer.rotation.y=Math.atan2(faceX,faceZ);
          yaw=Math.atan2(-faceX,-faceZ);
          airHeight=verticalSpeed=0;
          dogSmoothedTarget={...dog};
          canvas.dataset.discGolfHandoff="complete";
          canvas.dataset.discGolfHandoffReason=
            previousFetch.phase==="found"?"found":"timeout";
        }
        // Water shots and cancelled cinematics release the input lock
        // without teleporting the player. Successful fetches unlock only
        // AFTER the final phase returns to idle.
        if(discGolf.presentationPending&&previousFetch.phase!=="idle"&&
           discFetch.phase==="idle"){
          if(!handoff)canvas.dataset.discGolfHandoff="none";
          discGolf={...discGolf,presentationPending:false};
        }
        canvas.dataset.discGolfHandoffPending=String(!!discGolf.presentationPending);
        canvas.dataset.discGolfLieX=discGolf.lie.x.toFixed(2);
        canvas.dataset.discGolfLieZ=discGolf.lie.z.toFixed(2);
        canvas.dataset.discGolfAvatarX=player.x.toFixed(2);
        canvas.dataset.discGolfAvatarZ=player.z.toFixed(2);
        if(discGolf.phase!==previous||
           !!discGolf.presentationPending!==wasPresentationPending){
          callbacks.onDiscGolf(discGolf);
        }else if(elapsed-lastDiscUpdate>.22){
          callbacks.onDiscGolf(discGolf);lastDiscUpdate=elapsed;
        }
        travel.speed=0;destination=null;
      } else if (climb) {
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
        const previousGrindT=grind.t;
        grind.t += grind.direction * grindSpeed * dt / logLength;
        const finished = grind.t <= 0 || grind.t >= 1;
        grind.t = THREE.MathUtils.clamp(grind.t, 0, 1);
        grind.covered+=Math.abs(grind.t-previousGrindT)*logLength;
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
          groundHeight(grind.log.a) * (1 - grind.t) +
          groundHeight(grind.log.b) * grind.t;
        playerY = railGround + grind.log.lift + 0.16;
        if (finished) {
          if(grind.mode==="skate"){
            const next=scoreSkateGrind(skateTrick,grind.covered,grind.style,elapsed);
            saveSkateBest(next);skateTrick=next;
          }
          grind = null;
          airHeight = 0.08;
          verticalSpeed = 2.5;
        }
      } else if (bigAir.phase==="flying") {
        // Physics can advance in bounded steps at low render FPS. Running only
        // the global 50ms movement tick turned a long ski flight into slow
        // motion on software-rendered and mobile GPUs.
        let flightDelta=Math.max(0,Math.min(rawDelta,.3));
        while(flightDelta>1e-8&&bigAir.phase==="flying"){
          const flightStep=Math.min(.12,flightDelta);
          bigAir=advanceBigAir(bigAir,flightStep,p=>groundHeight(p),isWater);
          flightDelta-=flightStep;
        }
        player={...bigAir.point};
        playerY=bigAir.y;
        airHeight=Math.max(0,playerY-supportHeight(player));
        verticalSpeed=bigAir.verticalSpeed;
        travel={point:player,speed:bigAir.horizontalSpeed,
          heading:bigAir.heading??BIG_AIR.heading};
        if(bigAir.phase==="landed"||bigAir.phase==="missed") {
          // No springy auto-hop on touchdown. Natural ground contact resumes
          // after the challenge has settled, without a second ramp trigger.
          airHeight=verticalSpeed=0;
          if(isWater(player)&&jetSkiPierHeight(player)===null){
            swimDepth=targetDepth=0;
            setAquaticMode("surface");
            playerY=SEA_SURFACE-.42;
          }else playerY=supportHeight(player);
          travel={...travel,speed:0};
          lastRampAt=elapsed;
          callbacks.onBigAir(bigAir);
        } else if(elapsed-lastBigAirUpdate>.19) {
          callbacks.onBigAir(bigAir);
          lastBigAirUpdate=elapsed;
        }
      } else if (aquatic !== "land") {
        const nextTravel = stepSwim(
          { ...travel, point: player },
          { x: dx, z: dz },
          rawDelta,
          destination,
        );
        if (!isWater(nextTravel.point)||jetSkiPierHeight(nextTravel.point)!==null) {
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
        const previousHeading={...travel.heading};
        travel = stepTravel(
          { ...travel, point: player },
          { x: dx, z: dz },
          dt,
          state.activity,
          caveLayer === "surface"
            ? (airHeight < 0.2 ? groundedObstacles : obstacles)
            : caveSolids,
          keys.has("shift"),
          destination,
          airHeight,
          supportHeight,
          activeRideBoost(rideBoost,elapsed) && isBoostActivity(state.activity),
        );
        if(state.activity==="skate"){
          const turn=previousHeading.x*travel.heading.z-previousHeading.z*travel.heading.x;
          const desiredLean=skateLean(travel.speed,turn*5.5);
          skateCarveLean+= (desiredLean-skateCarveLean)*Math.min(1,dt*9);
        }else skateCarveLean+= (0-skateCarveLean)*Math.min(1,dt*10);
        if (
          destination &&
          (distance(travel.point, destination) < 0.3 ||
            (travel.speed === 0 && distance(player, destination) > 0.3))
        ) destination = null;
        const nextLayer = nextCaveLayer(caveLayer, previousPoint, travel.point, playerY);
        if (nextLayer !== caveLayer) {
          caveLayer = nextLayer;
          airHeight = verticalSpeed = 0;
        }
        player = travel.point;

        if (isWater(player)&&jetSkiPierHeight(player)===null) {
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
          const groundY = supportHeight(player);
          // Integrate in world space: crossing a ramp lip must not subtract its
          // deck height from an airborne rider's trajectory.
          if (airHeight > 0 || verticalSpeed > 0) {
            const airborne = stepAirborne(previousY, verticalSpeed, groundY, dt);
            playerY = airborne.y;
            airHeight = airborne.airHeight;
            verticalSpeed = airborne.verticalSpeed;
          } else {
            playerY = groundY;
            verticalSpeed = 0;
          }
          const modeForRamp = effectiveActivity(state.activity, player);
          if (bigAir.phase!=="armed" && airHeight === 0 && elapsed - lastRampAt > 1.1) {
            const ramp = rampImpulseCrossing(
              previousPoint, player, travel.heading, modeForRamp, travel.speed,
            );
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

      // Skiing may launch from any steep downhill edge on the mountain.
      // The original marked kicker remains as a deliberate easy starting point.
      const skiEligible=state.activity==="ski"&&
        (bigAir.phase==="idle"||bigAir.phase==="armed")&&
        discGolf.phase==="off"&&!jetSki&&!jetChoosing&&
        trial.phase!=="running"&&trial.phase!=="armed"&&
        !climb&&!grind&&aquatic==="land"&&airHeight<.1&&
        mountainJumpEligible(player,supportHeight(player),travel.speed);
      const previousGround=supportHeight(previousPoint);
      const ahead={x:player.x+travel.heading.x*2.1,
        z:player.z+travel.heading.z*2.1};
      const frontGround=supportHeight(ahead);
      const downhillDrop=previousGround-frontGround;
      const naturalLip=skiEligible&&mountainSkiTakeoff(player,
        supportHeight(player),travel.speed,previousGround,frontGround,
        verticalSpeed);
      const markedLip=bigAir.phase==="armed"&&
        bigAirCrossedLip(previousPoint,player,travel.heading,state.activity,
          travel.speed,true);
      if(skiEligible&&(naturalLip||markedLip)){
        bigAir=launchBigAir(player,supportHeight(player),travel.speed,
          travel.heading,!markedLip,Math.max(0,downhillDrop));
        playerY=bigAir.y;
        airHeight=Math.max(.04,playerY-supportHeight(player));
        verticalSpeed=bigAir.verticalSpeed;
        lastRampAt=elapsed;
        callbacks.onBigAir(bigAir);
      }
      const mode = effectiveActivity(state.activity, player);
      if(mode!=="skate"&&(skateTrick.phase!=="ground"||skateTrick.manual!=="none")){
        skateTrick={...idleSkateTrick(),best:skateTrick.best};skateHasBeenAirborne=false;
      }
      if(mode==="skate"&&skateTrick.manual!=="none"){
        const next=stepSkateManual(skateTrick,dt,travel.speed,elapsed);
        saveSkateBest(next);skateTrick=next;
      }
      if(mode==="skate"&&skateTrick.phase==="air"){
        if(airHeight>.12)skateHasBeenAirborne=true;
        if(skateHasBeenAirborne&&airHeight<=.001&&!grind){
          const landing=finishSkateTrick(skateTrick,elapsed,travel.speed);
          if(landing.bails>skateTrick.bails)travel={...travel,speed:travel.speed*.32};
          saveSkateBest(landing);
          skateTrick=landing;skateHasBeenAirborne=false;
        }
      }
      if(trial.phase==="armed" || trial.phase==="running") {
        const previousTrial=trial;
        trial=tickJoshuaTrial(trial,previousPoint,player,dt,mode);
        if(trial.phase!==previousTrial.phase || trial.nextGate!==previousTrial.nextGate ||
          elapsed-lastTrialUpdate>.24) {
          callbacks.onChallenge({...trial,ghostPlace:joshuaRacePlace(trial,player)});
          lastTrialUpdate=elapsed;
        }
      }
      canvas.dataset.trialPhase=trial.phase;
      canvas.dataset.trialCheckpoint=String(trial.nextGate);
      rideVisual.updateGhosts(trial);
      if(trial.phase==="armed"||trial.phase==="running"||trial.phase==="complete"){
        canvas.dataset.joshuaGhosts=String(JOSHUA_GHOSTS.length);
        canvas.dataset.joshuaPlace=String(joshuaRacePlace(trial,player));
        canvas.dataset.joshuaProgress=joshuaPlayerFraction(trial,player).toFixed(3);
      }else canvas.dataset.joshuaGhosts="0";
      const swimming = aquatic !== "land";
      const walking = travel.speed > 0.05
        ? Math.sin(elapsed * (swimming ? 9 : mode === "run" ? 14 : 10))
        : 0;
      board.visible = !swimming && mode === "skate";
      const trickPose=skateTrickPose(skateTrick,elapsed);
      board.rotation.set(mode==="skate"?trickPose.pitch:0,mode==="skate"?trickPose.yaw:0,mode==="skate"?trickPose.roll:0);
      board.position.y=mode==="skate"&&skateTrick.phase==="air"?Math.sin(Math.PI*trickPose.progress)*.19:0;
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
            : mode==="skate" ? -trickPose.crouch * .54 : 0,
          bikePose
            ? bikeSeatLocal.z -
              (riderHipLocal.y * Math.sin(bikeBodyLean) +
                riderHipLocal.z * Math.cos(bikeBodyLean))
            : 0,
        );
        bodyRoot.rotation.set(bikePose ? bikeBodyLean : mode==="skate"?trickPose.crouch*.35:0, 0, 0);
        legs[0].rotation.x = running ? walking * 0.6 : bikePose ? 0.58 + walking * 0.28 :
          mode==="skate" ? .10+trickPose.crouch*.9+trickPose.pitch*.65 : .2;
        legs[1].rotation.x = running ? -walking * 0.6 : bikePose ? 0.58 - walking * 0.28 :
          mode==="skate" ? .10+trickPose.crouch*.9-trickPose.pitch*.65 : .2;
        // Single elastic backswing: shoulder reaches behind the body during
        // Space hold, then follows through as the disc takes flight.
        const throwProgress=THREE.MathUtils.clamp(state.discGolfSwingAmount,0,1);
        const throwArm=discGolf.phase!=="off"?
          discGolf.phase==="flying" ?
            -.75-1.3*Math.max(0,1-discGolf.flightTime/.43) :
          state.discGolfSwingStage==="power" ?
            -.75+.65*throwProgress :
          state.discGolfSwingStage==="released" ? -2.05 : -.75 : null;
        arms[0].rotation.x = throwArm!==null?throwArm:
          climb ? -2 : running ? -walking * 0.4 : bikePose ? 0.82 :
          mode==="skate" ? trickPose.grab==="left" ? .48 : -.6+trickPose.crouch*.45 : -.75;
        arms[1].rotation.x = climb ? -1.6 : running ? walking * 0.4 : bikePose ? 0.82 :
          mode==="skate" ? trickPose.grab==="right" ? .48 : -.6+trickPose.crouch*.45 : -.75;
        const footprint = mode === "bike"
          ? { length: 1.05, width: 0.55 }
          : mode === "skate"
            ? { length: 1.1, width: 0.42 }
            : mode === "ski"
              ? { length: 1.35, width: 0.46 }
              : { length: 0.25, width: 0.2 };
        const contact = terrainContact(player, travel.heading, footprint.length, footprint.width, supportHeight);
        const gearMode = mode === "bike" || mode === "skate" || mode === "ski";
        const supportLift =
          gearMode && airHeight <= 0.001 && !climb && !grind
            ? Math.max(0, contact.support - supportHeight(player))
            : 0;
        const pitchAngle = running || climb ? 0 : contact.pitch;
        const rollAngle =
          (gearMode ? contact.roll : 0) +
          (mode === "skate" ? skateCarveLean : 0);
        explorer.rotation.set(pitchAngle, headingYaw+(mode==="skate"?trickPose.bodyYaw:0), rollAngle);
        if (grind) {
          const logDx = grind.log.b.x - grind.log.a.x;
          const logDz = grind.log.b.z - grind.log.a.z;
          const logLength = Math.max(1e-6, Math.hypot(logDx, logDz));
          const alongX = (logDx / logLength) * grind.direction;
          const alongZ = (logDz / logLength) * grind.direction;
          const logYaw = Math.atan2(alongX, alongZ);
          const groundA = groundHeight(grind.log.a);
          const groundB = groundHeight(grind.log.b);
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
      const skateVisible=state.entered&&!swimming&&mode==="skate"&&
        discGolf.phase==="off"&&!jetSki&&!jetChoosing&&
        bigAir.phase!=="flying";
      skateHud.style.display=skateVisible?"block":"none";
      skateTouch.style.display=skateVisible&&jetTouchEnabled?"flex":"none";
      if(skateVisible)skateHud.textContent=skateTrick.phase==="air"?
        (skateTrick.name??"Trick")+(skateTrick.spinDegrees?" + "+Math.abs(skateTrick.spinDegrees)+"°":"")+" · land clean":
        skateTrick.manual!=="none"?
        (skateTrick.manual==="manual"?"MANUAL":"NOSE MANUAL")+" · "+skateTrick.manualDistance.toFixed(1)+" m":
        skateTrick.lastLabel?
          skateTrick.lastLabel+" · "+skateTrick.points+" pts · ×"+Math.max(1,skateTrick.combo)+" · Best "+skateTrick.best:
          "SKATE · Space: Ollie · ↓+↑/←/→: Flick · C/X: Manual · J/L: Spin · Q/E: Grab";
      canvas.dataset.skateManual=skateTrick.manual;
      canvas.dataset.skateStance=skateTrick.stance;
      canvas.dataset.skateSpin=String(skateTrick.spinDegrees);
      canvas.dataset.skateLean=skateCarveLean.toFixed(3);
      canvas.dataset.skateTrick=skateTrick.name??"";
      canvas.dataset.skateCombo=String(skateTrick.combo);
      canvas.dataset.skateScore=String(skateTrick.points);
      canvas.dataset.skatePark=String(insideSkatePark(player));
      canvas.dataset.activity = mode;
      canvas.dataset.speed = travel.speed.toFixed(2);
      const boosting=activeRideBoost(rideBoost,elapsed)&&
        isBoostActivity(state.activity)&&aquatic==="land";
      canvas.dataset.rideBoost=String(boosting);
      canvas.dataset.rideBoostRemaining=Math.max(0,rideBoost.until-elapsed).toFixed(2);
      const showAim=state.entered&&aquatic==="land"&&
        isBoostActivity(state.activity)&&discGolf.phase==="off"&&!jetSki&&
        !jetChoosing&&bigAir.phase!=="flying";
      rideHud.style.display=showAim?"block":"none";
      rideReticle.style.display=showAim?"block":"none";
      if(showAim){
        const seconds=Math.max(0,rideBoost.until-elapsed);
        rideHud.textContent=elapsed<rideBoostNoticeUntil?rideBoostNotice:
          boosting?"BOOST ×1.6 · "+seconds.toFixed(1)+"s":
          "AIM + FIRE · Click/tap a glowing ring · F shoots center";
      }
      canvas.dataset.height = playerY.toFixed(2);
      canvas.dataset.airborne = String(airHeight > 0 || !!climb || !!grind);
      canvas.dataset.discGolfPhase=discGolf.phase;
      canvas.dataset.discGolfSwing=state.discGolfSwingStage;
      canvas.dataset.discGolfPreview=String(
        !!state.discGolfPreview &&
        (discGolf.phase==="ready"||discGolf.phase==="landed"||discGolf.phase==="water"));
      canvas.dataset.discGolfSwingAmount=state.discGolfSwingAmount.toFixed(2);
      canvas.dataset.discGolfBeacon=String(discGolf.phase==="landed");
      canvas.dataset.discGolfStrokes=String(discGolf.strokes);
      canvas.dataset.discGolfWaterRedos=String(discGolf.waterRedos);
      canvas.dataset.discGolfHole=DISC_GOLF_HOLES[discGolf.holeIndex].id;
      canvas.dataset.discGolfGates=String(discGolf.gatesCleared);
      canvas.dataset.discGolfGatesTotal=String(DISC_GOLF_HOLES[discGolf.holeIndex].gates.length);
      canvas.dataset.bigAirPhase=bigAir.phase;
      canvas.dataset.bigAirDistance=bigAir.distance.toFixed(1);
      canvas.dataset.bigAirOutwardGain=mountainJumpOutwardGain(bigAir).toFixed(2);
      canvas.dataset.bigAirPeakClearance=(bigAir.maxClearance??0).toFixed(2);
      canvas.dataset.bigAirBirdCallout=bigAir.phase==="flying"
        ? bigAirBirdCallout(bigAir.distance)??"":"";
      canvas.dataset.bigAirAltitude=(playerY-supportHeight(player)).toFixed(2);
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
          ? explorer.position.y - supportHeight(player)
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
      const caveProgress = THREE.MathUtils.clamp(
        (player.z - arcade.z) / ARCADE_CAVE.tunnelDepth,
        0,
        1,
      );
      const caveInside = aquatic === "land" && caveLayer === "arcade" && arcadeInside(player);
      const paperInside = aquatic === "land" && caveLayer === "paper" && paperCaveInside(player);
      gameCarvings.visible = runeMesh.visible = carvingBandMesh.visible = caveInside && caveProgress > .4;
      canvas.dataset.caveInside = String(caveInside);
      canvas.dataset.caveDepth = caveProgress.toFixed(3);
      canvas.dataset.caveLayer = caveLayer;
      canvas.dataset.player = `${player.x.toFixed(2)},${player.z.toFixed(2)}`;
      canvas.dataset.jetSkiPier=String(nearJetSkiBoarding(player)&&aquatic==="land");
      canvas.dataset.jetSkiDeckHeight=jetSkiPierHeight(player)?.toFixed(2)??"";
      canvas.dataset.paperInside = String(paperInside);
      canvas.dataset.caveChamber = String(caveInside && caveProgress > 0.58);
      let rawGazeGame: string | null = null;
      const cavernCameraSettled =
        camera.position.distanceTo(targetCamera) < 1.35 &&
        look.distanceTo(targetLook) < 0.65;
      if (
        caveInside &&
        caveProgress > 0.58 &&
        distance(player, arcadeWall) < 7.4 &&
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
      if (!caveInside || aquatic !== "land") {
        gazeCandidate = gazeStable = null;
        gazeCandidateSince = gazeLastSeen = now;
      }
      const gazeGame = gazeStable;
      canvas.dataset.gazeGame = gazeGame ?? "";
      const nearby = nearbyDiscovery(player);
      const layeredNearby =
        nearby === "paper-archive" && caveLayer !== "paper" ? null : nearby;
      const trident=nearbyUnderwaterTrident(player,playerY,aquatic);
      discovery = aquatic === "land" ? (gazeGame ?? layeredNearby) : trident?.id ?? null;
      const nextKey = `${r}:${discovery}`;
      if (nextKey !== locationKey) {
        locationKey = nextKey;
        callbacks.onLocation(r, discovery);
      }
      const cavernApproachFraming =
        aquatic === "land" &&
        distance(player,arcade)<12 &&
        caveProgress <= 0.32 &&
        distance(player, arcade) < 5.8;
      const cavernFraming =
        caveInside && caveProgress > 0.48 && distance(player, arcadeWall) < 8.5;
      if(discGolf.phase!=="off"){
        const basket=discGolfNextTarget(discGolf);
        const pose=discGolfThrowCameraPose(player,basket,playerY);
        // Preserve a stationary putting camera through the entire short
        // flight; only long drives follow the disc through the island.
        const followFlight=discGolf.phase==="flying"&&!pose.putting&&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const dx=basket.x-player.x,dz=basket.z-player.z;
        const len=Math.hypot(dx,dz)||1;
        const lookAt=followFlight?{
          x:discGolf.disc.x+dx/len*3,y:discGolf.disc.y+.9,
          z:discGolf.disc.z+dz/len*3,
        }:pose.look;
        targetLook.set(lookAt.x,lookAt.y,lookAt.z);
        canvas.dataset.discGolfCamera=followFlight?"flight":pose.putting?"putt":"approach";
      } else if(bigAir.phase==="flying"){
        const pose=mountainJumpCameraPose(bigAir);
        targetLook.set(pose.look.x,pose.look.y,pose.look.z);
      } else if(jetSki){
        // Coarse-pointer steering covers the lower screen. Looking less far
        // ahead positions the rider ABOVE the touch buttons while retaining
        // the wider forward preview on desktop.
        const ahead=jetTouchEnabled?3.6:8;
        const lookHeight=jetTouchEnabled ? 0.8 : 1.4;
        targetLook.set(player.x+Math.sin(jetSki.heading)*ahead,
          SEA_SURFACE+lookHeight+jetSki.waterHeight+jetSki.jumpHeight*.55,
          player.z+Math.cos(jetSki.heading)*ahead);
      } else if (cavernFraming) {
        targetLook.set(arcadeWall.x, arcadeWallY + 2.05, arcadeWall.z - 0.5);
      } else if (cavernApproachFraming) {
        // Frame the mouth of the cave, not the high terrain deep behind it.
        // This keeps the entrance readable as a dark opening in the mountain.
        targetLook.set(
          arcade.x,
          arcadeY + 2.1,
          arcade.z + 1.8,
        );
      } else {
        const aquaticLookAhead = aquatic === "land" ? 0 : aquatic === "dive" ? 3.2 : 2.2;
        targetLook.set(
          player.x + travel.heading.x * aquaticLookAhead,
          playerY + (aquatic === "dive" ? 0.55 : aquatic === "surface" ? 1.2 : 2.8),
          player.z + travel.heading.z * aquaticLookAhead,
        );
      }
      const cameraZoom =
        bigAir.phase==="flying" ? 23 :
        aquatic === "dive"
          ? Math.min(zoom, 13.5)
          : aquatic === "surface"
            ? Math.min(zoom, 14)
            : mode === "bike" || mode === "skate"
              ? Math.min(zoom, mode==="skate"?21:16)
              : mode === "boulder"
                ? Math.min(zoom, 15)
                : zoom;
      const cameraYaw = aquatic === "dive" ? yaw + 0.28 : yaw;
      if(discGolf.phase!=="off"){
        const target=discGolfNextTarget(discGolf);
        const pose=discGolfThrowCameraPose(player,target,playerY);
        if(discGolf.phase==="flying"&&!pose.putting&&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          const dx=target.x-player.x,dz=target.z-player.z;
          const len=Math.hypot(dx,dz)||1;
          const fx=dx/len,fz=dz/len,p=discGolf.disc;
          targetCamera.set(p.x-fx*19.5+fz*2.25,p.y+12,p.z-fz*19.5-fx*2.25);
        }else targetCamera.set(pose.camera.x,pose.camera.y,pose.camera.z);
      } else if(bigAir.phase==="flying"){
        const pose=mountainJumpCameraPose(bigAir);
        targetCamera.set(pose.camera.x,pose.camera.y,pose.camera.z);
      } else if(jetSki){
        const h=jetSki.heading;
        targetCamera.set(player.x-Math.sin(h)*13+Math.cos(h)*2.4,
          SEA_SURFACE+7.6+jetSki.waterHeight*.4+jetSki.jumpHeight*.75,
          player.z-Math.cos(h)*13-Math.sin(h)*2.4);
      } else if (cavernFraming) {
        // Keep the third-person boom centered inside the authored tunnel.
        // A lower eye line prevents the roof from swallowing the frame while
        // preserving the explorer silhouette against the carved game wall.
        const caveCameraZ = Math.max(arcade.z + 0.9, player.z - 4.2);
        const caveCameraFloor = terrainHeight(arcade.x, caveCameraZ);
        targetCamera.set(
          arcade.x,
          caveCameraFloor + 2.05,
          caveCameraZ,
        );
      } else if (cavernApproachFraming) {
        // Pull the approach camera well behind the explorer so the cave mouth
        // remains the subject instead of nearby portal rocks or the explorer
        // occupying most of the foreground.
        const approachCameraZ = arcade.z - 10.2;
        targetCamera.set(
          arcade.x,
          terrainHeight(arcade.x, approachCameraZ) + 3.05,
          approachCameraZ,
        );
      } else {
        targetCamera.set(
          player.x + Math.sin(cameraYaw) * cameraZoom * Math.cos(pitch),
          targetLook.y + cameraZoom * Math.sin(pitch),
          player.z + Math.cos(cameraYaw) * cameraZoom * Math.cos(pitch),
        );
      }
      updateRaceOceanWaves(elapsed,!!jetSki);
      jetskiCoast.update(elapsed,!!jetSki);
      rideVisual.updateTracer(elapsed);
      rideVisual.updateTargets(effectiveActivity(state.activity,player),
        player,travel.speed,elapsed,rideBoost,camera,
        state.entered&&!state.paused&&aquatic==="land"&&
        discGolf.phase==="off"&&!jetSki&&!jetChoosing&&bigAir.phase!=="flying");
      if(jetTouchEnabled){
        const nearDock=nearJetSkiBoarding(player)&&aquatic==="land";
        jetTouch.style.display=!jetChoosing&&(jetSki||nearDock)?"grid":"none";
        jetTouch.style.gridTemplateColumns=jetSki?
          "repeat(3,minmax(0,1fr))":"1fr";
        jetTouch.style.width=jetSki?"min(380px,calc(100% - 20px))":
          "min(180px,calc(100% - 20px))";
        jetBoardButton.style.display=jetSki?"none":"inline-flex";
        driveButtons.forEach(b=>{b.style.display=jetSki?"inline-flex":"none";});
        jetRetryButton.style.display=jetSki&&jetSki.phase==="finished"?"inline-flex":"none";
      }
      if(!jetSki){explorer.visible=!jetChoosing;
        jetskiVisual.activeSki.visible=jetChoosing;
        if(jetChoosing){
          jetskiVisual.activeSki.position.set(JET_SKI_DOCK.x+.25,SEA_SURFACE+.2,JET_SKI_PIER.centerZ-.15);
          jetskiVisual.activeSki.rotation.set(0,0,0);
        }
        jetskiVisual.opponents.forEach(g=>{g.visible=false;});
        jetskiVisual.skis.forEach((g,i)=>{g.visible=!jetChoosing||i!==1;});
        jetskiVisual.wake.visible=false;
        jetskiVisual.updateGateFocus(0,elapsed,false);
        jetNotice.style.display="none";
        if(jetWakeSamples.length){jetWakeSamples=[];jetWakeAccumulator=0;}
        jetskiVisual.updateWakeTrail([],elapsed);
        if(discGolf.phase==="off"&&!jetChoosing&&nearJetSkiBoarding(player)&&aquatic==="land"){
          jetHud.style.display="block";
          jetTurboBar.style.display="none";
          jetHudReadout.textContent="JET-SKI PIER · Press Enter to choose your jet ski";
        }else jetHud.style.display="none";
        jetskiVisual.buoys.forEach(b=>{b.visible=false;});}
      // Keep a trunk from obscuring the explorer on land. The cave uses its own
      // tighter camera clearance because the global +3.5m terrain clamp pushed
      // the camera into the roof on the steep backside slope.
      if (aquatic === "land") {
        if (cavernFraming) {
          const cameraFloor = arcadeCaveFloorHeight({x:targetCamera.x,z:targetCamera.z});
          const cameraCeiling = cameraFloor + ARCADE_CAVE.ceilingClearance;
          targetCamera.y = THREE.MathUtils.clamp(
            targetCamera.y,
            cameraFloor + 1.65,
            cameraCeiling - 0.9,
          );
        } else if (cavernApproachFraming) {
          targetCamera.y = Math.max(
            targetCamera.y,
            terrainHeight(targetCamera.x, targetCamera.z) + 2.2,
          );
        } else if(jetSki){
          // Offshore courses sit beyond the finite terrain mesh: do not
          // project the chase camera onto the island mountain heightfield.
          targetCamera.y=Math.max(targetCamera.y,SEA_SURFACE+5.5);
        } else if(discGolf.phase!=="off"){
          // Trees used to shrink the camera boom to 25%, zooming into
          // the back of the character during a putt. Hold the overhead
          // framing and lift above uneven terrain instead.
          targetCamera.y=Math.max(targetCamera.y,
            worldFloorHeight(targetCamera.x,targetCamera.z)+9);
        } else {
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
        }
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
          if (!isWater({ x: targetCamera.x, z: targetCamera.z })) {
            const zone = waterZone(player);
            targetCamera.x =
              zone === "lagoon"
                ? eastCoastlineX(targetCamera.z) + 1.3
                : coastlineX(targetCamera.z) - 1.3;
          }
        }
        const floor = seaFloorHeight(targetCamera.x, targetCamera.z);
        targetCamera.y = THREE.MathUtils.clamp(
          targetCamera.y,
          floor + 1.05,
          SEA_SURFACE - 0.28,
        );
      }
      if (caveInside || paperInside) {
        const isArcade = caveInside;
        const centerX = isArcade ? 16 : -20;
        const minZ = isArcade ? -81.6 : -35.4;
        const maxZ = isArcade ? -63.7 : -30.3;
        const desired = constrainMove(player,{x:player.x+Math.sin(yaw)*2.6,z:player.z+Math.cos(yaw)*2.6},caveSolids);
        const z=THREE.MathUtils.clamp(desired.z,minZ,maxZ);
        const half = isArcade ? caveHalfWidth(z)-.85 : paperCaveHalfWidth(z)-.85;
        targetCamera.set(THREE.MathUtils.clamp(desired.x,centerX-half,centerX+half),playerY+2.15,z);
        targetLook.set(player.x-Math.sin(yaw)*2.4,playerY+1.85,player.z-Math.cos(yaw)*2.4);
      }
      // Camera choreography, never gameplay authority:
      // flight -> landing reveal -> visible dog chase -> Shasta eye view.
      // Before landing the shot gets the camera; Shasta stays behind.
      const reducedFetchMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const fetchCamera=discGolf.phase!=="off"&&!discGolfIntro?
        discGolfFetchCameraPhase(discFetch,fetchNow,reducedFetchMotion):"off";
      if(fetchCamera==="disc" && discGolf.phase==="flying"){
        const p=discGolf.disc;
        const speed=Math.hypot(discGolf.velocity.x,discGolf.velocity.z);
        const target=discGolfNextTarget(discGolf);
        const dx=speed>.25?discGolf.velocity.x:target.x-player.x;
        const dz=speed>.25?discGolf.velocity.z:target.z-player.z;
        const length=Math.hypot(dx,dz)||1,fx=dx/length,fz=dz/length;
        // Putts remain in the broad third-person composition; on longer
        // drives, the flying disc owns the view until impact.
        const putting=discGolfThrowCameraPose(player,target,playerY).putting;
        const discLook=new THREE.Vector3(p.x+fx*2,p.y+.6,p.z+fz*2);
        if(putting)targetLook.lerp(discLook,.45);
        else{
          targetLook.copy(discLook);
          targetCamera.set(p.x-fx*15+fz*2.7,p.y+9.5,
            p.z-fz*15-fx*2.7);
        }
      }else if(fetchCamera==="landing"&&discFetch.target){
        const p=discFetch.target;
        const dx=discGolf.velocity.x,dz=discGolf.velocity.z;
        const len=Math.hypot(dx,dz)||1,fx=dx/len,fz=dz/len;
        const y=terrainHeight(p.x,p.z);
        targetLook.set(p.x,y+1,p.z);
        targetCamera.set(p.x-fx*12+fz*4,y+12,p.z-fz*12-fx*4);
      }else if((fetchCamera==="chase"||fetchCamera==="shasta")&&
        discFetch.target){
        // Smooth the *actual dog navigation* independently from paw IK and
        // high-frequency terrain samples, and preserve heading near the lie.
        // The wider over-shoulder follow shot keeps Shasta and his gait in
        // view rather than putting the lens at his moving nose.
        dogCameraAnchor=stepShastaCameraAnchor(dogCameraAnchor,
          {x:dog.x,y:dogGroundY,z:dog.z},dogYaw,dt);
        const shot=shastaCameraShot(dogCameraAnchor,fetchCamera,
          (x,z)=>worldFloorHeight(x,z));
        targetCamera.set(shot.camera.x,shot.camera.y,shot.camera.z);
        targetLook.set(shot.look.x,shot.look.y,shot.look.z);
        canvas.dataset.shastaFollowBoom=shot.boom.toFixed(1);
        canvas.dataset.shastaFollowMode="third-person";
      }
      if(fetchCamera!=="chase"&&fetchCamera!=="shasta"){
        dogCameraAnchor=null;
        canvas.dataset.shastaFollowMode="off";
      }
      if(fetchCamera!=="off"){
        targetCamera.y=Math.max(targetCamera.y,
          worldFloorHeight(targetCamera.x,targetCamera.z)+
          (fetchCamera==="shasta"?1.45:7));
        canvas.dataset.discGolfCamera=fetchCamera;
      }
      canvas.dataset.discGolfCinematicStage=fetchCamera;
      canvas.dataset.discGolfFetchCamera=String(fetchCamera!=="off");
      // Basket-first orientation: hold the chains, then rise over the
      // fairway and return to the *existing* third-person aiming pose.
      // The normal terrain/camera constraints above remain authoritative at
      // the endpoint. Do not replay this when a disc lands.
      if(discGolfIntro && discGolf.phase!=="off"){
        const basket=discGolfNextTarget(discGolf);
        const pose=discGolfIntroPose(
          discGolf.lie,basket,
          {x:targetCamera.x,y:targetCamera.y,z:targetCamera.z},
          {x:targetLook.x,y:targetLook.y,z:targetLook.z},
          elapsed-discGolfIntro.startedAt,
          p=>worldFloorHeight(p.x,p.z),discGolfIntro.reducedMotion,
        );
        if(pose.stage==="complete"){
          if(discGolfIntro.reducedMotion)snapDiscCamera=true;
          discGolfIntro=null;
        }else{
          targetCamera.set(pose.camera.x,pose.camera.y,pose.camera.z);
          targetLook.set(pose.look.x,pose.look.y,pose.look.z);
          showingDiscGolfIntro=true;
        }
        canvas.dataset.discGolfIntro=pose.stage;
      }else{
        canvas.dataset.discGolfIntro="off";
      }
      // Aiming is the only camera state requiring a persistent unobstructed
      // player silhouette. Never interfere with the disc-follow, Shasta POV,
      // mountain jumps, underwater camera or authored cave cinematics.
      const smartDiscCamera=discGolf.phase==="ready"||
        discGolf.phase==="landed"||discGolf.phase==="water";
      if(smartDiscCamera&&!discGolf.presentationPending&&
        !showingDiscGolfIntro&&aquatic==="land"){
        const focus={x:player.x,y:playerY+1.55,z:player.z};
        const old=lastDiscCameraSolve;
        const needed=!old||old.desired.distanceTo(targetCamera)>.30||
          Math.hypot(old.focus.x-focus.x,old.focus.y-focus.y,
            old.focus.z-focus.z)>.30;
        if(needed){
          const result=cameraVisibility.resolve(
            {x:targetCamera.x,y:targetCamera.y,z:targetCamera.z},
            focus,(x,z)=>worldFloorHeight(x,z),
            old?.position);
          lastDiscCameraSolve={
            desired:targetCamera.clone(),focus:new THREE.Vector3(focus.x,focus.y,focus.z),
            position:new THREE.Vector3(result.point.x,result.point.y,result.point.z),
            clear:result.clear,adjusted:result.adjusted,blocking:result.blocking,
          };
        }
        if(lastDiscCameraSolve){
          targetCamera.copy(lastDiscCameraSolve.position);
          canvas.dataset.discGolfCameraAdjusted=String(lastDiscCameraSolve.adjusted);
          canvas.dataset.discGolfCameraClear=String(lastDiscCameraSolve.clear);
          canvas.dataset.discGolfCameraBlockers=String(lastDiscCameraSolve.blocking);
        }
      }else{
        lastDiscCameraSolve=null;
        canvas.dataset.discGolfCameraAdjusted="false";
        canvas.dataset.discGolfCameraClear="true";
        canvas.dataset.discGolfCameraBlockers="0";
      }
      if (cavernFraming) {
        const cameraFloor = arcadeCaveFloorHeight({x:targetCamera.x,z:targetCamera.z});
        const cameraCeiling = cameraFloor + ARCADE_CAVE.ceilingClearance;
        canvas.dataset.caveCameraClear = String(
          Math.abs(targetCamera.x - arcade.x) < caveHalfWidth(targetCamera.z) - 0.7 &&
          targetCamera.y > cameraFloor + 1.4 &&
          targetCamera.y < cameraCeiling - 0.7,
        );
      } else {
        canvas.dataset.caveCameraClear = "true";
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
    const landWildlifeVisible = aquatic === "land";
    critterBodies.visible =
      critterHeads.visible =
      critterEars.visible =
      critterEyes.visible =
      critterMuzzles.visible =
      critterBeaks.visible =
      critterLegs.visible =
      critterPlumes.visible =
      critterThinTails.visible =
        landWildlifeVisible;
    if (landWildlifeVisible) {
      critters.forEach((critter, i) => {
        if (distance(player,critter.point)>45) return;
        const dogDistance=distance(critter.point,dog);
        const playerDistance=distance(critter.point,player);
        const threat=dogDistance<6.5?dog:
          playerDistance<3.2?player:null;
        const next=stepCritterLocomotion(critter,dt,elapsed,threat,isWater);
        critter.point=next.motion.point;
        critter.heading=next.motion.heading;
        critter.phase=next.motion.phase;
        critter.panicUntil=next.motion.panicUntil;
        critter.fleeFrom=next.motion.fleeFrom;
        const step=next.step;

        const gaitBob =
          critter.kind === "lizard"
            ? 0
            : Math.sin(critter.phase * 8) * Math.min(0.025, step * 0.7);
        const bodyY =
          terrainHeight(critter.point.x, critter.point.z) +
          critter.bodyScale.y * (critter.kind === "lizard" ? 0.75 : 1.0) +
          gaitBob;
        dummy.position.set(critter.point.x, bodyY, critter.point.z);
        dummy.rotation.set(0, critter.heading, 0);
        dummy.scale.set(
          critter.bodyScale.x,
          critter.bodyScale.y,
          critter.bodyScale.z,
        );
        dummy.updateMatrix();
        critterBodies.setMatrixAt(i, dummy.matrix);

        const forwardX = Math.sin(critter.heading);
        const forwardZ = Math.cos(critter.heading);
        const rightX = Math.cos(critter.heading);
        const rightZ = -Math.sin(critter.heading);
        const headX = critter.point.x + forwardX * critter.headForward;
        const headZ = critter.point.z + forwardZ * critter.headForward;
        const headY = bodyY + critter.headLift;
        dummy.position.set(headX, headY, headZ);
        dummy.rotation.set(0, critter.heading, 0);
        dummy.scale.set(
          critter.headScale.x,
          critter.headScale.y,
          critter.headScale.z,
        );
        dummy.updateMatrix();
        critterHeads.setMatrixAt(i, dummy.matrix);

        for (const eyeIndex of critterEyeIndicesByCritter[i]) {
          const eyePart = critterEyeParts[eyeIndex];
          const eyeForward = critter.headScale.z * 0.73;
          const eyeSide = critter.headScale.x * 0.56;
          dummy.position.set(
            headX + forwardX * eyeForward + rightX * eyePart.side * eyeSide,
            headY + critter.headScale.y * 0.12,
            headZ + forwardZ * eyeForward + rightZ * eyePart.side * eyeSide,
          );
          dummy.rotation.set(0, critter.heading, 0);
          dummy.scale.set(
            Math.max(0.012, critter.headScale.x * 0.12),
            Math.max(0.012, critter.headScale.y * 0.11),
            Math.max(0.009, critter.headScale.z * 0.08),
          );
          dummy.updateMatrix();
          critterEyes.setMatrixAt(eyeIndex, dummy.matrix);
        }

        const muzzleInstance = critterMuzzleInstanceByCritter.get(i);
        if (muzzleInstance !== undefined) {
          const muzzleScale =
            critter.kind === "lizard"
              ? { x: 0.082, y: 0.048, z: 0.13 }
              : critter.kind === "mouse"
                ? { x: 0.06, y: 0.05, z: 0.082 }
                : critter.kind === "woodrat"
                  ? { x: 0.072, y: 0.058, z: 0.094 }
                  : critter.kind === "rabbit"
                    ? { x: 0.082, y: 0.065, z: 0.1 }
                    : { x: 0.072, y: 0.058, z: 0.092 };
          const muzzleForward = critter.headScale.z * 0.88;
          dummy.position.set(
            headX + forwardX * muzzleForward,
            headY - critter.headScale.y * 0.12,
            headZ + forwardZ * muzzleForward,
          );
          dummy.rotation.set(0, critter.heading, 0);
          dummy.scale.set(muzzleScale.x, muzzleScale.y, muzzleScale.z);
          dummy.updateMatrix();
          critterMuzzles.setMatrixAt(muzzleInstance, dummy.matrix);
        }

        const beakInstance = critterBeakInstanceByCritter.get(i);
        if (beakInstance !== undefined) {
          const beakForward = critter.headScale.z * 0.95;
          dummy.position.set(
            headX + forwardX * beakForward,
            headY - 0.015,
            headZ + forwardZ * beakForward,
          );
          dummy.rotation.set(Math.PI / 2, critter.heading, 0);
          dummy.scale.set(0.042, 0.105, 0.042);
          dummy.updateMatrix();
          critterBeaks.setMatrixAt(beakInstance, dummy.matrix);
        }

        for (const legIndex of critterLegIndicesByCritter[i]) {
          const legPart = critterLegParts[legIndex];
          const legHeight =
            critter.kind === "lizard"
              ? 0.07
              : critter.kind === "mouse"
                ? 0.09
                : critter.kind === "woodrat"
                  ? 0.11
                  : critter.kind === "rabbit"
                    ? 0.18
                    : critter.kind === "quail"
                      ? 0.16
                      : 0.13;
          const legRadius =
            critter.kind === "rabbit"
              ? 0.035
              : critter.kind === "quail"
                ? 0.021
                : 0.026;
          const stride =
            critter.kind === "lizard"
              ? Math.sin(critter.phase * 7 + legPart.side * 0.7 + legPart.fore) * 0.025
              : Math.sin(critter.phase * 8 + (legPart.side === legPart.fore ? 0 : Math.PI)) *
                Math.min(0.045, step * 1.15);
          const longitudinal =
            legPart.fore === 0
              ? 0.02
              : legPart.fore * critter.bodyScale.z * 0.48 + stride;
          const lateral = legPart.side * critter.bodyScale.x * 0.62;
          dummy.position.set(
            critter.point.x + forwardX * longitudinal + rightX * lateral,
            terrainHeight(critter.point.x, critter.point.z) + legHeight * 0.48,
            critter.point.z + forwardZ * longitudinal + rightZ * lateral,
          );
          dummy.rotation.set(0, critter.heading, 0);
          dummy.scale.set(legRadius, legHeight, legRadius);
          dummy.updateMatrix();
          critterLegs.setMatrixAt(legIndex, dummy.matrix);
        }

        for (const earIndex of critterEarIndicesByCritter[i]) {
          const earPart = critterEarParts[earIndex];
          const ear = critter.earScale!;
          const sideOffset = earPart.crest ? 0 : earPart.side * critter.headScale.x * 0.58;
          const forwardOffset = earPart.crest ? 0.035 : -0.015;
          dummy.position.set(
            headX + rightX * sideOffset + forwardX * forwardOffset,
            headY + critter.headScale.y * 0.72 + ear.y * 0.42,
            headZ + rightZ * sideOffset + forwardZ * forwardOffset,
          );
          dummy.rotation.set(
            earPart.crest ? -0.24 : 0,
            critter.heading,
            earPart.crest ? 0.18 : -earPart.side * 0.1,
          );
          dummy.scale.set(ear.x, ear.y, ear.z);
          dummy.updateMatrix();
          critterEars.setMatrixAt(earIndex, dummy.matrix);
        }

        for (const plumeIndex of critterPlumeIndicesByCritter[i]) {
          const plumePart = critterPlumeParts[plumeIndex];
          const fraction = (plumePart.segment + 0.55) / plumePart.segments;
          let behind = critter.bodyScale.z * 0.62 + critter.tailLength * fraction;
          let lift = 0.03;
          let lateral = 0;
          let sx = critter.tailRadius;
          let sy = critter.tailRadius;
          let sz = critter.tailLength / plumePart.segments;
          if (critter.tailStyle === "plume") {
            lift = 0.05 + Math.sin(fraction * Math.PI) * 0.34 + fraction * 0.08;
            lateral = Math.sin(critter.phase * 0.6 + fraction * 1.8) * 0.035;
            sx *= 1.45 - fraction * 0.3;
            sy *= 1.7 - fraction * 0.35;
            sz *= 0.9;
          } else if (critter.tailStyle === "puff") {
            behind = critter.bodyScale.z * 0.72;
            lift = 0.055;
            sx = sy = sz = critter.tailRadius;
          } else {
            lift = -0.01 - fraction * 0.035;
            sx *= 0.72;
            sy *= 0.55;
            sz *= 1.05;
          }
          dummy.position.set(
            critter.point.x - forwardX * behind + rightX * lateral,
            bodyY + lift,
            critter.point.z - forwardZ * behind + rightZ * lateral,
          );
          dummy.rotation.set(0, critter.heading, critter.tailStyle === "plume" ? -0.08 : 0);
          dummy.scale.set(sx, sy, sz);
          dummy.updateMatrix();
          critterPlumes.setMatrixAt(plumeIndex, dummy.matrix);
        }

        for (const thinIndex of critterThinTailIndicesByCritter[i]) {
          const tailState = critterThinTailParts[thinIndex];
          const f0 = tailState.segment / tailState.segments;
          const f1 = (tailState.segment + 1) / tailState.segments;
          const tailRootDistance = critter.bodyScale.z * 0.62;
          const curveAmplitude = critter.kind === "lizard" ? 0.08 : 0.055;
          const pointAt = (fraction: number) => {
            const curve =
              Math.sin(critter.phase * 0.7 + fraction * Math.PI * 1.3) *
              curveAmplitude *
              fraction;
            return new THREE.Vector3(
              critter.point.x -
                forwardX * (tailRootDistance + critter.tailLength * fraction) +
                rightX * curve,
              bodyY - 0.02 - (critter.kind === "lizard" ? fraction * 0.025 : 0),
              critter.point.z -
                forwardZ * (tailRootDistance + critter.tailLength * fraction) +
                rightZ * curve,
            );
          };
          const tailSegment = segment(
            pointAt(f0),
            pointAt(f1),
            critter.tailRadius * (1 - f0 * 0.58),
          );
          dummy.position.set(tailSegment.x, tailSegment.y, tailSegment.z);
          dummy.quaternion.copy(tailSegment.q!);
          dummy.scale.set(tailSegment.sx, tailSegment.sy, tailSegment.sz);
          dummy.updateMatrix();
          critterThinTails.setMatrixAt(thinIndex, dummy.matrix);
        }
      });
      critterBodies.instanceMatrix.needsUpdate = true;
      critterHeads.instanceMatrix.needsUpdate = true;
      critterEars.instanceMatrix.needsUpdate = true;
      critterEyes.instanceMatrix.needsUpdate = true;
      critterMuzzles.instanceMatrix.needsUpdate = true;
      critterBeaks.instanceMatrix.needsUpdate = true;
      critterLegs.instanceMatrix.needsUpdate = true;
      critterPlumes.instanceMatrix.needsUpdate = true;
      critterThinTails.instanceMatrix.needsUpdate = true;
    }

    const chaseBefore = dogChase;
    dogChase = stepChase(dogChase, elapsed, dog, player, critters.map(c => c.point),
      discGolf.phase==="off" && aquatic === "land" && caveLayer === "surface");
    dogInterestCritterIndex = dogChase.target;
    if (dogChase.target !== null && dogChase.target !== chaseBefore.target) dogTargetSwitches++;
    const nearbyCritter = discGolf.phase!=="off"||dogInterestCritterIndex === null ?
      null : critters[dogInterestCritterIndex];
    canvas.dataset.dogBehavior = dogChase.mode;
    const playerWaterZone = waterZone(player);
    const shoreWait = {
      x:
        playerWaterZone === "lagoon"
          ? eastCoastlineX(player.z) - 2.6
          : coastlineX(player.z) + 2.6,
      z: THREE.MathUtils.clamp(player.z, WORLD_BOUNDS.minZ + 4, WORLD_BOUNDS.maxZ - 4),
    };
    // The game's carved chamber sits beneath an alpine region. Geometry,
    // not whichever open-air region marker is closest, owns cave behavior.
    const dogWaitsAtCaveEntrance =
      shastaWaitsAtArcadeEntrance(player,caveLayer,aquatic);
    // Queue the Ski celebration until actual alpine snow is reached.
    // Never play while the disc is being fetched or another mode is active.
    const snowAllowed=state.entered&&!state.paused&&state.activity==="ski"&&
      aquatic==="land"&&discGolf.phase==="off"&&!jetSki&&!jetChoosing&&
      caveLayer==="surface";
    const snowHere=terrainHeight(player.x,player.z)>10&&
      biomeAt(player).weights.alpine>.28;
    // Event choreography uses real elapsed wall-clock time, while physics
    // displacement/gait use the bounded simulation dt. Low-FPS software
    // renderers must not stretch an eight-second celebration into a minute.
    const snowNow=now*.001;
    shastaSnow=stepShastaSnowPlay(shastaSnow,snowNow,snowHere,snowAllowed);
    const snowPose=shastaSnowPose(shastaSnow,snowNow);
    const dogTarget = state.entered
      ? aquatic !== "land" || discGolfSurfaceIsWater(player)
        ? shoreWait
        : dogWaitsAtCaveEntrance
          ? { x: arcade.x - 2.0, z: arcade.z - 1.65 }
          : shastaSnow.stage==="zoom"?
            {x:player.x+Math.cos(snowPose.circle)*3.2,
             z:player.z+Math.sin(snowPose.circle)*3.2}
          : (shastaSnow.stage==="roll"||shastaSnow.stage==="shake")?
            dog
          : discGolf.phase!=="off"&&
            (discFetch.phase==="flight"||discFetch.phase==="landed")?
            dog
            : (discFetch.phase==="chase"||discFetch.phase==="found")&&
              discFetch.target&&discGolf.phase!=="off"?
              discFetch.target
            : nearbyCritter
              ? nearbyCritter.point
              : { x: player.x - travel.heading.x * 2.2 + travel.heading.z * 1.2, z: player.z - travel.heading.z * 2.2 - travel.heading.x * 1.2 }
      : { x: 4 + Math.sin(elapsed * 0.13) * 2, z: 12 };
    canvas.dataset.dogFetchStage=discFetch.phase;
    if(snowStagesSeen.at(-1)!==shastaSnow.stage){
      snowStagesSeen.push(shastaSnow.stage);
      if(snowStagesSeen.length>12)snowStagesSeen.shift();
    }
    snowMaxRoll=Math.max(snowMaxRoll,Math.abs(snowPose.roll));
    canvas.dataset.dogSnowStage=shastaSnow.stage;
    canvas.dataset.dogSnowHistory=snowStagesSeen.join(",");
    canvas.dataset.dogSnowMaxRoll=snowMaxRoll.toFixed(3);
    canvas.dataset.dogSnowQueued=String(shastaSnow.queued);
    canvas.dataset.dogCuriosity =
      aquatic !== "land"
        ? "shore"
        : dogWaitsAtCaveEntrance
          ? "cave-entrance"
          : nearbyCritter?.kind ?? "";
    canvas.dataset.caveDogClear = String(
      !dogWaitsAtCaveEntrance || distance(dog, arcadeWall) > 6.5,
    );

    // Cull the static collision field locally instead of scanning the whole
    // island on every step. A generous 10-unit margin covers body movement,
    // near-field trunk routing and the next bounded step.
    if(!dogObstacleAnchor||distance(dog,dogObstacleAnchor)>3.2){
      dogObstacleAnchor={...dog};
      dogLocalObstacles=obstacles.filter(o=>
        Math.hypot(o.x-dog.x,o.z-dog.z)<10+o.radius);
      dogObstacleRefreshes++;
    }
    canvas.dataset.dogObstacleRefreshes=String(dogObstacleRefreshes);
    canvas.dataset.dogNearbyObstacleCount=String(dogLocalObstacles.length);
    // Smooth the target itself, then steer velocity toward it with finite
    // acceleration/braking. This removes the start/stop jerk from direct pursuit.
    const dogMotionDt = Math.min(rawDelta, 0.1);
    if(discGolf.phase!=="off"&&
      (discFetch.phase==="flight"||discFetch.phase==="landed")){
      // Player teleports to the landing lie on impact. Shasta must NOT
      // treat that teleport as an invitation to sprint during the reveal.
      dogVelocity={x:0,z:0};
      dogSmoothedTarget={...dog};
    }
    const activelyFetching=discGolf.phase!=="off"&&
      discFetch.phase==="chase"&&discFetch.target!==null;
    if(activelyFetching&&discFetch.target){
      // A husky runs directly toward the disc, retaining one obstacle
      // waypoint until passed. Recomputing every frame caused lateral
      // steering oscillation and repeatedly scanned every island trunk.
      fetchRunRoute=stepFetchRunRoute(fetchRunRoute,dog,
        discFetch.target,dogLocalObstacles,fetchNow);
      const waypoint=fetchRunRoute.waypoint??discFetch.target;
      dogVelocity=steerFetchRun(dogVelocity,dog,waypoint,
        discFetch.target,dogMotionDt);
      canvas.dataset.dogFetchRouteChecks=String(fetchRunRoute.decisions);
      dogSmoothedTarget={...waypoint};
    }else{
      if(fetchRunRoute.goal!==null)fetchRunRoute=idleFetchRunRoute();
      const dogSteeringTarget=shastaDetour(dog,dogTarget,dogLocalObstacles,1);
      dogSmoothedTarget=smoothPoint(dogSmoothedTarget,
        discGolfSurfaceIsWater(dogSteeringTarget)?dogTarget:dogSteeringTarget,dogMotionDt);
      dogVelocity=steerShastaVelocity(dogVelocity,dog,
        dogSmoothedTarget,
        shastaSnow.stage==="zoom"?9.5:
        shastaSnow.stage==="roll"||shastaSnow.stage==="shake"?0:
        dogChase.mode==="return"?Math.max(travel.speed,6):travel.speed,
        dogMotionDt);
    }
    const dogBefore = { ...dog };
    const requestedDogStep = {
      x: dog.x + dogVelocity.x * dogMotionDt,
      z: dog.z + dogVelocity.z * dogMotionDt,
    };
    const candidate = constrainMove(dog, requestedDogStep, dogLocalObstacles);
    if (!discGolfSurfaceIsWater(candidate)) {
      dog = candidate;
      const requestedDistance = distance(dogBefore, requestedDogStep);
      const actualDistance = distance(dogBefore, dog);
      if (requestedDistance > 0.001 && actualDistance < requestedDistance * 0.72) {
        const inverseDt = 1 / Math.max(0.001, dogMotionDt);
        dogVelocity = {
          x: (dog.x - dogBefore.x) * inverseDt,
          z: (dog.z - dogBefore.z) * inverseDt,
        };
      }
    } else {
      dogVelocity = {
        x: dogVelocity.x * (1 - smoothingAlpha(dogMotionDt, 12)),
        z: dogVelocity.z * (1 - smoothingAlpha(dogMotionDt, 12)),
      };
    }

    const dogStep = distance(dogBefore, dog);
    const dogActualSpeed = dogStep / Math.max(0.001, dogMotionDt);
    dogAnimSpeed +=
      (dogActualSpeed - dogAnimSpeed) * smoothingAlpha(dogMotionDt, 9.5);
    const dogAcceleration =
      Math.abs(dogActualSpeed - lastDogSpeed) / Math.max(0.001, dogMotionDt);
    dogMaxAcceleration = Math.max(dogMaxAcceleration, dogAcceleration);
    lastDogSpeed = dogActualSpeed;

    const velocitySpeed = Math.hypot(dogVelocity.x, dogVelocity.z);
    const desiredDogYaw =
      velocitySpeed > 0.8
        ? Math.atan2(dogVelocity.x, dogVelocity.z)
        : dogYaw;
    const previousDogYaw = dogYaw;
    dogYaw = smoothAngle(dogYaw, desiredDogYaw, dogMotionDt);
    const appliedDogYawStep = Math.abs(
      Math.atan2(
        Math.sin(dogYaw - previousDogYaw),
        Math.cos(dogYaw - previousDogYaw),
      ),
    );
    dogMaxYawStep = Math.max(dogMaxYawStep, appliedDogYawStep);

    const dogHeading = { x: Math.sin(dogYaw), z: Math.cos(dogYaw) };
    // Fetch running keeps the torso level. It is the *feet*, not the
    // shoulders, that accommodate fine terrain bumps. Skip repeated slope
    // probes while chasing to avoid camera-visible high-frequency twitch.
    const poseAlpha=smoothingAlpha(dogMotionDt,4.0);
    if(activelyFetching){
      dogPitch*=1-poseAlpha;
      dogRoll*=1-poseAlpha;
    }else{
      const contact=terrainContact(dog,dogHeading,.58,.22);
      dogPitch+=(contact.pitch-dogPitch)*poseAlpha;
      dogRoll+=(contact.roll-dogRoll)*poseAlpha;
    }

    // Use distance TRAVELLED: collisions or frame stalls never create
    // high-speed stepping in place.
    dogGaitPhase=advanceShastaStride(dogGaitPhase,dogStep,dogAnimSpeed);
    const targetMoveBlend = gaitBlendForSpeed(dogAnimSpeed);
    dogMoveBlend +=
      (targetMoveBlend - dogMoveBlend) * smoothingAlpha(dogMotionDt, 10.5);
    dogMaxMoveBlend = Math.max(dogMaxMoveBlend, dogMoveBlend);

    const targetDogY = discGolfSurfaceHeight(dog);
    dogGroundY +=
      (targetDogY - dogGroundY) * smoothingAlpha(dogMotionDt, 6.5);
    // Use a low-amplitude diagonal trot on the fetch, avoiding the
    // very rapid walk->trot->canter pose changes seen in the screenshots.
    const dogGait=shastaGaitPose(
      activelyFetching?Math.min(7.4,dogAnimSpeed):dogAnimSpeed,
      dogGaitPhase,dogMoveBlend);
    const dogBob=activelyFetching?0:dogGait.bodyBob;
    const dogRenderY=dogGroundY+dogBob;
    dogMaxYStep = Math.max(dogMaxYStep, Math.abs(dogRenderY - lastDogRenderY));
    lastDogRenderY = dogRenderY;
    shasta.position.set(dog.x, dogRenderY, dog.z);
    shasta.rotation.set(
      dogPitch+(activelyFetching?0:dogGait.bodyPitch)+
        (discFetch.phase==="found"?.02:0),
      dogYaw+(shastaSnow.stage==="shake"?snowPose.headTilt:0),
      dogRoll+(activelyFetching?0:
        Math.sin(dogGaitPhase)*.008*dogMoveBlend),
    );
    // Mass-centered full-body roll with gradually lowered back-on-snow pose.
    shastaPose.rotation.z=snowPose.roll;
    shastaPose.rotation.x=snowPose.crouch*.33;
    shastaPose.position.y=.79-.37*Math.sin(snowPose.roll*.5)**2-
      snowPose.crouch*.19;
    canvas.dataset.dogGait=dogGait.gait;
    canvas.dataset.dogFootLiftMax=Math.max(
      ...dogGait.feet.map(p=>p.y-.055)).toFixed(3);
    canvas.dataset.dogBodyBob=dogBob.toFixed(4);
    canvas.dataset.dogSnowRoll=snowPose.roll.toFixed(3);

    canvas.dataset.dogYaw = dogYaw.toFixed(3);
    canvas.dataset.dogY = dogRenderY.toFixed(3);
    canvas.dataset.dogSpeed = dogActualSpeed.toFixed(3);
    canvas.dataset.dogMoveBlend = dogMoveBlend.toFixed(3);
    canvas.dataset.dogGaitPhase = dogGaitPhase.toFixed(3);
    canvas.dataset.dogMaxYawStep = dogMaxYawStep.toFixed(3);
    canvas.dataset.dogMaxYStep = dogMaxYStep.toFixed(3);
    canvas.dataset.dogMaxMoveBlend = dogMaxMoveBlend.toFixed(3);
    canvas.dataset.dogMaxAcceleration = dogMaxAcceleration.toFixed(3);
    canvas.dataset.dogTargetSwitches = String(dogTargetSwitches);

    explorerContact.visible = aquatic === "land";
    explorerContact.position.set(
      explorer.position.x,
      aquatic === "land" ? supportHeight(player) + 0.04 : SEA_SURFACE,
      explorer.position.z,
    );
    dogContact.position.set(dog.x, discGolfSurfaceHeight(dog) + 0.04, dog.z);

    // Simple straight legs, deliberately no inverse kinematics or knee
    // articulation. Each paw follows its own lightly filtered terrain
    // sample while the leg connects directly to its stable body anchor.
    // These scratch vectors are allocated once with the character mesh.
    const limbUp=shastaLimbUp;
    const limbDir=shastaLimbDir;
    shastaLegs.forEach((leg,i)=>{
      const foot=dogGait.feet[i];
      const cosYaw=Math.cos(dogYaw),sinYaw=Math.sin(dogYaw);
      const worldX=dog.x+leg.x*cosYaw+foot.z*sinYaw;
      const worldZ=dog.z+foot.z*cosYaw-leg.x*sinYaw;
      const groundDelta=THREE.MathUtils.clamp(
        discGolfSurfaceHeight({x:worldX,z:worldZ})-dogGroundY,-.075,.075);
      dogFootGround[i]+=(groundDelta-dogFootGround[i])*
        smoothingAlpha(dogMotionDt,7);
      const pose=shastaStraightLeg(
        leg.z,foot.z,foot.y+dogFootGround[i],leg.z>0);
      const part=shastaCylinderParts[leg.legIndex];
      dummy.position.set(leg.x,
        (pose.hip.y+pose.paw.y)*.5,(pose.hip.z+pose.paw.z)*.5);
      limbDir.set(0,pose.hip.y-pose.paw.y,
        pose.hip.z-pose.paw.z).normalize();
      dummy.quaternion.setFromUnitVectors(limbUp,limbDir);
      dummy.scale.set(part.sx,pose.length,part.sz);
      dummy.updateMatrix();
      shastaCylinderMesh.setMatrixAt(leg.legIndex,dummy.matrix);

      // The paw is one small oval, not three cartoon toes. The pitch is
      // nearly flat with only a little slope compensation during stance.
      const pawPart=shastaRockParts[leg.pawIndex];
      const front=discGolfSurfaceHeight({x:worldX+sinYaw*.12,z:worldZ+cosYaw*.12});
      const back=discGolfSurfaceHeight({x:worldX-sinYaw*.12,z:worldZ-cosYaw*.12});
      // During fetch keep all paws nearly level rather than feeding
      // per-step micro-slope noise into tiny geometry rotations.
      const slopePitch=activelyFetching?0:foot.stance?
        THREE.MathUtils.clamp(Math.atan2(front-back,.24),-.045,.045):-.025;
      dummy.position.set(leg.x,pose.paw.y+.012,pose.paw.z+.018);
      dummy.rotation.set(slopePitch,0,0);
      dummy.scale.set(pawPart.sx,pawPart.sy,pawPart.sz);
      dummy.updateMatrix();
      shastaRockMesh.setMatrixAt(leg.pawIndex,dummy.matrix);
    });
    canvas.dataset.shastaLegRig="straight-four";
    canvas.dataset.shastaLegCount=String(shastaLegs.length);
    canvas.dataset.shastaPawWidth=p.paw.x.toFixed(3);
    canvas.dataset.shastaLegWidth=shastaCylinderParts[0].sx.toFixed(3);
    // A tiny articulated head/ear rig: curious side-glances while following,
    // nose-down sniff at the disc, alert ears for snow play. Keep the same
    // single instanced mesh draw calls as the original character.
    const headYaw=Math.sin(elapsed*.76)*.06+
      (shastaSnow.stage==="perk"?.07:0);
    const headPitch=discFetch.phase==="found"?.17:
      shastaSnow.stage==="roll"?.07:dogAnimSpeed<.4?.035:-.025;
    shastaHeadQuat.setFromEuler(new THREE.Euler(headPitch,headYaw,0));
    for(const index of shastaHeadIndices){
      const part=shastaRockParts[index];
      shastaHeadPos.set(part.x,part.y,part.z)
        .sub(shastaHeadPivot).applyQuaternion(shastaHeadQuat)
        .add(shastaHeadPivot);
      dummy.position.copy(shastaHeadPos);
      dummy.quaternion.copy(shastaHeadQuat);
      const isMouth=index===shastaMouthIndex;
      const isTongue=index===shastaTongueIndex;
      const pant=dogAnimSpeed>3||shastaSnow.stage!=="idle"||
        discFetch.phase==="found";
      dummy.scale.set(part.sx,
        part.sy*(isMouth?(pant?1.7:.6):isTongue?(pant?1.8:.25):1),
        part.sz);
      dummy.updateMatrix();
      shastaRockMesh.setMatrixAt(index,dummy.matrix);
    }
    for(let i=0;i<shastaEarParts.length;i++){
      const ear=shastaEarParts[i];
      shastaHeadPos.set(ear.x,ear.y,ear.z)
        .sub(shastaHeadPivot).applyQuaternion(shastaHeadQuat)
        .add(shastaHeadPivot);
      dummy.position.copy(shastaHeadPos);
      shastaEarQuat.copy(shastaHeadQuat);
      if(ear.q)shastaEarQuat.multiply(ear.q);
      dummy.quaternion.copy(shastaEarQuat);
      dummy.scale.set(ear.sx,ear.sy,ear.sz);
      dummy.updateMatrix();
      shastaEarMesh.setMatrixAt(i,dummy.matrix);
    }
    shastaEarMesh.instanceMatrix.needsUpdate=true;
    shastaCylinderMesh.instanceMatrix.needsUpdate = true;
    shastaRockMesh.instanceMatrix.needsUpdate = true;
    const wagEnergy=discFetch.phase==="found"?.8:
      snowPose.wag>0?snowPose.wag:dogMoveBlend*.25;
    shastaTail.rotation.z=SHASTA_CHARACTER.tail.restAngleZ+
      Math.sin(elapsed*2.6)*.027+Math.sin(elapsed*8.3)*.09*wagEnergy;
    shastaTail.rotation.y=SHASTA_CHARACTER.tail.restAngleY+
      Math.sin(elapsed*(wagEnergy>1?10:4.3)+.4)*(.035+wagEnergy*.17);
    const inSnowPlay=shastaSnow.stage==="zoom"||
      shastaSnow.stage==="roll"||shastaSnow.stage==="shake";
    snowPuffs.visible=inSnowPlay;
    if(inSnowPlay){
      const puffCycle=(snowNow-shastaSnow.started)*3.1;
      for(let i=0;i<12;i++){
        const angle=i*2.399+puffCycle*.19;
        const r=.23+(i%4)*.22;
        const px=dog.x+Math.cos(angle)*r,pz=dog.z+Math.sin(angle)*r;
        const age=((puffCycle*.75+i*.381)%1+1)%1;
        dummy.position.set(px,terrainHeight(px,pz)+.08+age*.21,pz);
        dummy.rotation.set(0,angle,0);
        const size=(.045+age*.11)*(shastaSnow.stage==="zoom"?1:.65);
        dummy.scale.set(size,size*.5,size);
        dummy.updateMatrix();snowPuffs.setMatrixAt(i,dummy.matrix);
      }
      snowPuffs.instanceMatrix.needsUpdate=true;
    }
    if(showingDiscGolfIntro || snapDiscCamera){
      // A direct time-derived pose starts on the basket instead of slowly
      // drifting there from a camera that previously followed the player.
      camera.position.copy(targetCamera);
      look.copy(targetLook);
      snapDiscCamera=false;
    }else{
      // Fast enough to keep the flying disc on screen, with smooth
      // cinematic blends instead of jumping between subjects.
      const cinematicRate=discGolf.phase!=="off"&&discFetch.phase==="flight"?8:
        discGolf.phase!=="off"&&discFetch.phase!=="idle"?5.2:3.6;
      camera.position.lerp(targetCamera, 1 - Math.exp(-dt * cinematicRate));
      look.lerp(targetLook, 1 - Math.exp(-dt * (cinematicRate+.4)));
    }
    // The *interpolated* lens can cross foliage even if both ends of
    // the blend are clear. Reject that intermediate pose and snap onto the
    // validated shot so a second throw is never framed from inside a leaf.
    if(lastDiscCameraSolve&&lastDiscCameraSolve.clear){
      if(!cameraVisibility.clear(camera.position,lastDiscCameraSolve.focus)){
        camera.position.copy(lastDiscCameraSolve.position);
        look.copy(targetLook);
      }
      canvas.dataset.discGolfRenderedCameraClear=String(
        cameraVisibility.clear(camera.position,lastDiscCameraSolve.focus));
      canvas.dataset.discGolfRenderedCameraDistance=
        camera.position.distanceTo(lastDiscCameraSolve.position).toFixed(2);
    }else canvas.dataset.discGolfRenderedCameraClear="true";
    if (
      (caveLayer === "arcade" && arcadeInside(player)) ||
      (caveLayer === "paper" && paperCaveInside(player))
    ) {
      const c=constrainMove(player,{x:camera.position.x,z:camera.position.z},caveSolids);
      const inArcade = caveLayer === "arcade" && arcadeInside(player);
      const centerX = inArcade ? 16 : -20;
      const z = THREE.MathUtils.clamp(c.z, inArcade ? -81.6 : -35.4, inArcade ? -63.7 : -30.3);
      const half = (inArcade ? caveHalfWidth(z) : paperCaveHalfWidth(z)) - .85;
      camera.position.x=THREE.MathUtils.clamp(c.x,centerX-half,centerX+half);camera.position.z=z;
      camera.position.y=THREE.MathUtils.clamp(camera.position.y,playerY+1.5,playerY+3);
    }
    camera.lookAt(look);
    // Projection diagnostics are read-only: the raycast still decides whether
    // a real click has struck an unoccluded target in the current camera.
    if(state.entered&&aquatic==="land"&&isBoostActivity(state.activity)&&
      !jetSki&&!jetChoosing&&discGolf.phase==="off"&&bigAir.phase!=="flying"){
      camera.updateMatrixWorld();
      const aimed=rideVisual.visibleAimTarget(state.activity,player,
        travel.speed,elapsed,rideBoost,camera);
      canvas.dataset.rideBoostAim=aimed?
        [aimed.x.toFixed(3),aimed.y.toFixed(3),aimed.id].join(","):"";
    }else canvas.dataset.rideBoostAim="";

    // Underwater atmosphere and biome work are keyed by the water zone. The cold
    // kelp shelf and warm lagoon never render/animate together.
    const underwater = aquatic === "dive";
    const currentWaterZone = waterZone(player);
    reefRoot.visible = aquatic !== "land" && currentWaterZone === "kelp";
    tropicalReefRoot.visible = aquatic !== "land" && currentWaterZone === "lagoon";
    bubbles.visible = aquatic !== "land";
    shasta.visible = !underwater;
    dogContact.visible = !underwater;
    waterMaterial.opacity = underwater ? 0.48 : aquatic === "surface" ? 0.58 : 0.76;
    const underwaterColor =
      currentWaterZone === "lagoon" ? "#167f91" : "#0b6170";
    const underwaterFog =
      currentWaterZone === "lagoon" ? "#2f8f91" : "#196b72";
    if (scene.background instanceof THREE.Color)
      scene.background.set(underwater ? underwaterColor : "#67b7ef");
    if (scene.fog instanceof THREE.Fog) {
      if (underwater) scene.fog.color.set(underwaterFog);
      scene.fog.near = underwater ? 7 : 85;
      scene.fog.far = underwater ? (currentWaterZone === "lagoon" ? 70 : 58) : 270;
    }

    // Ski-mode snowfall follows the player anywhere in the world.
    snowfall.visible = state.activity === "ski" && aquatic !== "dive";
    canvas.dataset.snowing = String(snowfall.visible);
    canvas.dataset.reef = String(reefRoot.visible || tropicalReefRoot.visible);
    canvas.dataset.reefZone = currentWaterZone ?? "";
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
    }

    if (tropicalReefRoot.visible) {
      tropicalFishStates.forEach((fish, i) => {
        const a = elapsed * fish.speed + fish.phase;
        const x = fish.centerX + Math.cos(a) * fish.radiusX;
        const z = fish.centerZ + Math.sin(a) * fish.radiusZ;
        const y = fish.baseY + Math.sin(a * 1.7 + i * 0.4) * 0.34;
        const tx = -Math.sin(a) * fish.radiusX;
        const tz = Math.cos(a) * fish.radiusZ;
        const yawFish = Math.atan2(tx, tz);
        const forwardX = Math.sin(yawFish);
        const forwardZ = Math.cos(yawFish);
        const rightX = Math.cos(yawFish);
        const rightZ = -Math.sin(yawFish);
        const bodyRoll = Math.sin(a * 2 + i) * 0.035;

        dummy.position.set(x, y, z);
        dummy.rotation.set(0, yawFish, bodyRoll);
        dummy.scale.set(
          fish.size * fish.bodyX,
          fish.size * fish.bodyY,
          fish.size * fish.bodyZ,
        );
        dummy.updateMatrix();
        tropicalFishBodies.setMatrixAt(i, dummy.matrix);

        dummy.position.set(
          x - forwardX * fish.size * fish.bodyZ * 0.9,
          y,
          z - forwardZ * fish.size * fish.bodyZ * 0.9,
        );
        dummy.rotation.set(0, yawFish, 0);
        dummy.scale.set(
          fish.size,
          fish.size * fish.bodyY * 1.5,
          fish.size * 0.45,
        );
        dummy.updateMatrix();
        tropicalFishTails.setMatrixAt(i, dummy.matrix);

        dummy.position.set(
          x - forwardX * fish.size * 0.05,
          y + fish.size * fish.bodyY * 0.82,
          z - forwardZ * fish.size * 0.05,
        );
        dummy.rotation.set(0, yawFish, bodyRoll * 0.6);
        dummy.scale.set(
          fish.size,
          fish.size * fish.bodyY * 0.9,
          fish.size * 0.45,
        );
        dummy.updateMatrix();
        tropicalFishDorsals.setMatrixAt(i, dummy.matrix);

        for (const side of [-1, 1] as const) {
          const pectoralIndex = i * 2 + (side === -1 ? 0 : 1);
          dummy.position.set(
            x +
              rightX * side * fish.size * fish.bodyX * 0.82 -
              forwardX * fish.size * 0.02,
            y - fish.size * fish.bodyY * 0.05,
            z +
              rightZ * side * fish.size * fish.bodyX * 0.82 -
              forwardZ * fish.size * 0.02,
          );
          dummy.rotation.set(
            0,
            yawFish,
            -side * (0.82 + Math.sin(a * 2.1 + side) * 0.08),
          );
          dummy.scale.set(
            fish.size,
            fish.size * fish.bodyX * 0.62,
            fish.size * 0.28,
          );
          dummy.updateMatrix();
          tropicalFishPectorals.setMatrixAt(pectoralIndex, dummy.matrix);
        }

        for (const side of [-1, 1]) {
          const eyeIndex = i * 2 + (side === -1 ? 0 : 1);
          dummy.position.set(
            x +
              forwardX * fish.size * fish.bodyZ * 0.58 +
              rightX * side * fish.size * fish.bodyX * 0.72,
            y + fish.size * fish.bodyY * 0.16,
            z +
              forwardZ * fish.size * fish.bodyZ * 0.58 +
              rightZ * side * fish.size * fish.bodyX * 0.72,
          );
          dummy.rotation.set(0, yawFish, 0);
          dummy.scale.set(
            fish.size * 0.045,
            fish.size * 0.045,
            fish.size * 0.03,
          );
          dummy.updateMatrix();
          tropicalFishEyes.setMatrixAt(eyeIndex, dummy.matrix);
        }
      });
      tropicalFishBodies.instanceMatrix.needsUpdate = true;
      tropicalFishTails.instanceMatrix.needsUpdate = true;
      tropicalFishDorsals.instanceMatrix.needsUpdate = true;
      tropicalFishPectorals.instanceMatrix.needsUpdate = true;
      tropicalFishEyes.instanceMatrix.needsUpdate = true;

      tropicalRays.forEach((rayState, i) => {
        const a = elapsed * rayState.speed + rayState.phase;
        const centerZ = 9 + (i - 1) * 5;
        const centerX = eastCoastlineX(centerZ) + 11 + i * 1.6;
        rayState.object.position.set(
          centerX + Math.cos(a) * rayState.radiusX,
          rayState.baseY + Math.sin(a * 1.6 + i) * 0.4,
          centerZ + Math.sin(a) * rayState.radiusZ,
        );
        rayState.object.rotation.y = -a + Math.PI / 2;
        rayState.object.rotation.z = Math.sin(elapsed * 1.5 + i) * 0.08;
      });

      tropicalSharks.forEach((shark, i) => {
        const a = elapsed * (0.075 + i * 0.012) + i * 2.0;
        const centerZ = -3 + i * 12;
        const centerX = eastCoastlineX(centerZ) + 12 + i * 1.4;
        shark.position.set(
          centerX + Math.cos(a) * (7.5 + i * 2),
          -3.8 - i * 0.65,
          centerZ + Math.sin(a) * (10 + i * 2.2),
        );
        shark.rotation.y = -a + Math.PI / 2;
        shark.rotation.z = Math.sin(a * 2) * 0.035;
      });
      tropicalMotes.rotation.y = Math.sin(elapsed * 0.07) * 0.015;
      tropicalMotes.position.y = Math.sin(elapsed * 0.2) * 0.045;
    }

    if (bubbles.visible) {
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
    waterRibbonMat.opacity = .66 + Math.sin(elapsed * 3) * .025;
    waterfall.visible = true;
    if (reefRoot.visible || tropicalReefRoot.visible) {
      const rp=rayGeo.attributes.position;
      for(let i=0;i<rp.count;i++)rp.setZ(i,rayOriginal[i*3+2]+Math.sin(elapsed*1.6+Math.abs(rayOriginal[i*3])*1.2)*.09*Math.abs(rayOriginal[i*3]));
      rp.needsUpdate=true;
      rayGeo.computeVertexNormals();
    }
    reefGarden.update(elapsed);
    const reducedFlightMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    marineSchools.update(elapsed,reducedFlightMotion);
    discGolfObjects.update(discGolf);
    // Bound prediction to ~2 Hz while a disc is being aimed. The preview
    // runs the same solver as the throw, but intentionally assumes a
    // centered release; actual late/early timing changes its trajectory.
    if(state.discGolfPreview!==lastDiscPreview ||
      discGolf.phase!==lastDiscPreviewPhase ||
      discGolf.clock-lastPreviewTick>.6){
      discGolfObjects.updatePreview(discGolf,state.discGolfPreview,obstacles);
      lastDiscPreview=state.discGolfPreview;
      lastDiscPreviewPhase=discGolf.phase;
      lastPreviewTick=discGolf.clock;
    }
    flyingBirds.update(bigAir,elapsed,reducedFlightMotion);
    canvas.dataset.bigAirBirdsFollowing=String(flyingBirds.active);
    habitats.update(player,elapsed);
    if(aquatic === "land" && scene.fog instanceof THREE.Fog) {
      const w = biomeAt({x:camera.position.x,z:camera.position.z}).weights;
      const fogTarget = new THREE.Color("#c4d9df").lerp(new THREE.Color("#d7c7ae"),w.desert).lerp(new THREE.Color("#a8c4af"),w.rainforest+w.redwood*.35);
      scene.fog.color.lerp(fogTarget,1-Math.exp(-Math.min(rawDelta,.1)*2));
    }
    canvas.dataset.biome = biomeAt(player).primary;
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
        if(bigAir.phase==="armed"||bigAir.phase==="flying"){
          bigAir={...bigAir,phase:"missed",reason:"Ski mode changed"};
          callbacks.onBigAir(bigAir);
        }
        clearInput();
        resetRideBoost();
        climb = null;
        grind = null;
        airHeight = verticalSpeed = 0;
      }
      state = next;
      if(next.discGolfExitSerial!==lastDiscExit){
        lastDiscExit=next.discGolfExitSerial;
        discFetch=idleDiscGolfFetch();
        discGolfIntro=null;
        discGolf=idleDiscGolf();callbacks.onDiscGolf(discGolf);
      }
      if(next.discGolfStartSerial!==lastDiscStart &&
         next.entered&&!next.paused&&!occupiedByOtherMode("disc")){
        // Consume the start request only after the world can actually start.
        // Previously an early/paused request was discarded forever.
        lastDiscStart=next.discGolfStartSerial;
          const hole=DISC_GOLF_HOLES[next.discGolfHoleIndex]??DISC_GOLF_HOLES[0];
          discGolf=startDiscGolf(next.discGolfHoleIndex,discGolfSurfaceHeight,elapsed);
          canvas.dataset.discGolfLastShot="pending";
          canvas.dataset.discGolfHandoff="none";
          canvas.dataset.discGolfHandoffReason="none";
          canvas.dataset.discGolfHandoffPending="false";
          discFetch=idleDiscGolfFetch();
          player={...hole.tee};playerY=groundHeight(player);
          const basket=discGolfNextTarget(discGolf);
          const faceX=basket.x-player.x,faceZ=basket.z-player.z;
          const faceLength=Math.hypot(faceX,faceZ)||1;
          travel={point:player,speed:0,heading:{x:faceX/faceLength,z:faceZ/faceLength}};
          explorer.rotation.y=Math.atan2(faceX,faceZ);
          yaw=Math.atan2(-faceX,-faceZ);
          const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          // Hole 2 starts *on the open pier*, facing the fairway. Skip the
          // basket flyover that previously placed its opening shot in trees.
          const pierTee=discGolf.holeIndex===1;
          discGolfIntro=pierTee?null:{startedAt:elapsed,reducedMotion};
          snapDiscCamera=pierTee;
          const teePose=discGolfThrowCameraPose(player,basket,playerY);
          const introStart=pierTee?
            {camera:teePose.camera,look:teePose.look}:
            discGolfIntroPose(player,basket,teePose.camera,teePose.look,
              0,p=>worldFloorHeight(p.x,p.z),reducedMotion);
          canvas.dataset.discGolfTeeSite=pierTee?"pier":"land";
          canvas.dataset.discGolfTeeHeight=discGolfSurfaceHeight(player).toFixed(3);
          camera.position.set(introStart.camera.x,introStart.camera.y,introStart.camera.z);
          look.set(introStart.look.x,introStart.look.y,introStart.look.z);
          camera.lookAt(look);
          airHeight=verticalSpeed=swimDepth=targetDepth=0;
          climb=grind=null;caveLayer="surface";
          setAquaticMode("land");clearInput();
          bigAir=idleBigAir();
          if(trial.phase==="running"||trial.phase==="armed"){
            trial=abortJoshuaTrial(trial,"Disc golf started");callbacks.onChallenge(trial);
          }
          dog={x:player.x+1.8,z:player.z-1.8};
          dogVelocity={x:0,z:0};dogSmoothedTarget={...dog};
          dogGroundY=discGolfSurfaceHeight(dog);
          dogFootGround.fill(0);dogCameraAnchor=null;
          callbacks.onDiscGolf(discGolf);
      }
      if(next.discGolfShotSerial!==lastDiscShot){
        lastDiscShot=next.discGolfShotSerial;
        if(next.discGolfShot&&discGolf.phase!=="off"){
          if(discGolf.presentationPending){
            // Ignore synthetic, double-click or stale shot commands while
            // the previous disc is still being retrieved.
            canvas.dataset.discGolfLastShot="waiting-fetch";
          }else{
            if(discGolfIntro){discGolfIntro=null;snapDiscCamera=true;}
            const beforeShot=discGolf.phase;
            discGolf=discGolfThrow(discGolf,next.discGolfShot,discGolfSurfaceHeight);
            const accepted=discGolf.phase==="flying"&&beforeShot!=="flying";
            if(accepted){
              discFetch=startDiscGolfFetch(performance.now()*.001);
              discGolf={...discGolf,presentationPending:true};
              canvas.dataset.discGolfHandoff="waiting";
            }
            canvas.dataset.discGolfLastShot=accepted?"accepted":"rejected";
            callbacks.onDiscGolf(discGolf);
          }
        }
      }
      if(next.paused && discGolfIntro){
        discGolfIntro=null;snapDiscCamera=true;
      }
      if(next.paused && (bigAir.phase==="armed"||bigAir.phase==="flying")){
        bigAir={...bigAir,phase:"missed",reason:"Jump interrupted"};
        callbacks.onBigAir(bigAir);
      }
      if(next.paused && (trial.phase==="armed"||trial.phase==="running")) {
        trial=abortJoshuaTrial(trial,"Interrupted by menu or pause");
        callbacks.onChallenge(trial);
      }
      if (next.entered && !wasEntered) {
        // Welcome mode has its own ambient dog wandering. Gait continuity metrics
        // judge entered-world following, so start that measurement at the moment
        // exploration begins instead of carrying welcome-transition motion forward.
        dogVelocity = { x: 0, z: 0 };
        dogSmoothedTarget = { ...dog };
        dogAnimSpeed = 0;
        dogInterestCritterIndex = null;
        dogChase = { ...initialChaseState(), cooldown: elapsed + 0.8 };
        dogTargetSwitches = 0;
        dogMaxYawStep = 0;
        dogMaxYStep = 0;
        dogMaxMoveBlend = 0;
        dogMaxAcceleration = 0;
        lastDogSpeed = 0;
        lastDogRenderY = shasta.position.y;
      }
      if(changedActivity){
        snowStagesSeen=[];snowMaxRoll=0;
        shastaSnow=next.activity==="ski"?
          queueShastaSnowPlay(idleShastaSnowPlay()):
          idleShastaSnowPlay();
      }
      if (next.entered && !next.paused && (changedActivity || requestedAction || requestedWaterAction))
        canvas.focus({ preventScroll: true });
      if(next.bigAirSerial!==lastBigAirSerial) {
        lastBigAirSerial=next.bigAirSerial;
        if(next.entered&&!next.paused&&!occupiedByOtherMode("ski")){
          player={...BIG_AIR.start};
          travel={point:player,heading:{...BIG_AIR.heading},speed:0};
          yaw=Math.atan2(-BIG_AIR.heading.x,-BIG_AIR.heading.z);
          playerY=groundHeight(player);
          airHeight=verticalSpeed=swimDepth=targetDepth=0;
          climb=grind=null;
          caveLayer="surface";
          setAquaticMode("land");
          destination=null;
          clearInput();
          dog={x:player.x+2,z:player.z-2};
          dogVelocity={x:0,z:0};
          dogSmoothedTarget={...dog};
          dogGroundY=discGolfSurfaceHeight(dog);
          dogFootGround.fill(0);dogCameraAnchor=null;
          bigAir=armBigAir();
          resetRideBoost();
          callbacks.onBigAir(bigAir);
          canvas.focus({preventScroll:true});
        }
      }
      if(next.challengeSerial!==lastChallengeSerial) {
        lastChallengeSerial=next.challengeSerial;
        if(next.entered && !next.paused && !occupiedByOtherMode("trial")) {
          const start=JOSHUA_GATES[0];
          // Explicit challenge selection moves the player to a safe start
          // approach, never to an arbitrary point mid-air or inside a gap.
          player={x:start.point.x-start.forward.x*1.5,
            z:start.point.z-start.forward.z*1.5};
          travel={point:player,speed:0,heading:{...start.forward}};
          yaw=Math.atan2(-start.forward.x,-start.forward.z);
          playerY=groundHeight(player);
          airHeight=verticalSpeed=swimDepth=targetDepth=0;
          climb=grind=null;
          setAquaticMode("land");
          caveLayer="surface";
          destination=null;
          clearInput();
          dog={x:player.x+2,z:player.z+2};
          dogVelocity={x:0,z:0};
          dogSmoothedTarget={...dog};
          dogGroundY=discGolfSurfaceHeight(dog);
          dogFootGround.fill(0);dogCameraAnchor=null;
          trial=armJoshuaTrial();
          resetRideBoost();
          callbacks.onChallenge(trial);
          canvas.focus({preventScroll:true});
        }
      }
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
        if(discGolf.phase!=="off"){
          discFetch=idleDiscGolfFetch();
          discGolfIntro=null;
          discGolf=idleDiscGolf();callbacks.onDiscGolf(discGolf);
        }
        if(bigAir.phase==="armed"||bigAir.phase==="flying"){
          bigAir={...bigAir,phase:"missed",reason:"Region transfer"};
          callbacks.onBigAir(bigAir);
        }
        // Region fast travel is an explicit run invalidation, even if it
        // lands on a future checkpoint or is performed between frame ticks.
        if(trial.phase==="armed"||trial.phase==="running"){
          trial=abortJoshuaTrial(trial,"Region transfer");
          callbacks.onChallenge(trial);
        }
        resetRideBoost();
        // Region transfer invalidates airborne tricks and manuals. A fast
        // travel cannot impersonate a landing or credit an unfinished line.
        skateTrick={...idleSkateTrick(),best:skateTrick.best};
        skateHasBeenAirborne=false;skateCarveLean=0;
        lastSerial = next.command.serial;
        const r = REGIONS.find((r) => r.id === next.command!.region)!;
        jetSki=null;jetRivals=[];jetHud.style.display="none";
        callbacks.onJetSkiMode(false);
        if(jetChoosing){jetChoosing=false;jetChooser.hidden=true;}
        player =
          (next.command.activity && activityLanding(next.command.activity)) ||
          regionLanding(r.id);
        clearInput();
        travel = { point: player, speed: 0, heading: { x: 0, z: -1 } };
        airHeight = verticalSpeed = swimDepth = targetDepth = 0;
        climb = null;
        grind = null;
        setAquaticMode("land");
        caveLayer = "surface";
        playerY = groundHeight(player);
        dog = { x: player.x + 2, z: player.z - 2 };
        dogVelocity = { x: 0, z: 0 };
        dogSmoothedTarget = { ...dog };
        dogGroundY = terrainHeight(dog.x, dog.z);
        dogFootGround.fill(0);dogCameraAnchor=null;
        dogPitch = 0;
        dogRoll = 0;
        dogMoveBlend = 0;
        dogAnimSpeed = 0;
        dogInterestCritterIndex = null;
        dogChase = { ...initialChaseState(), cooldown: elapsed + 0.8 };
        dogTargetSwitches = 0;
        dogMaxYawStep = 0;
        dogMaxYStep = 0;
        dogMaxMoveBlend = 0;
        dogMaxAcceleration = 0;
        lastDogSpeed = 0;
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
              ? Math.PI
              : r.id === "coast"
                ? 1.15
                : r.id === "lagoon"
                  ? -1.15
                  : r.id === "neural"
                    ? -0.6
                    : 0.25;
        }
        if (r.id === "cavern") {
          yaw = Math.PI;
          pitch = 0.22;
          zoom = Math.min(zoom, 15);
        }
        // Menu-driven semantic travel closes a dialog whose focus-restoration
        // target is the menu trigger. Exploration should immediately regain
        // keyboard authority after the jump.
        if (next.entered && !next.paused) canvas.focus({ preventScroll: true });
      }
      if (state.paused) {
        clearInput();
        resetRideBoost();
        cancelAnimationFrame(raf);
        raf = 0;
      } else schedule();
    },
    dispose() {
      discGolfObjects.dispose();
      jetskiCoast.dispose();
      rideVisual.dispose();rideHud.remove();rideReticle.remove();rideAnnounce.remove();
      jetHud.remove();jetAnnounce.remove();jetTouch.remove();jetNotice.remove();jetChooser.remove();
      jetskiVisual.root.traverse(object=>{
        if(object instanceof THREE.Mesh){object.geometry.dispose();
          const mat=object.material;
          if(Array.isArray(mat))mat.forEach(m=>m.dispose());else mat.dispose();}
      });
      scene.remove(jetskiVisual.root);
      flyingBirds.dispose();
      technicalFeatures.dispose();
      habitats.dispose();
      reefGarden.dispose();
      marineSchools.dispose();
      goldenTridents.dispose();
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
      window.removeEventListener("blur", clearHeldJetControls);
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
