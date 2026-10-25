# Disc Golf v1.6: playable nine-hole course

Status: implemented on `feat/sids-world`; World CI validates the analytic course and first-shot simulation. Rendered fairways still require browser signoff.

## Experience

Nine stationary baskets with independently authored, collision-aware tee pads. **Do not put the next tee at the previous basket:** earlier shared locations created unreachable starting positions and abrupt first-shot failures. Selecting or completing a hole teleports to its own marked tee, then the short basket-first camera introduction settles at an elevated third-person player view. Shasta follows the flying disc and finds the landing point. Funny course names reroll per round but stay stable for scoring.

The UI should say **Disc Golf**. Controls: A/D aim, W/S loft, tap Space for a controlled recommendation, or hold/release for manual power. Click/tap the throw button also works. Repeated interactions must not deadlock if the render thread declines a request. The HUD stays mounted through the shot; start requests received while paused are processed once the world can run. Keep the scorecard small and unobtrusive.

## Course layout

World x/z units, not regulation meters. Each endpoint is an authored hypothesis supported by numeric QA, not a guarantee of visual clearance.

| Hole | Tee | Basket | Par | Character |
| --- | --- | --- | --- | --- |
| 1 | (38,-4) | (41,27) | 3 | Open tutorial line, no seeded tree canopy |
| 2 | (47,15) | (38,-18) | 4 | Exposed approach, not the old 72-unit cramped return |
| 3 | (42,-22) | (28,-49) | 4 | Rolling uphill terrain |
| 4 | (16,-55) | (-24,-39) | 4 | Downhill mountain crossline |
| 5 | (-23,5) | (-24,37) | 3 | Coastal crosswind |
| 6 | (-17,4) | (-7,-23) | 3 | Woodland meadow |
| 7 | (26,-57) | (44,-78) | 4 | Mountain backside descending toward open ground |
| 8 | (28,-53) | (43,-34) | 3 | Controlled short approach on the dry ridge |
| 9 | (44,-9) | (35,20) | 3 | Final approach to the canyon |

**Course par 31.** This revises prior v1.3 geometry/par, so its local-storage score key has changed: old rounds must not be presented as valid on the redesigned course.

## Playability contract

- Every tee and basket must sit on dry terrain with at least 6 units of margin from the analytic coast and slopes within their safety thresholds.
- The nearest authored tree, ramp, fallen log, discovery, rock, or cave obstacle must leave a 2-unit residual clearance at both ends. The audit also accounts for canyon columns.
- Protect the first 11 units of each fairway and the final 8 units approaching each basket from seeded boulders, understory, trees and grass. Hole 1 additionally retains a full-width clear tutorial lane. Do not remove every mid-fairway obstacle; those form the challenge.
- A centered tap at the recommended power must progress at least seven units and settle onto a real lie rather than producing an instant splash, obstacle death or invisible zero-distance throw.
- The recommendation intentionally aims a long drive toward a controllable approach rather than auto-scoring an ace on every tee. Short putts still receive a catch-capable suggestion.
- Render a subtle tee-circle marker only before the first throw, the stationary basket throughout the hole and the landing lie beacon when the disc stops.
- Keep the camera in an elevated third-person view on putts, and follow the disc/Shasta on long throws. Wind and procedural trunks can still affect real flight.

## Evidence and release gates

`node --import tsx --test tests/world-*.test.ts` checks nine-hole geometry, strokes, player lie, supported putts, the first-shot recommendation and follow-up physics. `node --import tsx scripts/audit-disc-golf.ts` checks every tee and green, prints first-shot distance/power and emits markdown/JSON reports. World CI runs both and uploads artifacts.

The runtime canvas exposes `data-disc-golf-layout-clear`, `data-disc-golf-layout-issues` and `data-disc-golf-last-shot`. `scripts/playtest-disc-golf.mjs` provides an optional Playwright run against a running website with `PLAYWRIGHT_MODULE_ROOT` and `WORLD_BASE_URL`; it tests **every opening throw**, including pointer input on Hole 2.

Manual browser review is still essential: verify camera framing, visibility of chains through geometry, Shasta fetch shots, intuitive power, mobile reachability, full scorecard progression, and no conflicts with cave, waterfall, climbing or cycling structures. Do not merge until that passes. Earlier moving-target and linked-tee specifications are historical.
