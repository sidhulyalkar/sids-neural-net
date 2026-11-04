# Granite Ridge: Alpine Terrain Park, Blue-Ice Cave, and Old-Growth Forest

Status: **experimental branch only**, not production. One connected first slice has
analytic terrain, corresponding meshes, rail/kicker collision hooks, two portal
shortcuts, and unit tests. This is **not** a claim of browser acceptance or a
complete snow-sport simulation.

## 1. Overall spatial plan

The world has limited horizontal extent and already contains research/photo
museums, the arcade cavern, mountain jump, original ski bowl, Joshua climbing,
redwood skate loop, and coast. We must preserve them. Distances below are
*stylized world units*, not measured mountain dimensions.

| Sector | Coordinates (x, z) | Character | Gameplay |
|---|---|---|---|
| Mountain hub | about (8, -54) | Snow launch and ridge views | Existing skiing, Big Air, boulder |
| Groomed halfpipe | x -24, z -84..-66 | West alpine shoulder, downhill toward the glacier | Ski/board traverse and carves |
| Technical rail corridor | x -15..-10, z -79..-64 | Serpent rail, rainbow rail, wide box | Real connected rails and 50-50s |
| Snow kicker line | (-24,-79.2), (-15,-72.5) | Two large snow lips with downhill runout | Authored jump impulses |
| Glacier cross-passage | x -15..7, z about -81 | Blue, ribbed, open-ended ice vault | Continuous west/east skiing |
| Old-growth forest margin | South meadow and north Grove margins | Distinct mature sequoias | Slalom and photographic framing |

Design **continuous approach → feature → landing → runout → choice**, with
independent line entry: nothing is a mandatory scripted ride.

## 2. Visual hierarchy and aesthetic rules

**Placement correction:** The initial east-slope design at x≈29 intersected
Joshua’s existing dirt-bike loop at x≈27, z -57..-10. The authored terrain
park is moved to the west alpine shoulder, away from that protected ride route,
Big Air and the museum shafts. The halfpipe is explicitly ridden southward
(-Z) down the mountain; its runout feeds the west glacier approach.

Use real terrain relief for the halfpipe and snow jumps. The snow should have
sharp sculpted lips where useful, continuous bank transitions at rideable
surfaces, and a visible downhill receiving slope. Pale snow and cold blue ice
contrast with exposed slate/granite ribs, occasional dark timber, and old-growth
redwood trunks. Keep bright sponsor-style billboards out of the scene. Color
coding should come from material, not UI overlays.

- **Halfpipe**: a longitudinal natural grade with a flatter middle and two
  C1-banked sides. A low, quiet snow coping line is more appropriate than
  shiny skate-style chrome. Preserve a roll-in at either end.
- **Rails**: curved serpent, gently rising rainbow and wide flat box. Render
  shared, sampled control points. Use visible posts where supported and
  short gaps only when the physics solver explicitly permits transfers.
- **Jumps**: roll-through entry, identifiable takeoff edge, adequate landing,
  and escape path. No floating square wooden slabs in alpine snow.
- **Glacier cave**: translucent blue ice vault, scalloped ribs, subtle streaks
  and the bright exterior visible from either opening. Do not close either end
  with a painted false doorway. Prevent camera obstruction and roof clipping.
- **Mountain face**: irregular rock ledges, snow-filled gullies, cornice-like
  shoulders, and occasional ice wedges outside traversable lanes. Reserve
  smooth snow lines for sports.
- **Sequoias**: expand peripheral old-growth stands to create scale and
  meaningful trail edges. Keep trunks out of open runouts, photo discoveries,
  and the original hollow-log routes.

Inspiration from the provided images: competition snowpark scale and shared
sightlines, natural ice towers/powder, aerial ski feature progression, and blue
ice tunnels. All imagery is *reference only*: no source photograph is bundled,
copied, or turned into a texture.

## 3. Geometry, contact, and motion contract

### One source of truth for support surfaces

`lib/world/alpineTerrainPark.ts` owns feature footprints, route coordinates,
height profiles, rail chains and clearance. `model.terrainHeight` applies
sculpted halfpipe and glacier-cut height to the existing mountain. The scene
samples it at locally higher resolution, and `groundHeight` adds the tapered
rideable box deck and existing authored ramp support.

Invariant: at sample point p, visual snow skin Y ~= `terrainHeight(p)`, and
moving support Y = `groundHeight(p)`. Avoid separate negative holes,
floating slabs, hidden floor colliders or invisible transverse walls.

### The halfpipe

First slice uses a continuous analytic bank. A full next-phase halfpipe
solver should reuse the hollow-log's **surface tangent / lateral gravity /
wheel-or-ski contact** ideas, without forcing a preset path:

1. Track longitudinal velocity `vAlong` and lateral velocity `vAcross`.
2. Sample `height(x,z)`, derivatives and the bank normal; integrate gravity
   projected onto the banking.
3. Preserve momentum while carving; let wall drag and edge pressure vary
   with yaw/edge angle. Do not invent unlimited speed or hard-clamp the player.
4. Support ski mode, skateboard and bike only with appropriate controls and
   plausible contact; launch/land input is independent of geometry.
5. Detect an actual outward lip crossing with sufficient speed for an
   optional air event. Skipping a wall or landing outside the runout must
   never score as a completed transfer.
6. Substep at up to 50 ms for ordinary movement, and 8 ms for high-curvature
   or airborne contacts; cap wall-clock catch-up.
7. Use the same surface normal for rendered lean, wheel/contact and camera.

### Curved rails and boxes

Reuse `SKATE_PARK_RAILS`, `advanceRailChain`, `nearestGrind`,
`grindStyleForApproach` and existing rail elevation interpolation. No new
magnetic rail system. Wide boxes have a low tapered contact deck; the
segmented rail spine provides grind progression. Reverse entry and
disengagement must retain the same behavior as existing rails.

### Glacier tunnel

The sculpted terrain makes the tunnel floor physical. A dedicated translucent
ice vault follows the floor and keeps both mouths open. Unit QA requires
continuous forward and reverse traversal. Airborne riders must be clipped to
an actual ceiling; grounded riders remain on the snow support. A later browser
gate should test camera occlusion, max clearance, fall recovery, visual
flicker, side-wall collision, and both entrances. A physically complete
cave needs wall-surface collision and longitudinal roof-contact behavior
beyond the first slice.

## 4. Placement algorithm for future features

1. Collect immutable footprints: traversable sea, museums, portals, photos,
   wildlife habitats, sport routes, trees, and ride-recovery anchors.
2. Score candidate slopes by local grade, downhill bearing, runout length,
   sightline and safe landings; use seeded terrain to avoid nondeterminism.
3. Reserve a feature envelope that includes approach, artifact, launch,
   landing and recovery. Reject intersection with protected destinations.
4. Cluster features into distinct difficulty lines, rather than scatter them
   uniformly. Maintain a basic/no-jump escape line for every cluster.
5. Feed approved coordinates to geometry, terrain, controls, tree placement
   and browser acceptance from a single manifest.
6. Reject visually floating or inaccessible features during automated audit.

## 5. Progressive delivery and release gates

**Phase A: initial authored slice, current feature branch**

- [x] Halfpipe terrain shape and finely sampled visible snow.
- [x] Glacier-cut terrain and open blue-ice shell.
- [x] Curved serpent/rainbow rails and freestyle box in existing rail system.
- [x] Two authored alpine jump impulses and terrain-following takeoffs.
- [x] Sequoia infill outside protected sport and disc-golf envelopes.
- [x] Two explicit accessible sport shortcuts.
- [x] Deterministic pure geometry and traversal tests.
- [ ] Typecheck, lint, build and complete world regression on same commit.
- [ ] Browser playtests at both cave portals and halfpipe ski runs.
- [ ] Visual screenshots on desktop and mobile; human review of ice clipping.
- [ ] Performance budget with actual FPS/draw-call evidence.

**Phase B: physically expressive freestyle**

- [ ] Curvature-driven pumping/edge pressure, speed gain/loss, and lip airtime.
- [ ] Rail transitions, switch riding, accurate jump/fall recovery, transfers.
- [ ] Native wall rides and staggered jib obstacles with collision-aware edges.
- [ ] Explicit difficulty route markers (easy, flow, advanced) and guided
  optional entry without obstructing free exploration.

**Phase C: mountain detail and optimization**

- [ ] Additional skyline spires and realistic wind-deposited cornices with
  analytically bounded terrain perturbations.
- [ ] Glacier ceiling/wall full contact, camera visibility and reduced-motion.
- [ ] Sequoia trunks/crowns with age-dependent geometry; density control.
- [ ] Occupancy and per-route automatic obstacle/sightline audit.
- [ ] Dedicated low-end mobile screenshots, GPU memory and frame-times.

Quality targets to measure, **not asserted as reached**: 60 FPS typical
desktop / 30 FPS mobile, no missing image requests, no camera through an ice
wall, no unsupported midair landings, and no regressions in the redwood loop,
existing museums, marine reefs, Shasta, game arcade or beach sports.

## 6. Release isolation

This feature branch is based on the **draft World PR #142** head and should
target that branch in its own draft PR. It **must not** be merged into #142
while the existing World release is frozen or red. Keep security PR #149
independently gated. Merge and deployment require full same-head CI plus
reviewed screenshots; code presence alone does not qualify the terrain park.
