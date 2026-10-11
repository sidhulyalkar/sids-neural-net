# Disc Golf v1.7: long fairways and mandatory gates

Status: feature branch implementation, **not browser-accepted or merged**.

## Feel

This is a complete nine-hole disc golf minigame, not nine putts. Every hole is a multi-shot journey across world-scale terrain. Hole 2 deliberately begins on the **eastern shore** and ends at the **backside of Granite Ridge**. Independently marked tees avoid other activities, a chain basket is the final goal, and intervening large amber arches create visible mandatory flight challenges.

The arc of each hole is: **tee → gate(s), in order → chains**. The disc must physically cross the plane inside the illuminated arch while airborne. Merely landing nearby doesn't count. A reverse-direction crossing counts as a recovery if the player overshoots, so no irreversible trap. Water redos refund both strokes and any gates from that same throw. The basket cannot score until all its mandatory gates are cleared.

Tap Space for a recommended shot, or hold/release for manual strength. A/D adjusts direction relative to the currently required gate, W/S adjusts loft. Short putts aim at the chains after the last gate. The camera and HUD follow the next objective automatically, and the basket intro points toward the **first gate** to avoid revealing an irrelevant target. Existing Shasta fetch animations, third-person putting and nine-hole scorecard remain.

## Authoritative course coordinates (world x/z)

| Hole | Tee | Mandatory gate(s), in order | Chains | Par |
| --- | --- | --- | --- | ---: |
| 1 | (35,-12) | (43,17) | (35,46) | 4 |
| 2, Shore to Backside | (51,32) | (45,-9), (34,-42), (26,-69) | (26,-87) | 6 |
| 3 | (46,-4) | (40,-32), (27,-59) | (8,-75) | 5 |
| 4 | (35,-76) | (7,-57), (-16,-38) | (-26,-8) | 5 |
| 5 | (-24,38) | (-16,9), (-16,-21) | (-27,-47) | 5 |
| 6 | (-24,-5) | (-6,15), (18,30) | (45,46) | 5 |
| 7 | (26,-85) | (5,-62), (3,-33) | (14,-12) | 5 |
| 8 | (42,-67) | (45,-34), (34,-7) | (17,16) | 5 |
| 9 | (47,41) | (19,19), (0,-3) | (-24,-15) | 5 |

Course par: **45**. Gates are broad and stand twelve world units tall for readable, achievable throws. Routes range roughly 60–125 world units; actual multi-throw flight distances depend on terrain, wind, power and release angle. User-facing names remain random and funny per round; route descriptions in this document are internal planning names.

## Validity and release

- Preserve clear tees, greens, and seeded procedural entry/exit corridors around every active gate. Do not remove all intervening trees, rocks or ramps.
- World tests must verify the **swept crossing** and its height/width tolerances, in-order progress, prevention of early basket catches, reverse recovery, water rollback, stable rendering/preview parity and the increased multi-shot course length.
- The fairway audit must include all gate safety margins, staging-position throw reachability, and per-leg distance. A simple straight line from tee to basket is not a valid multi-gate playability test.
- Keep the renderer's world diagnostic selectors for hole number, active gate, player coordinates and accepted throws; update the standalone Playwright script to visit all holes and confirm gates progress and actual puts.
- Browser review still required for mountain backdrop visibility, clearance of the actual waterfall/cave shell, overhead camera during short putts, attractive amber arches and real gameplay fairness. Do **not** claim visual signoff from the analytic CI alone.

Older v1.6 short-course par/coordinates and saved rounds are superseded. v1.7 changes the storage version so incompatible rounds cannot be carried into the redesigned scorecard.
