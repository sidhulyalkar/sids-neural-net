# Sid's World: South Meadow Skate Plaza and REA parity plan

**Branch:** `feat/island-jetski-dock-race-v1`, PR #94. **Status:** initial playable code integration; browser and physical-device visual acceptance remain outstanding.

## Original experience, not a Skate 3 port

Reference inspiration: Skate 3 and `https://skate.aaddpp.lol/`. The reference is a fan experience that loads data from a user's converted retail copy. No extracted code, assets, animations, marks, soundtrack, map meshes, or copyrighted textures are included in this implementation. REA ("Recreate Anything") is useful here as an **evidence-driven measurement workflow**, not an asset conversion shortcut. Retail timing and animation parameter parity remain **unverified**.

## Geography and geometry contract

South meadow `x:-20..8, z:28..52`, connected to the existing grove and skating landing at `(0,26)`. Geometry and navigation use exactly the same `skateParkSurface()` heightfield. A feathered plateau supports an offset concave bowl, the two quarter transitions and a center street pyramid. Rail metadata is shared between render meshes and grind targeting. Deterministic scenery clearance reserves the whole park. All land and water tests should stay unchanged. Do not build a second island, introduce downloads, or move the existing redwood tree, disc-golf tees, jet-ski pier, ski-jump mountain or caves.

## Inputs (current first pass)

| Action | Keyboard | Touch | Controller |
| --- | --- | --- | --- |
| Move/carve | WASD | Existing canvas movement | Left stick |
| Ollie | Space / Down then Up | POP | A / right stick down-up |
| Flip | Down then Left/Right | FLIP | Right stick down-left/right |
| Advanced flick | Hold Down > 0.45s then Left/Right | Not exposed yet | Right stick held down then flick |
| Grab | Q or E while airborne | Not exposed yet | Not mapped yet |
| Grind | Space near a physical rail (existing behavior) | POP near rail | Not yet unified |
| Aim boost | F or click/tap target | Existing target interaction | Not mapped |

Arrows are intentionally reserved for Flick-style trick entry **only in Skate mode**. WASD continues to drive it. The existing modes retain their prior bindings.

## Measured vs inferred vs not yet implemented

- **Implemented in code:** skateboard turning interpolation and coast-down, matching collision/visible park surfaces, three grindable steel rails, crossing-only quarter lips, kickflips/heelflips/shuvits/tre flips, grabs, combo scoring, bail/clean touchdown detection, HUD, and controller right-stick prototype.
- **Inspired / not measured:** trick-pop impulse, 0.66s rotation window, scoring table, wheel friction, board geometry, rail attachment, curved plaza geometry, camera dampening. Treat these as tunable original behavior.
- **Still missing:** measured Skate 3 motion parity, consistent analog crouch/release gesture classification, manuals/nose manuals, foot plants, reverts, 180/360 body spins, grabs that articulate skater arms, proper board-foot separation, board bails and recovery, lip tricks, multiplayer, replay/video editor, park item placement and saved parks, sponsor/career campaign, UI for control remapping.

## REA collection protocol

1. Capture owned-game or permitted reference footage, ideally at 60 fps, plus synchronized inputs: push at 0/5/10 speed, hard turns, crouch-release vs short ollie, every principal flip, clean/bail landings, ground-to-quarter takeoffs, fakie, grind start/exit.
2. Annotate each clip with initial speed, time from input to takeoff, apex, landing frame, board yaw/roll and camera offset. Include normalized measurements and uncertainty. Never assume a mechanic seen once is a universal rule.
3. Recreate the *behavioral contract* with deterministic fixtures: same scripted input, compare takeoff/apex/airtime/trick completion and runout. Keep measured facts separate from artist-authored choices.
4. Replace first-pass values only when backed by a replay fixture; expose sensitivity curves, rebalance mobile and keyboard separately.
5. Re-check 9 disc golf holes, jet-ski mode exclusivity, ski jump, cave navigation, straight-four-leg Shasta, wildlife and the Joshua ghost race before merging.

## Acceptance gate

- Automated: `node --import tsx --test tests/world-skatepark.test.ts`; TypeScript, strict lint and existing World regressions.
- Chromium: approach from spawn, select Skate, mount plaza without a step, ride both quarter lips, enter/leave bowl without sinking, traverse three rails, exercise arrow flicks and Space, check two successive landings, verify combo/bail, keyboard focus and touch buttons.
- Human: visually inspect smooth ramp surfaces, continuous wheel contact, rotations and body pose, park scale, lighting, rail heights and camera tracking at 30/60 fps. No release claim before this passes.

## Next tranche

Replace provisional board animation with two-foot contact IK on rotating deck, authored rider pose blending, a continuous trickbook with manuals/spins/reverts, believable bails, and physically constrained grinding. Then add replay cameras, personal trick-line challenges, and modular park editor with persisted placements. Retain the original Sid's World landscape rather than shipping retail content.
