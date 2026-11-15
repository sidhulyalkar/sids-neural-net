# Redwood Flow Garden V5: Granite and Cedar Air Lines

## Player experience
The grove remains an arcade-first, naturally carved forest playground. Redwood bark, moss, weathered granite and the live terrain heightfield are its materials; no flat concrete plaza, fake overpass collider or new trick-control scheme.

Three visible **separate** rails now form a progressive air-line network:

| Gap | Departing line | Receiving line | Intention |
| --- | --- | --- | --- |
| Granite Tongue | `granite-tongue-1` at (11.35, 42.23) | `down-flat-down-0` at (14, 42.2) | Straight beginner-friendly hop into a rolling drop |
| Switchback Fern Hop | `timber-switchback-2` at (6.75, 35.55) | `canyon-snake-0` at (9.2, 38.6) | A gentle leftward connection from the timber park into the canyon |
| Snake → Root | `canyon-snake-3` at (17.1, 38.65) | `canyon-root-curved-0` at (20.2, 36.8) | A curved sideways landing onto a polished downed root |

An approaching skater presses **Space once** to enter a grind. On a qualifying, forward, sufficiently fast exit from an authored terminal segment, **flow assist** carries momentum across the gap and reacquires only the named receiving rail. The player may exit the line naturally, pop off early with Space, or reverse a rail without automatic magnetic capture. Normal skating resumes at the end of the receiving line.

## Physics and geometry contract
- `SKATE_RAIL_GAPS` owns the exact from/to IDs and minimum speeds. `beginSkateRailGap` checks momentum, heading, gap distance and real terminal seam.
- `skateRailGapSample` is a cubic Hermite trajectory with tangent continuity in XZ and a bounded sinusoidal vertical arc, matching real measured start/end rail contact at `groundHeight + railLiftAt + 0.16`.
- Only completed landings return the rider to `grind` and award `Rail → Rail` points. A failed/cancelled transfer cannot score.
- Timed interpolation is deterministic across render frame rates. Chain skating holds a floor speed of 6.2 world units/s instead of losing energy per display frame, avoiding frame-rate-dependent failure on long zigzags.
- Granite erratics and cedar markers remain visual-only and outside the air lane. No boulder is added to gameplay collision, and no invisible rail spans the gap.
- Tunnel and loop remain separate 3D-contact mechanics. A gap cannot simultaneously enter a sequoia wall ride, loop, minigame, or another airborne trick; exiting the activity and fast travel reset the transfer.

## Quality gates
1. Six connected rail chains, legacy straight rail IDs and correct shared endpoints.
2. Three open gaps with dry takeoff and landing; forward-only, speed-qualified, and different destination rail IDs.
3. Physical seam and altitude checks across 100 sampled flight positions per gap; no virtual platform between.
4. Cadence tests at 10, 20, 40 and 60 FPS; one completion and no missed segments.
5. Real Chromium keyboard run through Moss Canyon snake, `snake-root-transfer`, and attachment to the separate root rail; artifact includes screenshot and trace.
6. Existing hollow trunk wall ride and skewed 360 loop must remain inverted, surface-matched, scorably complete and recover to normal movement.
7. Cross-world CI/preview review, performance, TypeScript, lint and Next build are release gates. Keep the PR in draft until these checks pass.

## Visual direction
Polished cedar surfaces should read as naturally used timber, not bright synthetic metal. Dark bark and heartwood frame the hollow bore and loop. Granite chips, shallow weathering and moss growth belong along the borders or just outside transfer gaps. The player must always see a clear skating line; scenery is there to make the park feel discovered in Northern California, not to compete with its wheels.
