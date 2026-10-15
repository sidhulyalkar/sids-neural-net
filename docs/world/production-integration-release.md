# Sid's World: integrated release candidate (PR #91 + PR #94)

**Scope:** one Sid's World codebase containing the north-shore skimboarding beach,
redwood skate grove, jet-ski race, Joshua ghost race, disc golf and existing
island attractions. **Status: production-build qualified, not live-deployed.**

## Source ancestry and publication

- Beach source: `feat/sids-world`, PR #91 at `acc13cfbbfc06995b570a9696dbc9d0c6c8e5181`.
- Redwood skate grove/jet-ski source: `feat/island-jetski-dock-race-v1`,
  PR #94 at `b9e251dc8f9b8e3f6903b935e0714c83a39843cb`.
- Reviewed two-parent merge: `0818701c2c10efa891f87f872ecf4418a5a30c1e`
  on `feat/pr94-world-integration-candidate`.
- Integration evidence: [reviewed workflow run](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/38666035155).
- This branch adds the *exact reviewed merged* World regression workflow and the
  skimboarding browser QA workflow in a separate authorized commit: GitHub
  Actions is forbidden to publish workflow file changes via its own token.

## Shared island contracts

The Redwood Skate Grove remains a walkable skatepark at x=-20..8, z=28..52.
The surf coast lies near z=66 at x=0, so beach water cannot flood the
south-meadow bowls. A consistent shoreline drives sand blending, board pickups,
shoaling surf, shallow marine life, and water classification. A genuine
offshore route retains the two jet-ski arches and buoys. Fast travel resets
incompatible minigames, and skating and skimming share a single avatar,
camera, travel, obstacle field and lifecycle.

Skimboarding uses 90-second heats, a three-board pickup display,
Q/E/F airborne tricks, wave contact, a planing pose, wake foam and sandy
shallows. The grove has timber quarterpipes, rails, a hollow redwood bowl,
assisted Space tricks, flicks, manuals, grinds and scoring. None of these
are separate embedded applications.

## Verified acceptance

The reviewed merged-tree GitHub Action completed `npm ci`,
`npm run typecheck`, `npm run build`, the skate/skim contracts and
all World unit tests. Browser QA passed north shore skimboarding, redwood
bowl W/A/S/Space return, skatepark assisted combos, Joshua ghost/target,
and jet-ski race plus touch controls. Evidence/screenshots are stored
in that run's artifact.

## Release gates still required

1. Re-run World regression and skim browser QA on this published commit.
2. Verify an actual Vercel preview deployment for this branch.
3. Review viewport screenshots, especially the northern natural-bridge sea
   stack sightline and board-on-wave contact; do not hide collidable arches.
4. Confirm the wider Website CI status, security/dependency gates, mobile
   input, and overall island performance before production deployment.
5. Merge to the protected primary branch only after review. Neither source
   PR #91 nor #94 is overwritten by this integration.
