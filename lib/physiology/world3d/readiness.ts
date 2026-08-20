import { WORLD3D_STANDARDS } from './standards';
import { buildWorldNavigationGeometry, hasPlayerClearance, structureBlocksPlayer, validTeleportPoints } from './navigation';
import type { World3DPlan, World3DValidationIssue } from './types';

export type WorldLoomReadiness = {
  desktopReady: boolean;
  xrReady: boolean;
  blockers: World3DValidationIssue[];
  warnings: World3DValidationIssue[];
  corridorCount: number;
  teleportPointCount: number;
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
  const blockers = plan.diagnostics.issues.filter((issue) => issue.severity === 'error');
  const warnings = plan.diagnostics.issues.filter((issue) => issue.severity === 'warning');
  const spawn = plan.anchors.find((anchor) => anchor.role === 'spawn');

  if (!spawn) {
    blockers.push({ severity: 'error', code: 'xr-missing-spawn', message: 'XR runtime requires an explicit spawn anchor.' });
  } else {
    for (const structure of plan.structures) {
      if (!structureBlocksPlayer(structure) || structure.id === 'landmark') continue;
      if (!hasPlayerClearance({ ...plan, structures: [structure] }, spawn.position, WORLD3D_STANDARDS.spawnClearRadius)) {
        blockers.push({ severity: 'error', code: 'xr-spawn-clearance', message: `Blocking structure ${structure.id} intersects the XR spawn exclusion zone.` });
      }
    }
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
  if (navigation.corridors.length > 0 && teleportPoints.length < navigation.corridors.length * 2) {
    blockers.push({ severity: 'error', code: 'xr-teleport-coverage', message: 'Navigation graph does not expose enough collision-free teleport targets.' });
  }

  const uniqueBlockers = uniqueIssues(blockers);
  return {
    desktopReady: plan.diagnostics.issues.every((issue) => issue.severity !== 'error'),
    xrReady: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    warnings: uniqueIssues(warnings),
    corridorCount: navigation.corridors.length,
    teleportPointCount: teleportPoints.length,
  };
}
