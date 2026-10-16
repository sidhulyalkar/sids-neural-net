import { WORLD3D_STANDARDS } from './standards';
import { buildWorldNavigationGeometry, findSafeSpawnPosition, validTeleportPoints } from './navigation';
import type { Vec3, World3DPlan, World3DValidationIssue } from './types';

export type WorldLoomReadiness = {
  desktopReady: boolean;
  xrReady: boolean;
  blockers: World3DValidationIssue[];
  warnings: World3DValidationIssue[];
  corridorCount: number;
  teleportPointCount: number;
  safeSpawnPosition: Vec3 | null;
};

function uniqueIssues(issues: World3DValidationIssue[]): World3DValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function auditWorldLoomReadiness(plan: World3DPlan): WorldLoomReadiness {
  const blockers = [...plan.diagnostics.issues.filter((issue) => issue.severity === 'error')];
  const warnings = [...plan.diagnostics.issues.filter((issue) => issue.severity === 'warning')];
  const spawn = plan.anchors.find((anchor) => anchor.role === 'spawn');
  const safeSpawnPosition = findSafeSpawnPosition(plan, WORLD3D_STANDARDS.spawnClearRadius);

  if (!spawn) {
    blockers.push({ severity: 'error', code: 'xr-missing-spawn', message: 'XR runtime requires an explicit spawn anchor.' });
  } else if (!safeSpawnPosition) {
    blockers.push({ severity: 'error', code: 'xr-spawn-clearance', message: 'No collision-free XR local-floor station exists near the authored spawn.' });
  } else if (
    safeSpawnPosition[0] !== spawn.position[0] ||
    safeSpawnPosition[1] !== spawn.position[1] ||
    safeSpawnPosition[2] !== spawn.position[2]
  ) {
    warnings.push({ severity: 'warning', code: 'xr-spawn-relocated', message: 'XR runtime uses a deterministic collision-free local-floor station adjacent to the authored spawn.' });
  }

  const navigation = buildWorldNavigationGeometry(plan);
  for (const corridor of navigation.corridors) {
    if (corridor.connection.kind !== 'portal' && corridor.slopeDegrees > WORLD3D_STANDARDS.maximumWalkSlopeDegrees) {
      blockers.push({ severity: 'error', code: 'xr-route-slope', message: `Connection ${corridor.connection.id} has ${corridor.slopeDegrees.toFixed(1)}° slope.` });
    }
    if (corridor.connection.width < WORLD3D_STANDARDS.minimumWalkableWidth) {
      blockers.push({ severity: 'error', code: 'xr-route-width', message: `Connection ${corridor.connection.id} is too narrow for XR locomotion.` });
    }
  }

  const teleportPoints = validTeleportPoints(plan);
  const coverage = new Map<string, number>();
  for (const point of teleportPoints) coverage.set(point.connectionId, (coverage.get(point.connectionId) ?? 0) + 1);
  for (const corridor of navigation.corridors) {
    if ((coverage.get(corridor.connection.id) ?? 0) < 2) {
      blockers.push({
        severity: 'error',
        code: 'xr-teleport-coverage',
        message: `Connection ${corridor.connection.id} does not expose two collision-free teleport targets across its walkable lanes.`,
      });
    }
  }

  const uniqueBlockers = uniqueIssues(blockers);
  return {
    desktopReady: plan.diagnostics.issues.every((issue) => issue.severity !== 'error'),
    xrReady: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    warnings: uniqueIssues(warnings),
    corridorCount: navigation.corridors.length,
    teleportPointCount: teleportPoints.length,
    safeSpawnPosition,
  };
}
