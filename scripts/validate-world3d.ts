import { NATURE_WORLDS } from '../lib/physiology/natureWorldsExpanded';
import { compileWorld3D } from '../lib/physiology/world3d/compileWorld3D';

const plans = NATURE_WORLDS.map(compileWorld3D);
const failures = plans.flatMap((plan) =>
  plan.diagnostics.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => ({ world: plan.worldId, index: plan.worldIndex, code: issue.code, message: issue.message }))
);
const warnings = plans.flatMap((plan) =>
  plan.diagnostics.issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => ({ world: plan.worldId, index: plan.worldIndex, code: issue.code, message: issue.message }))
);

const archetypes = new Map<string, number>();
const laws = new Map<string, number>();
let maxDrawCalls = 0;
let maxInstances = 0;
let maxStructures = 0;
let maxParticles = 0;

for (const plan of plans) {
  archetypes.set(plan.archetype, (archetypes.get(plan.archetype) ?? 0) + 1);
  laws.set(plan.law, (laws.get(plan.law) ?? 0) + 1);
  maxDrawCalls = Math.max(maxDrawCalls, plan.diagnostics.estimatedDrawCalls);
  maxInstances = Math.max(maxInstances, plan.diagnostics.instanceCount);
  maxStructures = Math.max(maxStructures, plan.diagnostics.structureCount);
  maxParticles = Math.max(maxParticles, plan.atmosphere.particleCount);
}

console.log(`World Loom audit: ${plans.length} worlds compiled`);
console.log(`XR-safe worlds: ${plans.filter((plan) => plan.diagnostics.xrSafe).length}/${plans.length}`);
console.log(`Maximum estimated draw calls: ${maxDrawCalls}`);
console.log(`Maximum instances: ${maxInstances}`);
console.log(`Maximum structures: ${maxStructures}`);
console.log(`Maximum particles: ${maxParticles}`);
console.log('Archetypes:', Object.fromEntries([...archetypes.entries()].sort((a, b) => a[0].localeCompare(b[0]))));
console.log('World laws:', Object.fromEntries([...laws.entries()].sort((a, b) => a[0].localeCompare(b[0]))));

if (warnings.length > 0) {
  console.warn(`World Loom warnings: ${warnings.length}`);
  for (const warning of warnings.slice(0, 20)) console.warn(`  W${String(warning.index).padStart(3, '0')} ${warning.code}: ${warning.message}`);
  if (warnings.length > 20) console.warn(`  … ${warnings.length - 20} additional warnings omitted`);
}

if (plans.length !== 900) {
  throw new Error(`World Loom corpus invariant failed: expected 900 worlds, got ${plans.length}`);
}

if (failures.length > 0) {
  for (const failure of failures.slice(0, 40)) console.error(`  W${String(failure.index).padStart(3, '0')} ${failure.code}: ${failure.message}`);
  throw new Error(`World Loom validation failed for ${failures.length} generated world constraint(s).`);
}

console.log('World Loom validation passed.');