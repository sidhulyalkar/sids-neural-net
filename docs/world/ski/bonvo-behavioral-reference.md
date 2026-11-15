# Ski behavior reference · revision 1 · 2026-11-12

Standalone package listed by the author: 0.4.0+1c7437ad (2026-10-21). The live build identifier was unavailable. Browser launch observations: live Play Now selected Boulevard at Crans-Montana, last 296 m. Standalone Run game → Start → First Ride selected Zermatt–Cervinia free ride. Both reported missing WebGL 2 before a playable frame. No motion samples or reference footage were obtained. Physical parameters remain unmeasured.

## Documented inputs

| Action | Keyboard | Pad | Touch |
|---|---|---|---|
| Turn | A/D or lateral arrows | left stick | left stick |
| Tuck / brake | W/S or vertical arrows | RT / LT or B | stick up/down |
| Charge and release | Space | A (PlayStation cross) | Jump |
| Air rotation / grab | directional keys / Shift | grab X (square) or R1; air axes unverified | Grab; air axes unverified |
| Cycle view | C | right stick click | upper-right control |

The author describes four views, camera shake selection and a recoverable ragdoll after rider collisions in Mayhem. Free-ride crash thresholds, camera offsets, and the effect of a grab on angular momentum remain unknown. The demo also offers a boost; ski shooting and shot boosts remain excluded from iLand. Sources: [author's demo and controls](https://zfyl.itch.io/bonvo-ride), [live game](https://bonvo.ski/en/ride).

## Comparison matrix

All rows below are planned trials with **zero measured repetitions**. Durations specify test inputs. They are not observations. Use skis, normal gravity, no boosts, same start marker and view, three repetitions per condition. Log build, slope, speed at input, input edges, presentation timestamps, device and actual frame cadence. Record HUD units verbatim. Without a map scale, report skier-lengths or screen-space measurements with camera uncertainty.

| Initial condition | Exact input sequence | Readout |
|---|---|---|
| Straight glide, low/middle/high observed entry speeds | A 0.5 s, neutral 1 s; repeat mirrored with D | heading delay, radius, speed before/after |
| Same straight slope from rest | Neutral 3 s vs W 3 s, then S 1 s | gravity/tuck speed curves, stopping distance |
| Same crest and approach speed | Space hold 0.1/0.4/0.8 s, release at marker | crouch, launch delay, apex, airtime |
| Same jump | D for 0.25/0.5/0.75 s, then neutral; mirror A | spin onset, coast after release, rotation at contact |
| Same jump | W or S 0.4 s; repeat with D held simultaneously and Shift for final 0.2 s | pitch sign, combined axes, grab reach, knee/hip angles |
| Same lip and entry speed | Vary D release in 0.1 s increments through forward, switch and sideways touchdown | first ski contact, orientation, retained speed, stumble vs fall |
| Same jump | S until contact; then neutral 5 s | inversion at contact, slide distance, get-up time and control return |
| Repeat identical run in each view | Cycle C once between repeats; steer D 0.5 s and jump | camera lag, horizon, feet and landing visibility |
| Same start, pad and landscape touch | Repeat turn, tuck, brake and release trials with documented bindings | dead zone, handedness, simultaneous actions, latency |

## iLand audit at c600724

| Subsystem | Decision and reason |
|---|---|
| #153 terrain, mountainHalfpipe.ts | Keep authored local surface and protection masks. Use the same height sampler for contact and display. |
| #154 V2 architecture | Keep as design context. It supplies no executable evidence. |
| activities.ts / stepTravel | Replace ordinary ski motion behind an opt-in path. Inside the pipe it caps heading rate and targets 6.5 units/s; outside it can take desired heading immediately. Position always advances along heading. A lateral velocity component cannot survive an edge change. |
| #156 worldSkiContact.ts | Keep independent footprint fit and camera boom collision. Each sole uses 17 longitudinal stations at three widths; highest required lift can bridge a bank. Measure maximum clearance and penetration for each ski. |
| worldRenderer.ts | Keep scene, controls for other activities, explicit Big Air authorization and camera obstruction logic. Separate free-ski state before wiring the solver. Feed lookahead from travel velocity so a body flip cannot invert the horizon. |
| #157 target removal | Keep. Three ski targets retired; no gun input in ordinary skiing. |
| playtest-ski-presentation.mjs and contact tests | Keep regression coverage. Existing test waits for speed below 0.2 before its hop. Add measured moving approaches, both walls and each landing outcome. Existing sole-minimum check cannot bound toe or tail gap. |

For comparisons use one input trace indexed by physics tick. Replay at 20/30/60/120 render FPS with jitter. Compare physics snapshots at equal ticks, then separately report GPU, resolution, frame p50/p95 and visual defects. Archive iLand footage against its exact checkout. A successful simulation replay cannot qualify the camera or hardware performance.
