import { NATURE_WORLDS } from '../lib/physiology/natureWorldsExpanded';
import { compileWorld3D } from '../lib/physiology/world3d/compileWorld3D';
import { auditWorldLoomReadiness } from '../lib/physiology/world3d/readiness';

const plans = NATURE_WORLDS.map(compileWorld3D);
const readiness = plans.map((plan) => ({ plan, audit: auditWorldLoomReadiness(plan) }));
const failures = readiness.flatMap(({ plan, audit }) =>
  audit.desktopReady
    ? []
    : audit.blockers.map((issue) => ({ world: plan.worldId, index: plan.worldIndex, code: issue.code, message: issue.message }))
);
const xrBlockers = readiness.flatMap(({ plan, audit }) =>
  audit.xrReady
    ? []
    : audit.blockers.map((issue) => ({ world: plan.worldId, index: plan.worldIndex, code: issue.code, message: issue.message }))
);
const warnings = readiness.flatMap(({ plan, audit }) =>
  audit.warnings.map((issue) => ({ world: plan.worldId, index: plan.worldIndex, code: issue.code, message: issue.message }))
);

const archetypes = new Map<string, number>();
const laws = new Map<string, number>();
let maxDrawCalls = 0;
let maxInstances = 0;
let maxStructures = 0;
let maxParticles = 0;
let minTeleportPoints = Number.POSITIVE_INFINITY;

for (const { plan, audit } of readiness) {
  archetypes.set(plan.archetype, (archetypes.get(plan.archetype) ?? 0) + 1);
  laws.set(plan.law, (laws.get(plan.law) ?? 0) + 1);
  maxDrawCalls = Math.max(maxDrawCalls, plan.diagnostics.estimatedDrawCalls);
  maxInstances = Math.max(maxInstances, plan.diagnostics.instanceCount);
  maxStructures = Math.max(maxStructures, plan.diagnostics.structureCount);
  maxParticles = Math.max(maxParticles, plan.atmosphere.particleCount);
  minTeleportPoints = Math.min(minTeleportPoints, audit.teleportPointCount);
}

const desktopReady = readiness.filter(({ audit }) => audit.desktopReady).length;
const xrReady = readiness.filter(({ audit }) => audit.xrReady).length;

console.log(`World Loom audit: ${plans.length} worlds compiled`);
console.log(`Desktop-ready worlds: ${desktopReady}/${plans.length}`);
console.log(`Strict XR-ready worlds: ${xrReady}/${plans.length}`);
console.log(`XR blockers: ${xrBlockers.length}`);
console.log(`Minimum valid teleport points in any world: ${Number.isFinite(minTeleportPoints) ? minTeleportPoints : 0}`);
console.log(`Maximum estimated draw calls: ${maxDrawCalls}`);
console.log(`Maximum instances: ${maxInstances}`);
console.log(`Maximum structures: ${maxStructures}`);
console.log(`Maximum particles: ${maxParticles}`);
console.log('Archetypes:', Object.fromEntries([...archetypes.entries()].sort((a, b) => a[0].localeCompare(b[0]))));
console.log('World laws:', Object.fromEntries([...laws.entries()].sort((a, b) => a[0].localeCompare(b[0]))));

if (warnings.length > 0) {
  console.warn(`World Loom compiler warnings: ${warnings.length}`);
  for (const warning of warnings.slice(0, 20)) console.warn(`  W${String(warning.index).padStart(3, '0')} ${warning.code}: ${warning.message}`);
  if (warnings.length > 20) console.warn(`  ... ${warnings.length - 20} additional warnings omitted`);
}

if (xrBlockers.length > 0) {
  console.warn('WebXR stays feature-gated until the strict runtime audit reaches 900/900. Representative blockers:');
  for (const failure of xrBlockers.slice(0, 30)) console.warn(`  W${String(failure.index).padStart(3, '0')} ${failure.code}: ${failure.message}`);
  if (xrBlockers.length > 30) console.warn(`  ... ${xrBlockers.length - 30} additional XR blockers omitted`);
}

if (plans.length !== 900) {
  throw new Error(`World Loom corpus invariant failed: expected 900 worlds, got ${plans.length}`);
}

if (failures.length > 0) {
  for (const failure of failures.slice(0, 40)) console.error(`  W${String(failure.index).padStart(3, '0')} ${failure.code}: ${failure.message}`);
  throw new Error(`World Loom desktop validation failed for ${failures.length} generated world constraint(s).`);
}

console.log('World Loom desktop validation passed. WebXR readiness is reported separately and cannot silently inherit desktop-safe status.');
