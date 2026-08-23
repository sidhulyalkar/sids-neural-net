'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { OrbitControls, Sparkles, Stars } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, Mesh, Object3D, type WebGLRenderer } from 'three';
import { NATURE_WORLD_PALETTES, getNatureWorld } from '@/lib/physiology/natureWorldsExpanded';
import { getSignal, type PersonaMoodSelfReport, type PersonaSnapshot } from '@/lib/physiology/schema';
import { ACTIVITIES, type PersonaActivity } from '@/lib/physiology/world';
import { detectWorldLoomCapabilities, worldLoomXrFeatureEnabled, type WorldLoomCapabilities } from '@/lib/physiology/world3d/capabilities';
import { compileWorld3D } from '@/lib/physiology/world3d/compileWorld3D';
import { buildWorldNavigationGeometry } from '@/lib/physiology/world3d/navigation';
import { auditWorldLoomReadiness } from '@/lib/physiology/world3d/readiness';
import { makeRandom, range, sampleAnnulus } from '@/lib/physiology/world3d/random';
import { WORLD3D_QUALITY_RULES } from '@/lib/physiology/world3d/standards';
import type {
  MaterialRole,
  MaterialStyle,
  PrimitiveKind,
  World3DPlan,
  World3DPrimitive,
  World3DScatterGroup,
} from '@/lib/physiology/world3d/types';

type SceneProps = {
  snapshot: PersonaSnapshot;
  mood: PersonaMoodSelfReport;
  accent: string;
  worldId: string;
  activity: PersonaActivity;
};

type XrNavigator = Navigator & {
  xr?: {
    requestSession: (mode: 'immersive-vr', options?: unknown) => Promise<unknown>;
  };
};

function numericSignal(snapshot: PersonaSnapshot, key: string, fallback: number): number {
  const signal = getSignal(snapshot, key);
  return signal?.available && typeof signal.value === 'number' ? signal.value : fallback;
}

function paletteFor(plan: World3DPlan) {
  return NATURE_WORLD_PALETTES[plan.source.palette];
}

type Palette = ReturnType<typeof paletteFor>;

function colorFor(role: MaterialRole, palette: Palette, accent: string): string {
  if (role === 'ground') return palette.ground;
  if (role === 'accent') return accent || palette.accent;
  if (role === 'secondary') return palette.secondary;
  if (role === 'water') return palette.water;
  if (role === 'glow') return palette.glow;
  return palette.fog;
}

function Geometry({ kind }: { kind: PrimitiveKind }) {
  if (kind === 'slab') return <boxGeometry args={[1, 1, 1]} />;
  if (kind === 'column') return <cylinderGeometry args={[0.5, 0.62, 1, 8]} />;
  if (kind === 'arch') return <torusGeometry args={[0.7, 0.18, 8, 24, Math.PI]} />;
  if (kind === 'ring' || kind === 'portal') return <torusGeometry args={[0.68, 0.14, 8, 28]} />;
  if (kind === 'island') return <cylinderGeometry args={[0.78, 1, 0.65, 7]} />;
  if (kind === 'dome') return <sphereGeometry args={[0.7, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62]} />;
  if (kind === 'shard') return <coneGeometry args={[0.7, 1, 5]} />;
  if (kind === 'spire') return <coneGeometry args={[0.5, 1, 7]} />;
  if (kind === 'boulder') return <dodecahedronGeometry args={[0.65, 0]} />;
  if (kind === 'crystal') return <octahedronGeometry args={[0.62, 0]} />;
  if (kind === 'canopy') return <icosahedronGeometry args={[0.66, 1]} />;
  return <sphereGeometry args={[0.65, 10, 8]} />;
}

function Material({ style, role, palette, accent, emissive = 0 }: { style: MaterialStyle; role: MaterialRole; palette: Palette; accent: string; emissive?: number }) {
  const color = colorFor(role, palette, accent);
  if (style === 'glow') return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={Math.max(0.7, emissive)} roughness={0.32} metalness={0.06} />;
  if (style === 'water') return <meshStandardMaterial color={color} transparent opacity={0.72} roughness={0.18} metalness={0.08} />;
  if (style === 'glass') return <meshStandardMaterial color={color} transparent opacity={0.48} roughness={0.12} metalness={0.08} />;
  if (style === 'soft') return <meshStandardMaterial color={color} roughness={0.86} metalness={0.01} flatShading />;
  return <meshStandardMaterial color={color} roughness={0.96} metalness={0.01} flatShading />;
}

function WorldPrimitiveMesh({ primitive, palette, accent, onLandmark }: { primitive: World3DPrimitive; palette: Palette; accent: string; onLandmark: () => void }) {
  return (
    <mesh
      position={[...primitive.position]}
      rotation={[...primitive.rotation]}
      scale={[...primitive.scale]}
      castShadow={primitive.collision !== 'ground'}
      receiveShadow
      onClick={primitive.id === 'landmark' ? (event) => { event.stopPropagation(); onLandmark(); } : undefined}
    >
      <Geometry kind={primitive.kind} />
      <Material style={primitive.material} role={primitive.colorRole} palette={palette} accent={accent} emissive={primitive.emissive} />
    </mesh>
  );
}

function scatterAspect(kind: PrimitiveKind, scale: number): readonly [number, number, number] {
  if (kind === 'canopy') return [scale, scale * 1.45, scale];
  if (kind === 'spire') return [scale * 0.7, scale * 2.1, scale * 0.7];
  if (kind === 'crystal') return [scale * 0.72, scale * 1.65, scale * 0.72];
  if (kind === 'ring') return [scale * 1.5, scale * 1.5, scale * 1.5];
  if (kind === 'dome') return [scale, scale * 0.72, scale];
  return [scale, scale, scale];
}

function InstancedScatter({ group, palette, accent }: { group: World3DScatterGroup; palette: Palette; accent: string }) {
  const ref = useRef<InstancedMesh>(null);
  const transforms = useMemo(() => {
    const random = makeRandom(group.seed);
    return Array.from({ length: group.count }, (_, index) => {
      const point = sampleAnnulus(random, group.minRadius, group.maxRadius, group.minHeight, group.maxHeight);
      const scale = range(random, group.minScale, group.maxScale);
      const aspect = scatterAspect(group.kind, scale);
      const surfaceLift = group.placement === 'floating' ? 0 : Math.max(0.06, aspect[1] * 0.32);
      return {
        position: [point[0], point[1] + surfaceLift, point[2]] as const,
        rotationY: random() * Math.PI * 2 + index * 0.13,
        rotationZ: group.kind === 'crystal' ? range(random, -0.18, 0.18) : 0,
        scale: aspect,
      };
    });
  }, [group]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new Object3D();
    transforms.forEach((transform, index) => {
      object.position.set(...transform.position);
      object.rotation.set(0, transform.rotationY, transform.rotationZ);
      object.scale.set(...transform.scale);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [transforms]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, group.count]} castShadow receiveShadow frustumCulled>
      <Geometry kind={group.kind} />
      <Material style={group.material} role={group.colorRole} palette={palette} accent={accent} />
    </instancedMesh>
  );
}

function WorldLawGroup({ plan, resonance, children }: { plan: World3DPlan; resonance: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const lastResonance = useRef(resonance);
  const impulseStart = useRef(-10);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    if (resonance !== lastResonance.current) {
      lastResonance.current = resonance;
      impulseStart.current = t;
    }
    const impulse = Math.max(0, 1 - (t - impulseStart.current) / 2);
    const motion = WORLD3D_QUALITY_RULES.maximumWorldMotionMeters;
    const rotation = WORLD3D_QUALITY_RULES.maximumWorldRotationRadians;
    ref.current.position.y = 0;
    ref.current.rotation.y = 0;
    ref.current.scale.setScalar(1);
    if (plan.law === 'tide') ref.current.position.y = Math.sin(t * 0.45) * motion * 0.28;
    if (plan.law === 'breath' || plan.law === 'bloom') ref.current.scale.setScalar(1 + Math.sin(t * 0.72) * 0.006 + impulse * 0.009);
    if (plan.law === 'orbit' || plan.law === 'constellation') ref.current.rotation.y = Math.sin(t * 0.16) * rotation * 0.35;
    if (plan.law === 'harmony') ref.current.position.y = Math.sin(t * 0.9) * motion * 0.12 + impulse * motion * 0.18;
    if (plan.law === 'echo') ref.current.rotation.y = Math.sin(t * 0.62) * rotation * 0.12 * Math.max(0.3, impulse);
  });

  return <group ref={ref}>{children}</group>;
}

function Atmosphere({ plan, palette }: { plan: World3DPlan; palette: Palette }) {
  const mode = plan.atmosphere.particleMode;
  if (mode === 'stars') {
    return <Stars radius={Math.max(18, plan.radius * 1.6)} depth={18} count={Math.max(180, plan.atmosphere.particleCount * 2)} factor={2.2} saturation={0.25} fade speed={0.25} />;
  }
  if (mode === 'none') return null;
  const color = mode === 'rain' ? palette.water : mode === 'snow' ? palette.glow : palette.accent;
  return (
    <Sparkles
      count={plan.atmosphere.particleCount}
      scale={[plan.radius * 1.5, Math.max(5, plan.radius * 0.72), plan.radius * 1.5]}
      size={mode === 'rain' ? 1.2 : mode === 'snow' ? 2.6 : 1.8}
      speed={mode === 'rain' ? 1.25 : 0.35 + plan.atmosphere.drift * 0.5}
      noise={mode === 'rain' ? [0.1, 1.8, 0.1] : [0.55, 0.38, 0.55]}
      color={color}
    />
  );
}

function PersonaRig({ snapshot, mood, accent }: Pick<SceneProps, 'snapshot' | 'mood' | 'accent'>) {
  const group = useRef<Group>(null);
  const torso = useRef<Mesh>(null);
  const heart = useRef<Mesh>(null);
  const respiration = numericSignal(snapshot, 'respiration_rate', 12);
  const cardiac = numericSignal(snapshot, 'cardiac_rate', 60);
  const movement = numericSignal(snapshot, 'movement_intensity', 0.1);
  const moodEnergy = { calm: 0.55, curious: 0.82, energized: 1.2, sleepy: 0.3 }[mood];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const breath = Math.sin(t * Math.PI * 2 * (Math.max(6, respiration) / 60));
    if (group.current) group.current.position.y = Math.sin(t * (1.6 + movement * 2.2)) * 0.022 * moodEnergy;
    if (torso.current) torso.current.scale.set(0.34 + breath * 0.006, 0.46 + breath * 0.015, 0.28 + breath * 0.008);
    if (heart.current) {
      const pulse = Math.max(0, Math.sin(t * Math.PI * 2 * (Math.max(40, cardiac) / 60)));
      heart.current.scale.setScalar(0.045 + pulse * 0.01);
    }
  });

  return (
    <group ref={group} position={[0, 0, 1.8]}>
      <mesh ref={torso} position={[0, 0.62, 0]} scale={[0.34, 0.46, 0.28]} castShadow><sphereGeometry args={[1, 18, 16]} /><meshStandardMaterial color={accent} roughness={0.66} /></mesh>
      <mesh position={[0, 1.18, 0]} castShadow><sphereGeometry args={[0.24, 18, 16]} /><meshStandardMaterial color={accent} roughness={0.62} /></mesh>
      <mesh position={[-0.085, 1.22, 0.22]} scale={[0.035, 0.045, 0.02]}><sphereGeometry /><meshStandardMaterial color="#effcff" emissive="#9de7f6" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0.085, 1.22, 0.22]} scale={[0.035, 0.045, 0.02]}><sphereGeometry /><meshStandardMaterial color="#effcff" emissive="#9de7f6" emissiveIntensity={0.3} /></mesh>
      <mesh ref={heart} position={[0, 0.68, 0.28]} scale={0.045}><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color="#f6a7ad" emissive="#e76f7d" emissiveIntensity={0.5} /></mesh>
    </group>
  );
}

function SceneContent({ plan, snapshot, mood, accent, resonance, onLandmark }: { plan: World3DPlan; snapshot: PersonaSnapshot; mood: PersonaMoodSelfReport; accent: string; resonance: number; onLandmark: () => void }) {
  const palette = paletteFor(plan);
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.fog, plan.atmosphere.fogNear, plan.atmosphere.fogFar]} />
      <ambientLight intensity={plan.lighting.ambient} />
      <hemisphereLight args={[palette.sky, palette.ground, plan.lighting.fill]} />
      <directionalLight position={[...plan.lighting.keyPosition]} intensity={plan.lighting.key} color={palette.glow} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[0, 2.2, -plan.radius * 0.48]} intensity={plan.lighting.landmarkGlow} distance={7} color={palette.glow} />
      <WorldLawGroup plan={plan} resonance={resonance}>
        {plan.structures.map((entry) => <WorldPrimitiveMesh key={entry.id} primitive={entry} palette={palette} accent={accent} onLandmark={onLandmark} />)}
        {plan.scatter.map((group) => <InstancedScatter key={group.id} group={group} palette={palette} accent={accent} />)}
      </WorldLawGroup>
      <Atmosphere plan={plan} palette={palette} />
      <PersonaRig snapshot={snapshot} mood={mood} accent={accent} />
    </>
  );
}

const EMPTY_CAPABILITIES: WorldLoomCapabilities = { webgl: true, webxr: false, immersiveVr: null, handTrackingHint: false };

export function WorldLoom3DScene(props: SceneProps) {
  const world = getNatureWorld(props.worldId);
  const plan = useMemo(() => compileWorld3D(world), [world]);
  const readiness = useMemo(() => auditWorldLoomReadiness(plan), [plan]);
  const navigation = useMemo(() => buildWorldNavigationGeometry(plan), [plan]);
  const activity = ACTIVITIES[props.activity];
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);
  const [xrStatus, setXrStatus] = useState<'idle' | 'entering' | 'active' | 'unsupported' | 'error'>('idle');
  const [resonance, setResonance] = useState(0);
  const [capabilities, setCapabilities] = useState<WorldLoomCapabilities>(EMPTY_CAPABILITIES);
  const xrFeatureEnabled = worldLoomXrFeatureEnabled();
  const canEnterXr = xrFeatureEnabled && readiness.xrReady && capabilities.webxr && capabilities.immersiveVr !== false;

  useEffect(() => {
    let cancelled = false;
    void detectWorldLoomCapabilities().then((result) => {
      if (!cancelled) setCapabilities(result);
    });
    return () => { cancelled = true; };
  }, []);

  const enterXr = useCallback(async () => {
    if (!xrFeatureEnabled || !readiness.xrReady) {
      setXrStatus('unsupported');
      return;
    }
    const xr = (navigator as XrNavigator).xr;
    if (!xr || !renderer) {
      setXrStatus('unsupported');
      return;
    }
    try {
      setXrStatus('entering');
      const session = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      renderer.xr.setReferenceSpaceType('local-floor');
      await (renderer.xr as unknown as { setSession: (value: unknown) => Promise<void> }).setSession(session);
      const endAwareSession = session as { addEventListener?: (name: string, callback: () => void) => void };
      endAwareSession.addEventListener?.('end', () => setXrStatus('idle'));
      setXrStatus('active');
    } catch {
      setXrStatus('error');
    }
  }, [readiness.xrReady, renderer, xrFeatureEnabled]);

  return (
    <div className="relative h-[500px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 sm:h-[620px]">
      <Canvas
        dpr={[1, 1.35]}
        shadows
        camera={{ position: [...plan.camera.desktopPosition], fov: plan.camera.fov, near: 0.1, far: plan.radius * 4 + 18 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.xr.enabled = xrFeatureEnabled;
          if (xrFeatureEnabled) gl.xr.setReferenceSpaceType('local-floor');
          setRenderer(gl);
        }}
      >
        <SceneContent
          plan={plan}
          snapshot={props.snapshot}
          mood={props.mood}
          accent={props.accent}
          resonance={resonance}
          onLandmark={() => setResonance((value) => value + 1)}
        />
        <OrbitControls
          target={[...plan.camera.target]}
          enablePan={false}
          minDistance={plan.camera.minDistance}
          maxDistance={plan.camera.maxDistance}
          minPolarAngle={Math.PI * 0.17}
          maxPolarAngle={Math.PI * 0.72}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/28 to-transparent px-4 pb-4 pt-20 sm:px-5 sm:pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-xl">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white/52">world {String(world.index).padStart(3, '0')} · {plan.archetype} · law: {plan.law}</p>
            <p className="mt-1 text-sm font-medium text-white/92">{world.icon} {world.name}</p>
            <p className="mt-1 hidden max-w-lg text-[0.65rem] leading-5 text-white/52 sm:block">{world.scene.visualThesis}</p>
          </div>
          <p className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[0.68rem] text-white/75 backdrop-blur">{activity.icon} {activity.name}</p>
        </div>
      </div>

      <div className="absolute left-3 top-3 flex max-w-[78%] flex-wrap gap-1.5 font-mono text-[0.53rem] uppercase tracking-[0.1em] text-white/62">
        <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 backdrop-blur">world loom · seed {plan.seed}</span>
        <span className={`rounded-full border px-2.5 py-1 backdrop-blur ${readiness.desktopReady ? 'border-emerald-300/20 bg-emerald-950/35 text-emerald-100/75' : 'border-amber-300/20 bg-amber-950/35 text-amber-100/75'}`}>{readiness.desktopReady ? 'desktop audit ✓' : 'desktop audit !'}</span>
        <span className={`rounded-full border px-2.5 py-1 backdrop-blur ${readiness.xrReady ? 'border-emerald-300/20 bg-emerald-950/35 text-emerald-100/75' : 'border-white/10 bg-black/35 text-white/55'}`}>{readiness.xrReady ? 'XR spatial audit ✓' : 'XR gated'}</span>
        <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 backdrop-blur">{navigation.corridors.length} routes · {readiness.teleportPointCount} teleport points</span>
        <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 backdrop-blur">{plan.diagnostics.instanceCount} instances · ~{plan.diagnostics.estimatedDrawCalls} draws</span>
      </div>

      <div className="absolute right-3 top-3 flex gap-2">
        {canEnterXr ? (
          <button
            type="button"
            onClick={enterXr}
            disabled={xrStatus === 'entering' || xrStatus === 'active'}
            className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[0.62rem] font-medium text-white/80 backdrop-blur transition hover:bg-black/60 disabled:opacity-50"
          >
            {xrStatus === 'entering' ? 'entering XR…' : xrStatus === 'active' ? 'XR active' : xrStatus === 'error' ? 'retry XR' : 'enter WebXR'}
          </button>
        ) : null}
      </div>

      {(readiness.blockers.length > 0 || readiness.warnings.length > 0) ? (
        <div className="pointer-events-none absolute right-3 top-12 max-w-[280px] rounded-xl border border-amber-300/15 bg-black/50 p-2 text-[0.58rem] leading-4 text-amber-100/65 backdrop-blur">
          {readiness.blockers.slice(0, 2).map((issue) => <p key={`block-${issue.code}-${issue.message}`}>× {issue.code}</p>)}
          {readiness.blockers.length === 0 && readiness.warnings.slice(0, 2).map((issue) => <p key={`warn-${issue.code}-${issue.message}`}>△ {issue.code}</p>)}
        </div>
      ) : null}
    </div>
  );
}
