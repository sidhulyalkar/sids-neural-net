# Sid's World: South Meadow Skate Plaza and REA parity plan

**Branch:** `feat/island-jetski-dock-race-v1`, PR #94. **Status:** visitor-first trick assist and park code integrated; browser and physical-device visual acceptance remain outstanding.

## Original experience, not a Skate 3 port

Reference inspiration: Skate 3 and `https://skate.aaddpp.lol/`. The reference is a fan experience that loads data from a user's converted retail copy. No extracted code, assets, animations, marks, soundtrack, map meshes, or copyrighted textures are included in this implementation. REA ("Reverse Engineer Anything") is useful here as an **evidence-driven measurement workflow**, not an asset conversion shortcut. Retail timing and animation parameter parity remain **unverified**.

## Geography and geometry contract

South meadow `x:-20..8, z:28..52`, connected to the existing grove. Press **Skate**, then choose **Skatepark · south meadow** in the activity dock for a deterministic playable landing at `(0,35)`. Geometry and navigation use exactly the same `skateParkSurface()` heightfield. A feathered plateau supports an offset concave bowl, the two quarter transitions and a center street pyramid. Rail metadata is shared between render meshes and grind targeting. Deterministic scenery clearance reserves the whole park. All land and water tests should stay unchanged. Do not build a second island, introduce downloads, or move the existing redwood tree, disc-golf tees, jet-ski pier, ski-jump mountain or caves.

## Input philosophy: play first, technique optional (Oct 13)

Skating should be a natural way to explore the same island, not a separate simulation
requiring a tutorial. A visitor who knows only **WASD + Space** should be able to
carve the world, pop appealing tricks and enjoy them immediately. Precise tricks
are an optional layer for people who enjoy them. No extra trick menus, currency,
grind challenges, retailer assets or crowded HUD.

| Action | Keyboard | Touch | Controller |
| --- | --- | --- | --- |
| Explore, coast, carve | WASD | World movement controls | Left stick |
| **Easy assisted trick** | **Space** | **✦ TRICK** | **A** (edge-triggered) |
| Rail grind | Space near an aligned, close rail at speed | ✦ TRICK near the rail | A near the rail |
| Stylized automatic quarterpipe trick | Cross park lip fast; no button required | Same | Same |
| Explicit Ollie, flip or shuv | Down then Up/Left/Right arrow Flick | Not required | Right stick Flick |
| Manual / nose manual | Hold C / X | Not required | Not mapped |
| Body spin | J / L while airborne | Occasional assisted 180 | Right-stick Flick remains separate |
| Grab | Q / E while airborne | Not required | Not mapped |
| Skill-shot speed boost | F or skill-shot target | Existing target interaction | Not mapped |

The default assist is deterministic and reuses the existing trick state machine:
it cycles Ollie → Kickflip → Pop Shuvit → Heelflip → Tre Flip →
360 Shuvit and modifies the choice by speed, current takeoff and proximity
to the skatepark. Every fourth qualifying fast park trick can add a ±180°
spin, not an extra input requirement. Landed-assisted tricks have an earlier
board catch, but extremely short flights can still bail. Existing Flick inputs
are always precise: assist never overrides an explicit selection.

A compact landing notification appears for 1.85 seconds, naming the actual
completed move and showing its incremental points plus combo count, with a
respectful reduced-motion version. This card appears for landings, grinds,
manual releases and bails, only while skating. The thin persistent HUD shows
a tiny controls reminder, line score and best. No new renderer or scene is
needed for trick feedback.

### A world that supports skating, not a second Skate 3

- Keep the **south meadow skatepark** the one deliberate constructed complex:
  its bowl, street pyramid, banks and rails give visitors an optional destination.
- Let the **existing island terrain** provide organic discoveries, naturally
  sloping ground, fallen-log grinds and coastal viewpoints. There is no need to
  scatter quarterpipes through the rainforest, alpine river or wildlife biomes.
- Good next embellishments are small and local: a smooth approach line into the
  plaza, a single sightline framing a coastline jump, and a few quiet style
  spots. Protect the pier (jet ski and disc golf), mountain ski jump, caves,
  Shasta and the north-shore skimboarding beach.
- Do not add a campaign, trick shop, costume inventory, crowds, commercial
  branding or elaborate control menus merely to make tricks seem meaningful.
  The value is in **riding through a personal island**.

## Measured vs inferred vs not yet implemented

- **Implemented in code:** skateboard turning interpolation and coast-down, matching collision/visible park surfaces, three grindable steel rails and metal coping, crossing-only quarter lips, kickflips/heelflips/shuvits/tre flips, grabs, manuals, 180/360 rotations, fakie stance, combo scoring, assisted one-button trick choice, brief landing-score callouts, bail/clean touchdown detection, HUD, and controller right-stick prototype.
- **Inspired / not measured:** trick-pop impulse, 0.66s rotation window, scoring table, wheel friction, board geometry, rail attachment, curved plaza geometry, camera dampening. Treat these as tunable original behavior.
- **Still missing:** measured Skate 3 motion parity, consistent analog crouch/release gesture classification, manuals/nose manuals, foot plants, reverts, 180/360 body spins, grabs that articulate skater arms, proper board-foot separation, board bails and recovery, lip tricks, multiplayer, replay/video editor, park item placement and saved parks, sponsor/career campaign, UI for control remapping.

## Local REA tool setup (not executed in this environment)

REA can be connected to an agent on a compatible local host using `npx rea-agents setup`, then verified with `npx -y rea-agents@latest doctor`. The current GitHub-only implementation has **not** performed runtime REA inspection of the proprietary Skate 3 game or the player-owned data served by the fan site. A future analysis run requires suitable local access and recorded evidence. The reference footage, original meshes, animations, sounds, and game binaries must not be redistributed into this repo.

## REA collection protocol

1. Capture owned-game or permitted reference footage, ideally at 60 fps, plus synchronized inputs: push at 0/5/10 speed, hard turns, crouch-release vs short ollie, every principal flip, clean/bail landings, ground-to-quarter takeoffs, fakie, grind start/exit.
2. Annotate each clip with initial speed, time from input to takeoff, apex, landing frame, board yaw/roll and camera offset. Include normalized measurements and uncertainty. Never assume a mechanic seen once is a universal rule.
3. Recreate the *behavioral contract* with deterministic fixtures: same scripted input, compare takeoff/apex/airtime/trick completion and runout. Keep measured facts separate from artist-authored choices.
4. Replace first-pass values only when backed by a replay fixture; expose sensitivity curves, rebalance mobile and keyboard separately.
5. Re-check 9 disc golf holes, jet-ski mode exclusivity, ski jump, cave navigation, straight-four-leg Shasta, wildlife and the Joshua ghost race before merging.

## Acceptance gate

- Automated: `node --import tsx --test tests/world-skatepark.test.ts`; TypeScript, strict lint and existing World regressions.
- Chromium: `scripts/playtest-skatepark.mjs` is wired into the jet-ski browser workflow to verify Skate selection, direct park arrival, a landed ollie and a landed kickflip combo with screenshots. This does **not** yet cover every rail, transition, bail or touch behavior. Add those assertions before approval. The browser script also checks the assist card and a second assisted Space trick.
- Human: visually inspect smooth ramp surfaces, continuous wheel contact, rotations and body pose, park scale, lighting, rail heights and camera tracking at 30/60 fps. No release claim before this passes.

## Next tranche

Replace provisional board animation with two-foot contact IK on rotating deck, authored rider pose blending, a continuous trickbook with manuals/spins/reverts, believable bails, and physically constrained grinding. Then add replay cameras, personal trick-line challenges, and modular park editor with persisted placements. Retain the original Sid's World landscape rather than shipping retail content.
