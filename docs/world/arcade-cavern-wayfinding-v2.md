# Arcade Cavern V2: Granite Signal wayfinding

The mountain-backside arcade should be **discoverable without knowing the menu location**. Keep the existing cave and game wall as the reward. The new landmark hints at what is inside without turning the mountain into a neon amusement-park building.

## Signature silhouette
- Two fractured dark-basalt monoliths, outside both sides of the walkable south-facing cave mouth, tilt toward an open overhead break. The split is deliberately unlike the timber-loop circle.
- A suspended warm amber diamond above the entrance gives a recognizable skyline target.
- A small, high, carved **ARCADE** pixel sign uses the same block-letter grammar as the game wall. It sits above player height, so it does not hide or collide with the mouth.
- Teal accent cuts connect the landmark visually with the neural/engineering theme of the island. Amber remains the dominant breadcrumb color.
- All elements use low-poly instanced primitive geometry and emissive materials, not additional active scene lights, particle systems, textures, or collision.

## Finding the entrance
Four dry, tall amber cairns begin near Granite Ridge and lead toward the true cave:
1. Ridge beacon (12.1, -59.2), first silhouette from the mountain region
2. Switchback cairn (20.8, -68.8)
3. Cave overlook (20.6, -77.2)
4. Mouth waystone (20.0, -85.4)

Near a cairn, an unobtrusive status readout says “AMBER CAIRNS · FOLLOW THE LIGHT TO THE ARCADE”. Closer to the gate it becomes “ARCADE CAVERN · ENTER THE SPLIT STONE”. After entering, the hint disappears, leaving attention on the lantern and three carved game panels.

## Engineering contracts
- `ARCADE_CAVE.entrance`, `ARCADE_CAVE.approach`, the layered underground support, and `caveObstacles()` remain the source of truth. Wayfinding art does **not** introduce global x/z colliders.
- The basalt flanks remain at x +/- 4.5 from the center while the cave's live entry half-width is narrower. Avoid visual blockage of the tunnel throat.
- Cairn bases are grounded with `terrainHeight`; avoid floating signs or rocks on the steep Granite Ridge slope.
- HUD appears only while actively exploring on dry land near the trail or mouth, and hides in the tunnel or during World minigames.
- The entire feature is deterministically authored, CPU-light, and disposable with the World scene.

## Verification
- `tests/world-arcade-wayfinding.test.ts`: route visibility proximity, cave clearance, dry footings, and cave baffle exit navigation.
- `scripts/playtest-arcade-wayfinding.mjs`: pictures from Granite Ridge and the exterior portal, checks accessible guidance, and physically enters the underground layer using W.
- `.github/workflows/arcade-cavern-browser.yml` runs it independently of the heavy site-wide world audit.
- Existing `scripts/playtest-world.mjs` still covers game-panel gaze targeting, Shasta entrance waiting, and the full cave chamber. Any failures must remain visible until diagnosed, not bypassed by teleportation.

## Further polish
Inspect screenshots to tune landmark brightness, lettering orientation, and silhouette occlusion from the ridge. If users struggle following the descent, add 1-2 cairns only after checking the authored ski, mountain and cavern travel paths.
