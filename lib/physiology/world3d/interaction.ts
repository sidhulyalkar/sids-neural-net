import type { Vec3, World3DInteraction, World3DPlan } from './types';

export type InteractionAffordance = {
  interaction: World3DInteraction;
  position: Vec3;
  distance: number;
  available: boolean;
};

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

export function interactionAffordances(plan: World3DPlan, playerPosition: Vec3): InteractionAffordance[] {
  const anchors = new Map(plan.anchors.map((anchor) => [anchor.id, anchor]));
  return plan.interactions
    .map((interaction) => {
      const anchor = anchors.get(interaction.targetAnchorId);
      if (!anchor) return null;
      const d = distance(playerPosition, anchor.position);
      return {
        interaction,
        position: anchor.position,
        distance: d,
        available: d <= interaction.radius,
      };
    })
    .filter((entry): entry is InteractionAffordance => Boolean(entry))
    .sort((a, b) => a.distance - b.distance);
}

export function nearestInteraction(plan: World3DPlan, playerPosition: Vec3): InteractionAffordance | null {
  return interactionAffordances(plan, playerPosition)[0] ?? null;
}
