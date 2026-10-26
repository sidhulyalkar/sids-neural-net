# Shasta commands and coastal garden

Base: `integration/world-marine-waterfall-20261025` at `05fcd03d`.

- Shasta Go starts bounded roaming and nearby squirrel pursuit. Come cancels the target and latches follow mode until another Go. Chases have an eight-second deadline and a player-distance leash; dry-route sampling rejects water crossings and abrupt terrain changes. Existing acceleration, obstacle avoidance, grounded gait, fetch, shore waiting and cave behavior remain in use.
- Minigames, water, cave transitions and snow play cancel independent outings. Travel resets the outing. No stale command resumes after these interruptions.
- Decorative mountain silhouettes move 55 world units south, beyond the southern aquatic extent. Their conservative 30-unit footprint ends at z=-175 or farther, clearing the z=-166 channel boundary. Playable mountain terrain is unchanged.
- Sea stacks and arch legs extend below sampled seabed heights. All 7,182 above-water vertices were compared with the base geometry and remain identical. Arch openings and racing routes are unchanged.
- The Wild Coast shelf gains a named coral garden at (-69,57): 62 branching/table/fan corals, 12 anemones, 9 sea stars, 8 boulders and 40 fish. Placement uses existing seeded instances and depth checks.

## Validation

- Full suite: 1,099 / 1,099 passing.
- TypeScript, changed-file ESLint, production build and diff whitespace checks pass.
- Chromium production smoke test: Go entered an outing and moved Shasta; Come returned him to follow mode with no wildlife target and no browser errors. Observed accumulated travel: 17.586 on the outing and 30.475 after reunion.
- Pure command tests cover default follow, repeated recall, no-prey roaming, rejected routes, chase timeout, removed prey, leash return, game interruptions, and convergence at 10/30/60 Hz.
- Geometry tests check buried feet, open arches, navigable jet-ski routes and every deterministic habitat placement.

Run the browser check with an installed Playwright browser and a running production server:

```sh
PLAYWRIGHT_MODULE_ROOT=/path/to/node_modules/playwright \
WORLD_BASE_URL=http://127.0.0.1:3000 \
node scripts/playtest-shasta-commands.mjs
```

The browser smoke verifies companion controls. The new underwater scenery is geometry-tested; a complete visual swim-through on the deployed site remains outstanding. No production deployment is included in this change.

## Nearshore expansion follow-up

Four additional named neighborhoods bring the east/west total to 15:

| Region | Center (x,z) | Features |
| --- | --- | --- |
| Kelp Nursery | -49,80 | Kelp, anemones, sea stars, crabs and schooling fish |
| Anemone Cove | -49,-76 | Rocky shelves, fans, lobsters and nudibranchs |
| Shallow Coral Lagoon | 73,76 | Branching/table corals, clownfish and sandy gaps |
| Southern Reef Garden | 73,-73 | Sea fans, branching coral, angelfish and baitfish |

The four areas add 282 decorative/animal instances with the existing 18 draw calls per active coast. Each center is less than 19 world units from shore, has more than 1.5 units of usable dive depth, and has a sampled uninterrupted water approach. Existing placements retain their ID-based seeds.

Validation: full suite 1,100/1,100 passing; TypeScript, changed-file lint and whitespace checks pass. All habitat geometry instantiates successfully. Visual browser swimming through these four new regions has not yet been performed. Changes remain local; the earlier push was blocked by automatic approval review.

## Northeast sandbars and log response

Added four northeast lagoon neighborhoods: Whipray Sandbar (68,50), Blacktip Channel (84,61), Baby Turtle Meadow (69,94), and Giant Clam Garden (86,89). Their shared floor model blends into the existing seabed at depths of 1.85–2.8 world units. Procedural, antialiased sand-ripple pigment is applied to the actual terrain material. No overlaid sand sheet is introduced.

New instanced shapes include seven juvenile turtles, seven whiprays, three blacktips, fifteen giant clams (three with pearls), and low seagrass. Plants stay around the bank edges. Pearls are discovered by approaching them underwater; each counts once per world session. The clams remain intact. These are stylized game habitats, not a surveyed reproduction of Moorea. Moorea inspiration: https://www.snorkeling-report.com/spot/snorkeling-sharks-sandbank-moorea/ .

Log changes separate the board's drawn heading from actual velocity. A low-speed wall reversal rolls fakie instead of snapping the character 180 degrees. The wheel fit uses the drawn frame, launch/exit velocity uses movement direction, grounded contact suppresses lingering board trick rotations, and landing transitions retain the appropriate orientation.

Validation: 1,104 tests passed before final landing/HUD refinements; all 34 focused log/sandbar/marine tests passed afterward. TypeScript and changed-file lint pass. A clean production build passed after clearing stale generated Next cache. Two Chromium attempts closed before the playable scene initialized, leaving live visual confirmation of the new shader, habitats and log movement outstanding. Nothing in this update has been pushed or deployed.
