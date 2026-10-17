# Astra World Puzzle Trilogy: Experience-First Design Contract

**Status: REFINED DESIGN PROPOSAL, NOT IMPLEMENTED OR VISUALLY APPROVED.** 2026-10-10. Detailed planning reference for Granite Counterweight, Deadwood Bridge and Rainforest Light only. Supersedes the earlier one-row descriptions of these puzzles in [World Challenges v1](astra-world-challenges-v1-spec.md). Existing biome, cave, waterfall, ecology, terrain-contact and website requirements remain unchanged.

## 0. What are we designing for?

A first-time visitor to the island is not here to grind challenges. They should naturally notice a peculiar rock, a fallen crossing, or a shaft of light, approach it out of curiosity, understand its rules by watching something respond, and discover a small, meaningful new way to see the landscape. A visitor who dislikes puzzles should walk straight past without losing access to any project, article, game, photograph or navigation route.

**Shared design thesis: three puzzles, three different verbs.**

| Puzzle | Core idea | Primary verb | Aha moment | Spatial payoff |
| --- | --- | --- | --- | --- |
| The Balanced Ridge / Granite Counterweight | Leverage and mass | Arrange | A small stone far from the fulcrum can balance a larger weight nearby | Granite slab settles into a new optional crossing to a ridge view |
| The Nurse Log / Deadwood Bridge | Structural support and balance | Brace, then traverse | An unstable log is manageable either through careful skill or by wedging a branch under it | A steady or deliberately challenging route above the fern gully |
| The Canopy Window / Rainforest Light | Occlusion, viewpoint and noticing change | Reveal | Shifting foliage changes where dappled light falls and makes a hidden path legible | An optional elevated view of the rainforest canopy |

**Do not make the three challenges**: find three generic switches; move a rock three times; collect glowing keys; reproduce Zelda shrine iconography; fabricate magic mirrors in the forest; reward with loot boxes, coins or intrusive celebratory overlays; put the website behind completion; force an animal to act as a tool.

Every challenge should communicate **what is physically strange** at a glance, provide consequential feedback in under 300 ms after an interaction, have an obvious reset, and keep a safe, visible bypass.

## 1. Visitor experience / rules that apply to all three

### First contact (0 to 15 seconds)
- From a normal walking/riding approach, the *silhouette* should read before any text: tilted stone balance, unsupported fallen trunk, or patterned light under broad foliage.
- No icons floating above canopies, huge particle columns or spoken exposition. The existing near-object discovery affordance may show a compact label such as **"Inspect the balance"**, **"Steady the log"**, or **"Part the leaves"** only within an honest near range.
- The default free-exploration camera must show the **problem and the likely route forward together** in at least one plausible standing position. A surprise that only appears after clicking a menu is a failure.
- Familiar wildlife, Shasta, existing project markers and authentic photographic destinations are background to the experience, never artificial puzzle switches.

### Touching the world (15 to 60 seconds)
- The first input must produce an immediate, proportional response: the slab tilts, the log settles, or sunlight shifts along a mossy surface.
- Allow intermediate states. Do not jump straight from "off" to "solved" with a chime and no visible cause.
- One visible manipulation at a time. No inventory, crafting, physics-gun reticle or abstract numeric HUD.
- A player can undo the last action and reset the mechanism; leaving and returning must not softlock it.
- No timed puzzles, punishments, enemies or involuntary teleports.

### Solving (roughly 60 to 180 seconds for an attentive new visitor)
- **At least two physically and visually different solutions** with the same legitimate result, or one direct solution and a genuine skill-based alternate crossing. A harmless bypass is always available as a third option.
- Celebrate through the environment: surface settling, branch creak, shifting sun flecks and a widened view. A subtle one-line "You found the ridge crossing" is optional and dismissible.
- Once solved, the local mechanism can remain in its solved state for that session. Restoring the original arrangement must be a single deliberate action, not a site reload.
- No permanent gate. If a visitor takes the alternative trail, they may still enjoy the same nearby view, just via a longer path.

### If the visitor gets stuck
- 0 to 30 seconds: no hints; let the physics teach.
- After meaningful unsuccessful attempts or an explicit Help action: one observational clue. Examples: "The outer notch has a longer lever arm", "The fork below the log might stabilize it", "Moving the frond changes the shadows below."
- A second optional hint explains what to examine, not an exact click sequence. A final accessibility-oriented "Show an example" may visualize one valid arrangement and remains optional.
- Reduce-motion makes results immediate with static state cues; it does **not** disable or auto-solve the puzzle.
- Color is never the only signifier. Use shape, angle, movement, hatching and text when needed.

### Interface/control rule
- Reuse existing **Enter** for near-object discovery. Existing **Space** action is already jump/grind/climb and must not be hijacked globally; **WASD** is movement, and pointer drag currently orbits the camera.
- On Enter/Tap "Inspect", enter a bounded **local puzzle focus** with a gentle camera shift, an accessible label and visible Left/Right/Confirm or Move/Rotate controls. Only in puzzle focus do arrow keys adjust selected objects. **Esc/Back closes focus** and restores walking/orbit authority and focus correctly.
- Clicking an object from far away should move toward it via the existing safe destination logic, **not** operate it remotely. No interaction while skiing past at speed or airborne. Exiting focus should never teleport the explorer or erase unrelated game progress.
- On a phone, provide minimum 44px controls and the same functionality without precise 3D dragging. Optional drag gestures enhance desktop manipulation but are not the sole input.
- A screen reader receives a brief state phrase and reachable buttons without repeatedly announcing every animation frame.

## 2. Granite Counterweight: THE BALANCED RIDGE

### Player-facing scene

A flat, long weathered granite slab rests diagonally on a rounded natural pivot. One end hangs above a **small dry notch** while the opposite end is weighed down by a fused stone mass. The slab does not look machined; natural fractures, lichen and two small worn depressions on its free end imply where loose stones could sit. Four loose rocks sit by a shallow sloping chute. Beyond the notch, a slightly higher quiet viewpoint is visible.

The user thinks: **"That slab looks almost like it could settle flat. What would change its balance?"** No instructions are needed before that thought.

### Mechanic: torque, not arbitrary socket matching

Author a simplified, deterministic balance rule `moment = massClass × leverArm`. It is a stylized mechanical puzzle, not a claim of real rock density or structural engineering. Use:
- One fixed opposing moment of 6 units; visible as the slab's fused heavy end.
- One near depression (lever arm 1), sized for two small stones; one far depression (lever arm 2), sized for one medium or one larger stone.
- Loose stones with relative visible mass classes `[1,1,2,3]`; rocks of mass 3 are visibly largest. Light stones are moved with a short step and ease, not free rigid-body simulations.
- **Solution A:** large 3-unit stone in far depression -> 6 units.
- **Solution B:** medium 2-unit stone in far depression (4) + both small 1-unit stones in near depression (2) -> 6 units.
- Other arrangements yield smooth intermediate tilt proportional to moment difference. Too many stones cannot fit the same depression; mismatched stones do not silently clip through each other.
- `abs(6 - currentMoment) < 0.35` settles slab to a traversable support height after a brief stable interval, e.g. 0.6s. It may be nudged off balance again and restored. The near and far positions actually differ in their leverage, and the art makes that intelligible.

**Actions**: approach a loose stone -> inspect its physically distinct size -> choose **Nudge to near** or **Nudge to far** if that notch fits -> watch it roll a short preauthored channel and see the slab react. A stone can be removed/undone. Manual pointer dragging is optional, with exactly the same final mechanism state.

**Feedback**: the slab angle visibly interpolates; pebbles slide a small amount toward the pivot; settling has a muted stone scrape, slight dust only if effects enabled. No glowing green solved line. The crossing becomes physically level and supports the player.

**Alternate route**: a slightly longer natural footpath around the dry notch. Solving reveals a graceful direct ridge traverse, not exclusive access to /projects.

**Spatial reward**: from the optional ridge platform, see the bike terrain and alpine mountain in one view. A small naturally placed **Projects** link may appear at the overlook, using the real existing /projects route, but the site has always remained reachable elsewhere.

**Placement survey, not coordinates approved**: granite/dry ridge shoulder away from Joshua racing lines and the existing desert climbing holds near x17–18,z-39..-45; do not interfere with the Alpine Big Air run-in/receiving area or Arcade cave. Author precise location only after grade, water, sightline, camera and exclusion check.

**Why this is not another rock-pushing game**: players reason about *distance from the pivot*, not just which slot flashes. Both one-big-stone and multiple-small-stones strategies legitimately solve it, enabling discovery by experimentation.

## 3. Deadwood Bridge: THE NURSE LOG

### Player-facing scene

At a fern-lined shallow **gully**, a substantial fallen redwood is already lodged between its root plate and the opposite bank. It can be crossed, but its top has an uneven, slightly yielding footing. A **smaller snapped branch**, light enough to nudge, lies by a root fork below it. Two natural stone or root notches offer possible ways to wedge that branch.

The visitor sees one stable approach and one uncertain span. The camera reveals both the unsupported section and the reachable supporting branch. The important question is **"Can I cross this now, or can I make it easier?"**

This is *not* dragging an implausibly enormous mature redwood trunk. The main deadwood is fixed. Only the smaller fallen brace moves.

### Mechanic: choose skill or stabilize structure

- Main log stays in the world with authored curved support and walkable collision. Its mild sway is an animation based on lateral movement and support state, never a random knock-off impulse.
- In **unbraced** state, the crossing is deliberately narrow but navigable. Visitor may simply walk/balance over it, taking a skill route.
- Nudge/rotate the small bracing branch between two plausible notches. One arrangement is aligned to the underside of the main log's fork and changes support state to **wedged**, reducing lateral sway and widening the forgiving support lane somewhat (without suddenly raising the player).
- The other notch produces visible but insufficient support: the branch touches a loose root and the main log still wobbles. This is informative failure, not a reset.
- Both **skilled unbraced crossing** and **wedged crossing** count as puzzle discovery. Log remains freely traversable afterward, including when returning to free exploration.
- Optional third path is a longer route around the gully, with the same access to scenic space.
- Falling off is a short ordinary step into safe, walkable ground. Never reset the whole world or throw the camera into the ground.

**Actions**: inspect brace -> angle left/right through a few distinct positions -> choose **Set brace** -> immediate 0.5–1s settlement animation. Then close focus and walk along the natural log using existing locomotion. Skill is meaningful because the narrow unbraced lane benefits from deliberate small steering input, not a separate balance minigame/QTE.

**Feedback**: physically readable branch-to-root contact and reduced log movement, light bark creak, small leaf shake. If the player successfully crosses without stabilizing, a minimal acknowledgement of the alternate technique is appropriate. No timed combo, no achievement overlay.

**Spatial reward**: a small moss-covered platform beyond the crossing gives a calm view through the redwoods and towards the water. A contextual photography link may be offered only if a real photo record is present. The nearby forest remains useful even when the mechanism is ignored.

**Placement survey**: start by examining the already authored `grove-deadwood` scenery log from (-15,29) to (-7,32) and `redwood-easy` / `redwood-narrow` traversals. Reuse/rework an existing log rather than stacking yet another full tree on it. The exact bridge must align with *measured* terrain; if no real watercourse is present, it crosses a dry fern gully, not a fictional stream. Avoid the `fern-nurse` log, Shasta trail memories and redwood primary access.

**Distinct from Granite**: Granite is *weight distribution*. Deadwood is *support geometry plus optional practiced traversal*. It rewards both environmental deduction and controller skill.

## 4. Rainforest Light: THE CANOPY WINDOW

### Player-facing scene

A break in layered rainforest foliage sends a few dappled warm patches onto mossy rock and roots. From the path, the visitor can see two broad **hanging, flexible frond fans** obstruct part of a low sunlit line. A raised natural root step and a partially shaded set of tree roots hint at a higher viewpoint. Small visual changes to light and leaf direction invite experimentation.

The question is **"What becomes visible if I move those leaves, or change where I'm standing?"**

Do **not** use metal mirrors, crystals, magical rays, mechanical light emitters or a day-night-dependent exact solar alignment puzzle. Fronds block light; they do not focus or reflect it.

### Mechanic: two frond occluders and viewpoint

- Two reachable frond clusters pivot over a small authored angle range; each has three clearly different silhouettes/occlusion states. They are living or fallen foliage *temporarily moved aside*, not uprooted or harvested.
- A **fixed local sunlight direction** and a simple projection of leaf silhouettes onto one mossy stone/soil patch create a stable causal relationship between frond angle and shadow shape. The local light reference remains legible independent of unrelated world daylight/fog and on low graphics settings.
- In one configuration, two shaded root ledges become visibly exposed as safe step choices. Solve by moving **both fronds** to clear those ledges.
- **Alternate observational solution:** climb an adjacent reachable root perch and see the same route clearly from above, without manipulating foliage. This uses actual player position/height and look direction, not a second arbitrary switch.
- After discovery, a short, natural path leads to a quiet raised canopy sightline, with existing modeled birds and the photo-inspired sloth remaining ambient.
- Nothing "unlocks" by magic; the canopy was always accessible through the visible longer trail. The puzzle makes an overlooked shortcut legible.

**Actions**: inspect the lower frond -> Left/Right rotate -> see the shadow footprint move in real time -> examine the higher frond or try the root perch -> walk the newly legible route. Two interactions are sufficient once the player sees the relationship.

**Feedback**: displaced shade, slight leaf bend and soft rustle, a widening view to the actual canopy. No beams shooting between reflective objects, no animals compelled to move, no fake blossom growth reward.

**Spatial reward**: an observation ledge framed by leaves with a view back toward the coastline and the real sloth observation vicinity. If the actual sloth photograph is not yet published in the archive, do not imply the picture has been unlocked or display a fabricated image. Any photography link uses existing genuine /photography content.

**Placement survey**: near the rainforest canopy trail and the authored `rainforest-log` x38,z39 -> x45,z42 but keep the sloth observation at (40,43), canopy vipers/boas, tree trunks, other photography markers and main path clear. Do not make a natural rainforest canopy resemble a theme-park puzzle entrance.

**Truthfulness of light**: this is an authored miniature 2D occlusion model represented in 3D, not real-time volumetric sun ray tracing. The same finite geometry should drive frond orientation, projected shade and route visibility. Avoid promises about physically exact global sun/shadow simulation.

## 5. What users see, feel and do: experience checklist

| Moment | Granite | Deadwood | Rainforest |
| --- | --- | --- | --- |
| First distant clue | Awkwardly tilted granite slab and rocks resting in a chute | Unbraced fallen tree spanning a gully | Unusual dappled patches under huge leaves |
| Close-range cue | Stone depressions at different distances from pivot | Smaller broken limb and two root notches | Pivotable foliage and a faint root stair |
| First action | Move one stone | Nudge the brace or try walking out | Turn one frond or climb |
| Immediate reaction | Slab angle changes proportional to placement | Sway changes when support contacts root | Projected shadow footprint visibly moves |
| Thinker's solution | Optimize moment using a long lever | Align a branch to a support fork | Expose both ledges with two leaves |
| Explorer's alternate | Circumvent the notch | Carefully cross unbraced | Use a high root viewpoint |
| Reward | Direct, stable ridge traverse + mountain/desert panorama | Smooth crossing + redwood viewpoint | Overlook with real wildlife silhouettes |
| If they fail | Stone rolls back into channel; can remove/rearrange | Safe gully floor; retry at near end | Reposition foliage; nothing times out |
| If they ignore it | Longer walking route stays available | Normal forest trail stays available | Rainforest route and photo access stay available |

Experience targets (design goals, not performance claims):
- Observe what is unusual without text: 80% of first-time participants within 15s of approaching.
- First action within ~30–45s after spotting the feature.
- First useful cause/effect reaction within one input, immediate and readable.
- Median self-guided solve around 1–3 minutes, optional hint for long stalls. A visitor who skips still explores normally.
- After solving, users can explain the physical principle without recalling a UI tooltip.

## 6. Interaction architecture

### World integration
`lib/world/puzzles.ts` exports a small typed registry with candidate anchor, intended mechanics, verb and area. `lib/world/puzzleState.ts` contains **pure deterministic** reducers for all three puzzle states and helper functions for support/occlusion/torque. `components/world/worldPuzzleGeometry.ts` builds all static per-biome props as `GeometryBatch` and only allocates small moving assemblies for the *nearby active* mechanism. `components/world/WorldPuzzleFocus.tsx` is a bounded interaction panel, not a modal covering the landscape. `worldRenderer.ts` gets a thin input/state/animation adapter, never another giant puzzle-specific frame loop.

Do not add a heavyweight physics dependency or make global `terrainHeight` depend on a React state variable. Runtime moveable beam support can be provided as an explicit **puzzle support resolver**, layered on top of existing `groundHeight` where relevant. Physics and rendering must use the same pose. Use existing `constrainMove` / foot and wheel contact contracts, cave support layer and `sportClearance`.

### Example domain states
```ts
type PuzzleId = "granite-counterweight" | "deadwood-bridge" | "rainforest-light";
type BaseState = { id: PuzzleId; discovered: boolean; solved: boolean; version: 1 };
type GraniteState = BaseState & {
  near: readonly StoneId[];
  far: StoneId | null;
  targetMoment: 6;
};
type DeadwoodState = BaseState & {
  braceNotch: "loose" | "wrong-root" | "support-fork";
  crossed: boolean;
};
type RainforestState = BaseState & {
  lowerFrond: 0 | 1 | 2;
  upperFrond: 0 | 1 | 2;
  observedFromRoot: boolean;
};
```
Implement **explicit occupancy and collision** checks before stone placement, not client UI assumptions. Reject illegal actions with a stable unchanged state. Solve calculations are idempotent and serializable; do not depend on elapsed real time or an uncontrolled random value. The visual transition may take time, but the target state is discrete and deterministic.

### Persistence and controls
- Session-local state by default so each new visit can rediscover the mechanics. Optionally store a separately versioned `discovered` flag for the Field Log, not an irreversible solved pose. Never share timing or record keys with the Joshua lap or Big Air.
- A **Reset mechanism** affordance is available in focused state; reset only nearby props and return focus to its originating control. Resetting one puzzle does not wipe other puzzles or move the player.
- If keyboard control focus changes or a dialog is opened, terminate local focus cleanly, restore player and camera control, preserve a valid stable pose. Pause/visibility cannot continue moving a branch midair.
- The controls work without sound, special camera access, motion sensor, login or touch precision. If the rendering system fails, conventional website navigation is unaffected.
- The player should be allowed to **leave while half-solved**. On return, state is visible and can be continued or reset. No hard progress locks.

## 7. Geometry, visuals and camera budget

- Prefer reuse: nearby already modeled `FALLEN_LOGS`, `BALANCE_BEAMS`, granite formations, tropical understory. Avoid placing an extra full-size decorative dead tree to solve the Deadwood challenge.
- Each scene starts from natural material colors; granite fractures, weathered bark, lichen and leaf translucency should carry the detail. No emissive rune outlines or generic cartoon rewards.
- Static objects per cluster: ideally **one batched mesh**. Moving pieces: **1–3 bounded dynamic objects** for granite slab/stones, brace/log, frond clusters; shared materials, no per-leaf shadow maps.
- Frond shadow projection: one local shader/decals using frond poses; hide or simplify on low-end mobile. Do not rely on global sun, heavy real-time volumetrics or increased shadow-map resolution.
- Update the active puzzle assembly with deterministic easing; all distant puzzle clusters are static and should not add continuous per-frame work.
- Only show puzzle contextual controls near an anchor. When focus begins, ease camera toward a useful close view without crossing existing geometry. On exit, smoothly return the previous orbit and zoom.
- Preserve existing targets: <100 draw calls as worst-combined target, ~70 typical, ~90k visible triangles typical. Profile actual preview; don't claim budgets met before capturing metrics.
- Within a puzzle's footprint, no hostile or infinite collider, unintended bike time-trial shortcut, new wildlife collision or protected waterfall drainage changes. Respect genuine footpaths. Shasta remains nearby as a companion, never blocks or manipulates controls.

## 8. Engineering validation

**P0 survey before coordinates:** measure terrain, height variation, grade, support and water masks, target camera views, collision clearance and other activity routes for three candidate areas. Specifically verify Granite isn't on Joshua gaps/racing or alpine receiving slope; Deadwood isn't a duplicate of `grove-deadwood` and actually spans measured terrain; Rainforest doesn't occlude real sloth/photography encounters. Approve precise anchor and orientation only after survey screenshots.

**Reducer tests:** all states legal, forward/back reversibility, no softlocks after cycling actions, two legitimate routes/solutions per puzzle, deterministic serialize/restore, reset isolation, stable after context loss. For Granite ensure both `3×2` and `2×2 + 1×1 + 1×1` equal opposing torque; physically illegal socket combinations rejected. For Deadwood confirm support and traversal in braced and unbraced modes with no forced falls. For Rainforest confirm light path and root observation each solve without reliance on global clock time or color-only indicators.

**Motion/render tests:** visible moving prop geometry equals support and shade computations. No step-air/world contact snapping when a slab settles; no invisible log floor or hovering explorer; no sun patches passing through solid terrain. Input focus never steals WASD/Space outside puzzle focus. Frame times, memory, GPU allocations and disposal measured after repeated reset/enter/exit.

**Browser user-journey tests:** walk each approach without a waypoint overlay; understand the affordance; interact via keyboard only, mouse and mobile touch; solve via both routes; recover after missteps and leave/reenter; ensure accessible focus, screen-reader status and colorblind cues; run at reduced motion, low graphics, cave visits, rain, skiing, Joshua racing, and when Shasta stands near the prop. 3 screenshots per mechanism: observed problem, first intermediate change, solved view. Record one complete 2-minute unedited walkthrough per puzzle before acceptance.

### Acceptance threshold

A puzzle is accepted only if a visitor can notice it from landscape silhouette, manipulate it without learning new unrelated controls, experience a real local causal reaction, solve it without a walkthrough, and resume ordinary exploration immediately afterward. If a candidate fails that criterion, **simplify or remove it**, even if its code is technically correct.

## 9. Build order and ownership

1. **P0 shared location/camera survey + 3 storyboard mockups**. No new terrain until footprints are approved, with existing cave/waterfall/riding exclusion evidence.
2. **Deadwood vertical slice first.** Reuse existing beam support and deadwood geometry to prove focus UI, reversible local state, traversability, alternate solve, and save/reset hooks at minimal physics complexity.
3. **Granite second.** Implement weight/moment reducer and visible slab support. Start with simplified shapes and polish natural rock rendering only after both independent solution paths pass.
4. **Rainforest third.** Implement local frond occlusion and observational alternate. Treat light rendering as an isolated quality/perf tranche, not a general volumetric world lighting rewrite.
5. **Integration/playtesting.** Visit all 3 in one trip, refine hint cadence and viewpoints, add optional Field Log references, and run world + manual browser validation before declaring the trilogy finished.

No parallel independent agents should relocate the same terrain while another agent edits the global support model. Keep one contract owner for `terrainHeight` and cave/waterfall exclusion masks. Each puzzle's state and geometry can be built separately behind a common interface; final integration must be serialized by one owner.

## 10. Out of scope deliberately

No global inventory, crafting or resource gathering; no physics engine replacement; no racing leaderboard for puzzles; no real animal interactions as a mechanism; no dynamically evolving full-island sunlight simulation; no platforming death penalty; no mandatory gated research/photo content; no fake sloth photo asset; no reward animations that interfere with the bird-assisted Big Air or bike circuit.

The experience should feel like **three interesting things found during an afternoon exploring**, not three game modes that interrupt exploration.
