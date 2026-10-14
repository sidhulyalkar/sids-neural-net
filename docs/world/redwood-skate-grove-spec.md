# Redwood Skate Grove: authoritative design and implementation contract

**Project:** Sid's World south meadow. **Branch:** `feat/island-jetski-dock-race-v1`, draft PR #94.
**Intent:** A delightful, handcrafted California redwood skate grove, not an urban plaza and not a Skate 3 content import. A visitor should be comfortable exploring with **WASD + Space** (or the one-button touch/controller assist).

## Design principles and non-goals

- **World-first:** one compact constructed activity on existing meadow coordinates `x=-20..8, z=28..52`. Keep coast, pier, jungle, ski mountain, Shasta, cave navigation, disc golf, north-shore skimboarding and wildlife unchanged.
- **Readability:** pale satin-polished wood = safe wheels; dark rough bark = decorative outer cladding; capped metal = grind/coping. No bark bumps, protruding roots, stump vertical faces or plank gaps on wheel contact.
- **Flow before challenge:** gentle entry, natural bank, split-stump manual pads, central log slide, hero hollow-redwood bowl and timber halfpipe. Avoid adding challenge menus, gates, sponsor branding, crowds or collectables.
- **One authoritative field:** `skateParkSurface(p)` is the sampled walk/ride height used by runtime physics and primary park mesh. All supplementary visual meshes are generated from that function (small positive visual offsets only). Never add a decorative solid above the ride envelope or change non-skate world minigame state.
- **Low overhead:** bake all additional wood geometry once at world initialization. One sampled primary mesh, one bark ring, pooled instanced beams/seams/rail assets, no texture fetches, shaders, per-frame geometries or WebGL-heavy postprocessing.

## Spatial layout (world coordinates, subject to terrain evaluation)

| Feature | Coordinates | Ride and visual contract |
| --- | --- | --- |
| Redwood hollow-bowl | center **(-12,40)**, ride radius **0..5.55**, decorative bark **5.6..6.5** | Concave by **raised outer rim** rather than a clipped underground hole; center joins native deck, outer bank builds gradually to ~1.4 u (C1-smooth, shallow enough for casual carving); bark wrapping around outside, open upper bowl, low carved entry on east/northeast arc |
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

## Review checklist

- From spawn the hero hollow-redwood rim and pale halfpipe are both visible without obstructing the landscape or camera.
- Bowl looks hollow when seen diagonally, not like a solid stump or rock crater. Exterior bark is visually layered, with protected smooth interior and a clearly inviting roll-in.
- Ramps look timber-framed, not like brown boxes dropped onto the earth. Metal coping remains visually slim and readable.
- No flora, decorative bark or rail posts protrude through moving board or wheelchair-scale walkable apron.
- No dependency changes, duplicate scene graph, video assets, downloaded retail meshes or new technique onboarding.
