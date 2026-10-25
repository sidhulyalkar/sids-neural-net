# Redwood Skate Grove V4: Flow Garden / Moss Canyon Connector

## Intent
The original stump bowl, 360° timber loop, and fully rideable hollow sequoia remain the hero landmarks. This tranche adds readable, low-friction tricks for nontechnical skaters while using the underdeveloped dry meadow east of the park, toward Moss Canyon at (29, 34). Keep the landscape looking like a forest playground, not a flat concrete plaza.

## Geography and line design

| Line | Coordinates (x,z) | Feature | How it plays |
|---|---|---|---|
| Root Sweep | (-8.4,35.0) to (-4.8,36.65) | Gently curved fallen-wood rail, 3 linked segments | One easy Space grind near the north edge of the stump, smoothly follows the curve |
| Timber Switchback | (2.65,34.2) to (6.75,35.55) | 3-section kink rail | Zigzag entrance variation beside the north quarter; same one-button interaction |
| Canyon Snake | (9.2,38.6) to (17.1,38.65) | Four linked bends | A long flowing single combo across the eastern approach |
| Down / Flat / Down | (14.0,42.2) to (19.6,41.8) | Changing rail elevation | A subtle downhill, flat and transition finish with no abrupt height discontinuity |
| Canyon Root Curve | (20.2,36.8) to (24.0,37.0) | Curving thick polished cedar branch | Late-line trick and safe detour into Moss Canyon |

**Flow terrain:** native meadow from x=7.4 to x=25.6, centered at z=39.4 (half width 4.5), blends into the original heightfield with feathered edges. Rollers at x=11.1, 15.6 and 19.4 provide pump rhythm; manual medallions at (11.6,42.0) and (18.1,35.9) encourage balance play. Wooden hip at (22.4,40.2) launches eastward at appropriate forward speed. There are no collision boxes, floating decks, or scripted teleport transitions on this connector.

## Contracts
- Existing park and loop geometry stays anchored; avoid covering the sequoia mouths, loop entry/exit, bowl coping, and tree trunks.
- Every rail segment is a real selectable `sport` grind; connecting segments use `chainId`/`segment` metadata and are rendered at `groundHeight + interpolated lift`. `advanceRailChain` consumes world-distance across a junction within the same tick, including reverse travel, without repeatedly scoring each elbow.
- Original rail IDs remain stable for regressions and saved references. `Space` remains the easy trick/grind action. No specialized new keybindings.
- Canyon rise is C1 and strictly additive to natural terrain, softly disappearing at all edges, with no water-landing changes.
- Scenery is pooled into named instanced meshes; wood grain never creates a second collidable surface.
- Camera / World activity state must remain usable on leaving the park and when switching to disc golf, jet-ski or skiing.

## Acceptance
1. Unit: all 5 rail chains exist, have exact shared endpoints, finite heights, dry placement, and are traversable in both directions at 10, 20, 40 and 60 FPS; grind distance equals full arc length.
2. Geometry: all corridor grid vertices match the authoritative `groundHeight`, not a decorative approximation. All wood rail geometry reuses the same interpolated endpoint lifts.
3. Browser: existing loop, sequoia, bowl, camera, trick and island regression workflows remain green. Verify procedural draw batch budget and the visual line before merging.
4. Visual signoff: inspect the corridor from the original park overview and from the Moss Canyon entrance; ensure the new elements feel naturally carved rather than repeated manufactured rails.

## Follow-on polish (not part of this patch)
- Add a small side wall-ride carved into a standing deadwood trunk only after a dedicated 3D contact/camera test exists.
- Support gap-transfer scoring when leaving one grind line airborne and landing on a different one, with physically verified air time and nonrecursive trick ownership.
- Inspect screenshot density and tune plank contrast and forest clutter without compromising accessibility or performance.
