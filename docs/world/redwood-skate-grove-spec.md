# Redwood Skate Grove: authoritative design and implementation contract

**Project:** Sid's World south meadow. **Branch:** `feat/island-jetski-dock-race-v1`, draft PR #94.
**Intent:** A delightful, handcrafted California redwood skate grove, not an urban plaza and not a Skate 3 content import. A visitor should be comfortable exploring with **WASD + Space** (or the one-button touch/controller assist).

## Design principles and non-goals

- **World-first:** one compact constructed activity on existing meadow coordinates `x=-20..8, z=28..52`. Keep coast, pier, jungle, ski mountain, Shasta, cave navigation, disc golf, north-shore skimboarding and wildlife unchanged.
- **Readability:** pale satin-polished wood = safe wheels; dark rough bark = decorative outer cladding; capped metal = grind/coping. No bark bumps, protruding roots, stump vertical faces or plank gaps on wheel contact.
- **Flow before challenge:** gentle entry, natural bank, split-stump manual pads, central log slide, hero hollow-redwood bowl and timber halfpipe. Avoid adding challenge menus, gates, sponsor branding, crowds or collectables.
- **One authoritative field:** `skateParkSurface(p)` is the sampled walk/ride height used by runtime physics and primary park mesh. All supplementary visual meshes are generated from that function (small positive visual offsets only). Never add a decorative solid above the ride envelope or change non-skate world minigame state.
- **Low overhead:** bake all additional wood geometry once at world initialization. One sampled primary mesh with heartwood/bark vertex colors, pooled instanced beams/seams/rail assets, no texture fetches, shaders, per-frame geometries or WebGL-heavy postprocessing.

## Spatial layout (world coordinates, subject to terrain evaluation)

| Feature | Coordinates | Ride and visual contract |
| --- | --- | --- |
| Redwood hollow-bowl | center **(-12,40)**, ride radius **0..5.55**, decorative bark **5.6..6.5** | Concave by **raised outer rim** rather than a clipped underground hole; center joins native deck, outer bank rises to roughly 2.05 u in the protected crest, with a smooth interior and a shorter exterior bark drop; the eastern roll-in remains lowered; bark wrapping around outside, open upper bowl, low carved entry on east/northeast arc |
| Wooden halfpipe corridor | x **-2..7**, north z **28.6..34**, south z **46..51.4** | Existing mirrored transitions keep their real heightfield and launch lips; replace grey surface coloring with pale cedar and aligned narrow grain/slat seams; support ribs and edge trim only below/along the outside edges |
| Low timber street pyramid | centered **(-1,40)** | Keep shape, recolor to maple, no jump in collision function |
| Split-stump manual pads | approx **(-5,33.3)** and **(-5,46.5)** | Radius ~1.15-1.3, smoothly feathered shallow humps <=0.16 world u; present as sanded cut-log medallions following support surface, not floating cylinders |
| Log slide | preexisting `park-flat-bar`, x=5 z=36..44 | Shared grind-rail source keeps id/height/segments; draw solid straight, polished log as rail with visible dark bark undertone and durable pale sliding crown |
| Split timber ledge | preexisting `park-down-rail`, x=-2 z=34.3 to x=0 z=38.2 | Blend wood/metal: rounded timber body and slender metal riding cap, unchanged physics targeting |
| Bowl coping | preexisting `park-bowl-coping`, x=-17 z=39..43 | Match bowl boundary and render contact altitude. Ring lip has slim highlight; never create a collision-opaque wall across entry |
| Scenic context | nonrideable perimeter only | 2-3 detached root silhouettes, moss along bark exterior, a few fern sprays, minimal timber footings. No clutter on run-in |

## Geometric construction

**Hero tree bowl.** Construct bowl rise as a C1-smooth radial bank in `skateParkSurface`: floor radius <1u, increasing to max at radius ~5.3-5.55, then feathering to the existing deck between 5.55 and 7u. Blend the park perimeter to native ground as before. Use no `Math.max(natural,...)` to clip a negative cavity because it would make the bowl unrideably flat. The silhouette is a giant felled redwood cross-section with a naturally opened carved top: visible bark outside and subtle concentric grain bands close to the rim. Approx 48-64 segments across the bark geometry with sampled heights; avoid spikes or clipped seams. Keep a shallow east-side roll-in clear of bark trim.

**Timber transitions.** The north/south quarter curves remain in the same coordinates and continue to launch from the exact same lip crossing planes. Render wood-toned primary surface and thin plank seams that follow `groundHeight`. End-cap/stringer beams stay outside the riding corridor or below the surface. Use no separate collidable deck mesh.

**Manual pads.** Surface relief is <=0.16 and C1-tapered; color ring and top are purely decorative. A casual skater can ignore the pads; held manuals continue to use the existing scoring state.

**Rails.** Keep `SKATE_PARK_RAILS` ids, segments, `lift` values, closest-point behavior and grind scoring unchanged. A timber profile must not change the invisible grind geometry. Any capped steel contact line must align within 0.1u of the shared rail axis.

## Inputs and interaction

WASD drives, Space/controller A/touch ✦ TRICK invokes current assist. Keep advanced arrows/manual/spin/grab bindings untouched. A fast crossing of either existing quarter lip can trigger assisted style without a second button. Existing transient completed-trick notification stays centered at top of screen, compact and readable.

## Acceptance and regression tests

1. Heightfield and mesh share exactly the same sample: finite, continuous at all park outer bounds and naturally blended into old meadow.
2. Hero bowl center is at least 0.25u below sampled rim, the radial sweep has no abrupt single-step rise, and shallow entrance does not become a vertical wall; both quarter pipes still rise >1u over flat.
3. Both stump pads exist as continuous low humps in the *same* riding surface; their outer radius returns to surrounding surface, no step obstacles.
4. Rail segment ids and grind targeting remain exact, including flat bar / log ride. Launch requires real lip-plane crossing + forward heading + sufficient speed; bike mode is unaffected.
5. Browser: choose Skate, warp to south meadow, render three named materials/zones, land assisted and explicit flip, see brief trick callouts, verify no page errors. Record screenshots of bowl, timber halfpipe and approach line.
6. All World unit tests, TypeScript, lint and existing mini-game/browser checks must pass at final HEAD. Do not mark merge-ready because the new park looks plausible in source code; real Chromium visual acceptance is still mandatory.

## Visual acceptance follow-up (October 14)

The first real Chromium screenshots showed a useful contrast: the cedar transitions
were clearly legible and the new west-facing skate arrival framed the hero bowl,
but 84 high-contrast radial bark ribs made the trunk read as a comb or fringed
saucer. These were not gameplay obstacles, but they weakened the natural design.
The implementation now uses 28 or fewer short, surface-embedded bark flutes,
closer in color to the trunk, while maintaining the split roll-in.
The radial raised-bank amplitude increased from 1.18 to 1.42 units, still using
the same continuous collision heightfield and keeping the original coping and
trick-assist affordances.

Independent [Redwood Skate Grove Browser QA](../../.github/workflows/skate-grove-browser.yml)
captures overview, bowl, halfpipe and trick results without waiting for jet ski
or disc golf. Accept this refinement only after checking the **new** screenshot:
it should read as a hollowed living-material sculpture, not a bark picket fence.
No added physical obstruction at the roll-in, no alternative colliders, and no
camera override while actually skating.

## Play-first continuous flow and safety (October 14)

**Arrival:** `activityLanding("skate")` starts at `(3,40.8)`. Camera and
rider steering both face the east-side hollow-tree opening. **W** rolls from
timber apron into bowl, **A** follows the lower carved curve, and **S**
allows a return toward the pale-timber and stump features. Steering remains
normal WASD input, not an autopilot, invisible rail or scripted path.

**Bank assistance:** `redwoodBowlCarveHeading()` is purely deterministic
and activates only at meaningful speed in the outer bowl wall when the
projected trajectory would leave the meadow. It gently redirects unsafe
outward motion along the bowl tangent, without changing speed, teleporting,
or altering the east split or safe reader-controlled exits. Outside the bowl
and on safely directed paths the original board movement is preserved.

**Safe launch:** `redwoodBowlExitCrossing()` still requires a real outward
crossing and speed and excludes the split. A cliff-facing launch is not a
reward. Its check now reserves a **downhill-aware flight corridor of at least
1.1 seconds** with a 1.5-unit inset from the park edge and rejects water;
the old level-ground time estimate proved too short. Actual touchdown is
recorded separately as `skateBowlLandings` or
`skateBowlFailedLandings`, never inferred from an accepted pop.

**Compact fun-first jump:** Space/controller A/touch-assisted tricks launched
on the ground *inside* the grove have reduced pop velocity, preserving the
0.44-second assisted board animation and clean landing thresholds without
unintentionally carrying the board a long distance outside the park.
Explicit expert Flick tricks and tricks in the wider island retain their
existing air impulse. Park-zone telemetry reports a name only when the rider
is physically inside park bounds, to prevent a fake positive QA outcome.

**Real-browser contract:** `scripts/playtest-skate-grove-flow.mjs` presses
W to enter the bowl, A to carve, S to return toward the timber zone and
Space for the next trick. The test must observe a real completed landing,
positive score, no water/out-of-bounds landings, and the final player's
actual in-park status. Screenshots and a traced JSON report are retained
on *both* success and failure. `tests/world-skate-flow.test.ts` separately
covers safe/unsafe exit geometry and tangent banking.

**Important prior regression:** The earlier launch-only audit
([run 38522810458](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/38522810458))
passed while observing the bowl pop but did not observe touchdown. A later
physics audit exposed an out-of-park real landing at `(-19.33,53.07)`.
A subsequent browser run also showed that a scored return trick could land
beyond the east park boundary even though a loosely classified zone label
remained present. These were real bugs, not successful park-loop validation.
The tests and physics were strengthened accordingly. Do not claim full-loop
qualification until the latest strict browser test is green.

## Screenshot-driven trunk silhouette revision (October 14, second pass)

A new hidden lower bark fascia passed geometry checks but changed almost
nothing in Chromium: its triangles sat below the fully opaque sampled
riding field. Keeping it would spend a draw call on invisible art, not
deliver the intended massive fallen-tree form. It was removed.

The definitive implementation is instead in the *single physics-backed*
`redwoodBowlBankRise(p)`, called by `skateParkSurface(p)`. The crest rises
about 2.05 world units above the underlying deck, with gentle asymmetric
old-growth undulations, a compressed 1.36u exterior falloff, and a
0.66-strength entrance relief on the east. The interior remains C1 smooth,
while `worldSkateGroveGeometry` samples the exact same field for the pale
carved riding top and dark bark slope. No bark collision mesh, rail changes,
or hidden moving parts were introduced.

Added tests qualify the actual *physical profile* (crown, shallow entry,
native-ground blend and bounded sample-to-sample rises) as well as the
rendered deck support. This is a direct visual intervention, not an
occluded decorative component. Confirm the final profile by reviewing
the new browser screenshots and W → A → S → Space loop on the same head;
the previous browser passes apply only to their exact checked commits.

## No-overlap trunk shading correction (October 14)

The raised 2.05u physical trunk changed the bowl silhouette, but a second
skin of bark triangles visually tore through the steeper riding shoulder.
Increasing the tessellation density and interpolating bark vertices against
the displayed deck eliminated some clipping but still left jagged, partially
occluded strips between overlay vertices. Therefore this extra shell and its
decorative flutes were **removed altogether**.

The production design uses **one** tessellated
`skate-grove-ride-surface` for shape, wheel support, polished cut face,
cambium transition and deeply colored bark. Bark and heartwood colors are
computed once as baked vertex colors, with soft radial gradients and slight
irregular end grain. No transparent textures, z-fighting fixes, polygon
offsets, duplicated mesh or extra collision layer. A 96 × 84 grid resolves
the steeper physical shoulder. Existing growth rings, coping, roots, timber
beams and thin ornamental end-grain strokes remain pooled and separate,
with no tall faux obstacles along the skateable apron.

The geometry tests assert that there is **no**
`hollow-redwood-bark-shell` and that the same riding mesh has contrasting
bright inner wood and dark exterior bark. Camera screenshots must show no
dark sawtooth triangles or yellow teeth at the redwood shoulder. Check the
latest screenshot and the browser W → A → S → Space playtest after this
change before accepting the final silhouette.

## Review checklist

- From spawn the hero hollow-redwood rim and pale halfpipe are both visible without obstructing the landscape or camera.
- Bowl looks hollow when seen diagonally, not like a solid stump or rock crater. Exterior bark is visually layered, with protected smooth interior and a clearly inviting roll-in.
- Ramps look timber-framed, not like brown boxes dropped onto the earth. Metal coping remains visually slim and readable.
- No flora, decorative bark or rail posts protrude through moving board or wheelchair-scale walkable apron.
- No dependency changes, duplicate scene graph, video assets, downloaded retail meshes or new technique onboarding.
