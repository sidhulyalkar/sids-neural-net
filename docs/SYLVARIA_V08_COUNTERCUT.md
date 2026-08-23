# Sylvaria v0.8.2 — Countercut

Sylvaria Countercut is a directional forest-defense fighting game built around a deliberately small control grammar and an increasingly deep combat language. Sprid uses committed cardinal step-dashes to move, cardinal machete cuts to attack and counter, and hostile projectiles themselves as weapons against enemy formations.

v0.8.2 focuses on **trustworthy movement, counter routing, evasive enemies, and readable projectile geometry**. Difficulty should come from understanding a busier system, not from unreliable controls or invisible rules.

## Core rule

The game uses two independent four-direction vocabularies:

- **W / A / S / D** — cardinal **step-dashes**. A tap produces one short committed burst. Holding repeats discrete bursts at a game-controlled cadence.
- **Arrow keys** — cardinal **machete cuts**. Up, down, left, and right cuts damage enemies, chop deadwood, and counter incoming projectiles from the matching arrival side.

Movement and attack direction are independent. Sprid can dash east while cutting north, retreat west while reflecting a projectile south, or chain movement through a lane while protecting an orthogonal firing line.

The authoritative simulation runs at a fixed **120 Hz**.

## Resilient one-command movement queue

The v0.8.1 browser audit exposed an important flaw: the old buffered movement command expired after a short stopwatch window while the current dash was still executing. That worked in most Chromium/Firefox timings but could lose a quick second tap in WebKit.

v0.8.2 removes timed expiration entirely.

- A movement tap made while Sprid is already dashing becomes the single queued movement command.
- The newest queued direction replaces the previous queued direction.
- Releasing that key does **not** remove the queued tap.
- The command survives for the full duration of the current committed dash.
- It is consumed immediately after the current dash completes.
- The queue is cleared on execution, room/reset state, pause, or window blur.
- Held movement still uses a separate deterministic repeat cadence.

The result remains discrete rather than analog, but fast direction changes should now feel intentional on Chrome Stable, Chromium, Firefox, and WebKit/Safari.

## Physical route geometry

Living trees and uncut deadwood are collision geometry. They can shorten or block a step-dash.

Deadwood can be chopped with the machete, so the player can deliberately manufacture future movement lanes. Living trees cannot be sacrificed casually because they are the objective being defended. Later dash distances are stronger for crossing danger but more difficult to place safely among this geometry.

Rooms 1–10 increase base dash distance from **48 px to 66 px**. Deeper seeded rooms continue increasing the step in bounded increments up to 104 px.

## Countering is now counter-routing

A counter is still spatial rather than a universal parry button. The cut direction must match the side from which the projectile actually reaches Sprid, and the slash volume must intersect the projectile.

Once countered, however, the projectile changes jobs:

1. Its hostile zigzag/spiral/wobble behavior is removed.
2. It becomes a clean **return** projectile.
3. Normal returns launch at approximately **840 px/s**.
4. Perfect returns launch at approximately **1040 px/s**.
5. The chosen cardinal cut remains authoritative, but a restrained lane assist can bend the return toward a valid enemy already inside that direction.
6. The return can damage **any enemy**, not merely the shooter.

This makes a successful counter immediately legible and much more likely to land while preserving the player’s directional choice.

### Crosscuts

If a returned projectile hits an enemy other than its original shooter, it earns a **Crosscut** bonus.

Crosscuts make chaotic multi-enemy rooms strategically useful. A projectile fired by a Foreman can be reflected through a Surveyor, Chair, Skidder, or another enemy if the player deliberately chooses the correct arrival/cut lane.

### Long Returns

Return damage and score scale with the distance traveled after reflection. A sufficiently long hit earns a visible **Long Return** bonus.

This creates a reason to counter from farther away rather than always waiting until an enemy is standing next to Sprid. The risk of reading a distant projectile is compensated by a stronger payoff.

### Perfect penetration

A perfect counter begins with one penetration charge. The projectile can hit one target, lose some damage/speed, and continue through the formation once.

This is intentionally bounded to one penetration. The goal is a readable two-target tactical line, not an uncontrolled pinball simulation.

### Counter stagger

A returned projectile puts evasive enemies into a short recovery/stagger state. A projectile returned directly to its original shooter produces the strongest stagger.

This is critical to the combat loop: ranged enemies are allowed to be difficult to chase in melee because a correct counter temporarily solves that movement advantage.

## Hostile projectile families

All hostile movement remains deterministic for the room state. Cosmetic particles can vary, but projectile trajectories and enemy decisions do not depend on ambient random calls.

The current projectile grammar is:

| Pattern | Behavior | Read |
| --- | --- | --- |
| **straight** | constant trajectory | basic cardinal counter lesson |
| **zigzag** | rapid alternating transverse pressure | wait for actual arrival side |
| **wave** | smoother sinusoidal lane movement | read the final arc, not launch vector |
| **spiral** | velocity continuously rotates at a bounded rate | track a curved arrival path |
| **swerve** | one deterministic mid-flight direction change | do not counter on the launch tell alone |
| **wobble** | two bounded oscillations combine into irregular-looking motion | difficult but deterministic |
| **return** | clean high-speed counter trajectory | friendly, bright, strategically routed |

Every hostile pattern still obeys the same counter rule: **the side it reaches Sprid from is the side to cut toward**.

To keep pattern difficulty from becoming performance noise, live hostile/friendly projectiles are capped at **128**, with at most **72** scheduled delayed shots waiting to spawn.

## Deterministic volley timing

Multi-shot attacks no longer need to spawn every projectile on the same frame. A fixed-step pending-shot scheduler supports staggered bursts while preserving deterministic timing.

This lets a three-shot Nailgun Foreman burst, for example, become three successive reads instead of one thick projectile blob.

## Evasive enemy movement

Ranged and support enemies no longer politely remain within machete distance.

There are two bounded escape verbs:

- **backstep** — a short, smooth retreat used by grounded ranged/support units such as Nailgun Foremen and Committee Chairs;
- **blink evade** — a faster lateral/retreat reposition used by Timber Lobbyists, Subsidy Brokers, and Boundary Surveyors.

Before either resolves, the destination is shown with an intent line/marker. The player can therefore anticipate the space the enemy is claiming rather than watching an unexplained teleport.

Returned projectiles stagger enemies out of this evasive advantage, making counter skill the natural answer to strong kiting.

## Enemy roster

| Enemy | Combat role | Structural answer |
| --- | --- | --- |
| Rookie Feller | grounded close-range pressure and tree cutting | read commitment, step away, punish melee recovery |
| Nailgun Foreman | ranged burst teacher that backsteps from pressure | return fast nails instead of chasing indefinitely |
| Timber Lobbyist | zigzag red-tape debuff and blink escape | read arrival geometry, reflect the debuff, punish blink destination |
| Skidder Bruiser | armored committed charger | step off locked line, punish green recovery or route returned fire through armor |
| Harvester Drone | orbital pressure with spiral saw-discs | track actual arrival side |
| Committee Chair | support shield plus backstep | remove/separate support or punch through with returned projectiles |
| Subsidy Broker | interceptable ally acceleration plus blink | counter the travelling transfer before delivery |
| Boundary Surveyor | evasive blink skirmisher with deterministic swerve shots | predict the one-turn trajectory and exploit return stagger |
| Clearcut Mech | heavy mixed player/grove pressure | trust locked target intent and route counter fire through it |
| Mulcher Rig | slow artillery platform with wobble/spiral chip fans | navigate lanes, then turn dense artillery into return ammunition |
| PAC-a-Saw | three-phase synthesis boss | combine movement, routing, pattern reads, grove defense, and recovery punishes |

The industry/government-system humor is fictional satire, not a depiction of real politicians, parties, or identifiable public officials.

## First ten rooms

1. **Trailhead Trespass** — persistent step queue, physical deadwood, basic Feller commitments.
2. **Nailgun Nursery** — straight return-fire fundamentals and high-speed counter payoff.
3. **Red Tape Ravine** — first moving trajectory: zigzag debuff fire.
4. **Skidder Switchback** — locked charge geometry and recovery punishment.
5. **Sawdisc Wetland** — spiral arrival geometry.
6. **Committee Canopy** — real support shielding plus ranged backsteps.
7. **Subsidy Grove** — Boundary Surveyor blinks, swerve fire, and interceptable ally buffs.
8. **Clearcut Conveyor** — Clearcut Mech plus Mulcher Rig pattern pressure and direct grove danger.
9. **Four-Way Firebreak** — mixed-roster Crosscut routing fluency with longer movement commitments.
10. **PAC-a-Saw Summit** — phase-one staggered bursts, phase-two rotating paperwork, phase-three wobble saw pressure and grove-targeted attacks.

The first ten rooms remain an authored teaching sequence. After room ten, `proceduralBlueprint(depth)` deterministically recombines the same language, limits support/heavy density, grows dash distance, and schedules another guardian on every tenth deep room.

## Flow, heartwood, and forest defense

Flow rewards controlled aggression:

- counters;
- perfect counters;
- successful cuts;
- close projectile grazes during a dash;
- Crosscuts and Long Returns.

Flow shortens cut recovery and held-step cadence within bounded limits. It does not silently change current dash length.

Sprid’s heartwood persists between rooms. Clearing a room with every living tree intact produces a **Perfect Grove**, scores a bonus, and restores one heartwood. Losing all living trees ends the run.

## Readability rules

Complexity must remain readable:

- incoming projectiles near Sprid display the current cardinal arrival cue;
- returned projectiles are brighter and leave a stronger trail;
- Crosscut / Long Return rewards appear at the hit location;
- attack target intent is visible before commitment;
- evade destinations are visible before relocation;
- recovery/vulnerability uses a distinct green ring;
- Committee support relationships remain visible in-world;
- Sprid’s machete is rendered outside dash-body deformation, so cut direction remains world-cardinal;
- the combat field stays a stable **960×640 / 3:2** logical arena even in fullscreen;
- **P** toggles pause/resume and **M** toggles procedural SFX.

## Validation

`npm run check:mosslight` is now a contract for v0.8.2 rather than a historical smoke test. It rejects:

- timed movement buffers or the retired `moveBuffer` implementation;
- missing queue consumption after dash completion;
- missing high-speed return normalization;
- missing distance/Crosscut/penetration rewards;
- missing deterministic projectile families or volley scheduling;
- missing backstep/blink telegraphs;
- projectile caps being removed;
- regressions in forest geometry, support systems, heartwood persistence, boss recovery, or seeded deep rooms.

CI also runs:

- **Chrome Stable / Chromium / Firefox / WebKit** through the real `/arcade/sylvaria` iframe, deliberately issuing a quick press-and-release **D → S** sequence and requiring both committed steps plus an independent arrow-key cut;
- a dedicated Chromium combat playtest covering single/held/queued movement, deadwood route chopping, all four counter directions, nonlinear projectile counterability, reflected speed, Crosscuts, Long Returns, perfect penetration, blink/backstep relocation, dash+cut overlap, persistent heartwood, deterministic deep rooms, PAC-a-Saw recovery windows, projectile caps, pause behavior, and FPS;
- the existing dependency audit, TypeScript, lint, unit tests, Nature Atlas audit, World Loom audit, production build, bundle budget, route smoke, and browser screenshots.
