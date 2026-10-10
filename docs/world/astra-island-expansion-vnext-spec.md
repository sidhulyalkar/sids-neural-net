# Sid's World: Island Expansion vNext — executable scope and acceptance contract

Status: **IN PROGRESS**. Scope approved 2026-10-10. The initial island audit and
measured expanded-course tranche are implemented; later features remain pending.
Current implementation data must be read from the feature branch, not the frozen
initial-baseline inventory below.

### Execution ledger (2026-10-10)

- **Tranche 0 (first survey) complete:** `lib/world/occupancy.ts`,
  `scripts/audit-island.ts`, `tests/world-occupancy.test.ts`. At 6-unit
  sampling, 384 cells (367 land, 17 water) were classified; 3 are flagged
  `needs-review`. This is a semantic suitability proxy, NOT pixel-verified
  vegetation occupancy. The workflow saves SVG, JSON and CSV audit artifacts.
- **Tranche 1 (3× course geometry) code and CI complete:** `desertTrack.ts`
  replaces the 91.416-unit capsule with a **305.4886-unit** closed, sampled
  single-lap centerline, four long corridors, three real hairpin curves and a
  wide northern/scrub return. Spatial bucketing limits nearest-segment queries.
  Sport clearance, route points, terrain, jumps and ground pigment share the
  source. The climbing ledges, boulder groups, waypoint/photography turnout
  and ridge log were moved off the course. Read updated path coordinates and
  dynamic region locations from the source, not the draft blockout below.
- The current three desert jumps remain **solid sculpted kickers**, not true
  lowered arroyo/fallen-tree gaps. **Tranche 2 is NOT complete.** The proposed
  bypasses, underjump behavior, revised obstacle meshes and landing physics
  must be implemented and tested separately.
- Desert and rainforest fauna additions, photo ingestion, shape-changing fish
  schools, trident objects and all-island visible infill are **NOT complete**
  under this expanded contract. Prior biome elements remain available.
- Regression evidence: [World Landscape Regression 38068793072](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/38068793072)
  passed dedicated world unit tests, typecheck, lint, audit report generation
  and the separate World Loom validator. **Manual browser visual review,
  actual WebGL render budget and site-wide security checks are still gates.**


Parent architecture: [astra-world-biome-master-spec.md](astra-world-biome-master-spec.md).
Baseline feature branch: feat/sids-world @ 70e21ce65a1c35278a380543f5798d0167c38a90.
Existing targeted contract: [joshua-basin-pump-track.md](joshua-basin-pump-track.md).

## 0. Authority, philosophy and non-goals

This contract is the newest authority **only for** the expanded Joshua bike course, real gap jumps, extended island landscape occupancy, additional desert/rainforest animals, authored underwater schools, UCSD-inspired golden tridents, and ingestion of the user's provided sloth photograph. The older master spec remains authoritative for the mountain, two cave systems, waterfall, coast/lagoon separation, foundational biomes, performance and visual character. Do not reinterpret this as permission to rebuild cave geometry.

A personal, explorably coherent island, not a theme park or a zoo. The page remains a portfolio with optional gameplay, not a progression-locked game. Every substantial discovery should have a grounded physical reason to be there. No collectible popups, invented autobiographical facts, neon achievement UI or new account requirement. Avoid one giant scene/component file gaining yet more responsibilities.

**Do not claim features are delivered simply because a geometry helper, test or preview build exists.** Visual QA and ground-truth scene captures are release blockers.

Protected invariants:
- Arcade tunnel, independent underground floor, three actual game destinations, cave mouth and mountain roof.
- Snowmelt -> stream -> waterfall -> plunge pool -> creek and the Paper Archive behind waterfall.
- Alpine skiing/tree runs, redwood and coastal habitats, the distinct cold kelp shelf versus tropical lagoon, dive-depth and reef clearance.
- Shasta's existing locomotion, face v4 almond-eye contract, natural coat and no harness.
- Existing photography/project links, keyboard/pointer navigation, quality reductions, low-motion fallback and ordinary site routes.

## 1. As-built inventory, exact numerical target

Currently lib/world/desertTrack.ts defines a capsule: center x=37, radius=5, north z=-43, south z=-13. Its analytical circumference is:
  L0 = 2 * ( -13 - (-43) ) + 2 * pi * 5 = 91.416 world units.
A 3x course must measure **L >= 274.25 units** along the actual sampled closed centerline. Target **300–330 units** to avoid rounding the result to barely 3x. Never count laps, repeats, shortcuts, or inaccessible detours toward the continuous full-loop length.

Current WORLD_BOUNDS: x[-92,94], z[-96,58]. The playable above-water land is roughly between coastlineX(z) near -34 and eastCoastlineX(z) near +58; outside those functions is water. This rectangular support model is not itself a finished island edge. Alpine/cave terrain lies to the west/north, rainforest occupies the far northeast, desert is on the east/north mountain shoulder. Important fixed attractions:
- Arcade mouth (16,-82), inner tunnel heading toward z~-63
- Fern Falls / Paper Archive around (-20,-30)
- Granite ridge near (8,-54)
- Desert region landmark (37,-29)
- Rainforest landmark (44,33), lagoon shore around x~58, z~13
- Desert climbing holds near (46..49,-21..-27)
- Existing desert talus groups near (52,-49), (53,-22), (53,-5)
- Existing 'desert-table', 'desert-hip', 'desert-step' are **solid sculpted mounds**, not authentic gaps.

Current worldRenderer.ts drives coral and marine animal meshes, including 34 independent tropical fish with separate elliptical motion. It does not implement coordinated shape-changing schools. The rainforest already has one sloth model, two macaws and two toucans; only the existing low-count canopy fauna is accepted as a starting point, not species/animation completion. Existing visualArchive.ts has photo-001..photo-049 and **does not** yet have the sloth image. The user supplied a genuine sloth photograph in the 2026-10-10 conversation; access to that binary in the implementation workspace needs verifying before ingestion.

## 2. Course geography and macro-composition

The threefold extension must use *previously unoccupied space* and reveal more of the dry mountain-to-scrub transition. Maintain a distinct desert domain. Preliminary planning envelope: x~24..55 and z~-60..+5, adjusted only after slope/water/biome sampling and screenshot surveys. Do not place the course across the arcade cavity, into the tropical forest, or through the lagoon surf.

Proposed 4-lane serpentine blockout, **not final coordinates**:
  Lane A: western dry-shoulder descent x~25, north z~-8 to south z~-58
  Turn A->B: south banked hairpin into x~33
  Lane B: return north toward z~-8
  Turn B->C: north banked hairpin into x~41
  Lane C: south toward z~-58 (technical jump line)
  Turn C->D: south hairpin into x~49
  Lane D: north toward z~-8 (faster flow line)
  Outer connector: arcing across the scrub margin north of those turns, back to lane A.
  Preserve min 7–9 units between adjacent straight centerlines to leave 3–3.5 units clearance on both sides.

This indicative envelope and routing provides the necessary number of long runs to approach ~300 units, but **geometry must be measured from the sampled smooth route, not asserted from this diagram**. Terrain, slope, water, neighboring biome, rock/cave and route-self-intersection audits can force relocation. The southern turns at z~-58 may be too steep/alpine on the western lane; sample and change the path rather than forcing unnatural desert terrain into the mountain. Optional compact scenic connectors are welcome; duplicated loops to game the length test are not.

Five visual course chapters:
1. **Dry shoulder gateway:** scenic long approach, widely spaced Joshua trees and granite, immediate recognition of a real dirt circuit.
2. **Pump/rhythm line:** current rollers, subtle dirt cross-fall and first safe rollable tabletop.
3. **Dry-wash gap:** actual eroded arroyo crossing with separated takeoff and receiving bank.
4. **Fallen Joshua gap:** a dead woody trunk/branch cluster in a shallow trough, physically below the rider line, with a distinct landing.
5. **Long return:** large berm, optional natural rock roll, and an outer scrub/transition lap returning to the beginning.

A walkable, low-gradient alternate path must route around EACH forced gap and join the main line without crossing jump runouts. All loops, bypasses and attractions remain accessible by foot. Distinguish the long full route from optional expert shortcuts visually but subtly: soil wear, berm geometry and logs, not floating arrows.

## 3. Replace oval-specific geometry with authored centerline

Implement the new route as one deterministic closed spline/polyline sampled into an arc-length table. A Catmull-Rom or piecewise cubic Hermite spline with validated tangent continuity is acceptable. The authored centerline, segment IDs, signed lateral offset and perpendicular tangent MUST feed:
- painted dirt tread and feathered banks
- ride support and camera angle sampling
- vegetation/rock/wildlife exclusion volumes
- jump approach/landing/bypass geometry
- automated lap progress, length and safety audits
- authored exploration-route markers

Suggested pure data module: lib/world/desertTrack.ts or lib/world/desertCourse.ts with:
  CoursePoint {x,z}
  CourseSample {point,tangent,normal,arclength,segmentId,curvature,grade,clearance}
  CourseSegment {id,kind,startS,endS,treadHalfWidth,exposure,decorativeBiome}
  CourseFeature {id,kind,centerS,laneOffset,width,approachLength,lipProfile,
                 gapStartS,gapEndS,landingLength,targetSpeed,minimumTakeoffSpeed,
                 obstacleKind,bypassId}

Numerical requirements:
- arc-length >= 274.25 and preferred 300..330
- closed centerline gap < 0.05 world units
- no unplanned self-intersections or overlapping ride corridors
- no discontinuous tangent or sharp elevation seam at generated spline knots
- track half-width nominal ~2.2; wider landings/berms require individually authored clearances
- nearest segment query via bounded spatial indexing; avoid O(route samples) inside every terrainHeight call
- deterministic output for same coordinate/seed, independent of frames and camera
- terrain cut/fill slopes verified at fine sub-meter samples and transition boundary, especially where the global terrain grid undersamples authored profiles
- use the 3D world mesh's sampled heights AND the analytic collision height as separate parity checks; no visible unsupported hovering.

Avoid the existing capsule approximation/desertTrackFrame as the route-distance authority after replacement. Current terrain/biome cyclic module dependencies deserve care: isolate pure route data and curve sampling so model.ts can import it without circular runtime imports.

## 4. Genuine 3D gaps: physics, terrain, visual support

A "gap" MUST have a lowered actual terrain trough / dry channel between visibly separated lip and landing, not a fake trigger across a continuous tabletop. Two required authored instances and one rollable option:

| Feature | Obstacle in gap | Skill | Fallback |
| --- | --- | --- | --- |
| Rollable tabletop | None | On-bike beginner progression | Roll across without auto-launch |
| Wash/arroyo gap | Dry braided wash and shallow eroded bank; optional damp patches, not a magical river | Medium | Signed dirt side trail/low bridge away from runout |
| Fallen-Joshua gap | Dead Joshua limbs/trunk, bleached wood debris in excavated depression | Advanced | Safe switchback around obstacle |

If a permanent river is desired later, require a separate credible watershed and water-source plan. The established alpine stream MUST NOT be rerouted into the desert. No involuntary fall deaths or hard resets.

Geometry contract: local track coordinates s (along) and n (lateral); piecewise smooth compactly supported cut/fill:
- gently rising in-run, discrete lip crest
- sharply visible **but continuous** drop to lowered gap floor
- realistic floor, sculpted banks and visibly higher landing lip/surface
- broad receiving slope, generous runout
- walls/obstacles only in gap's actual physical volume; decorative objects never intersect intended aerial trajectories
- support remains physical terrain under the pit; do NOT globally remove ground support on 2D footprint. Airborne state after lip is the mechanism for clearing it, with gravity and speed preserving arc.

Physics contract:
- existing rampImpulseAt and stepAirborne are allowed to evolve, but launch ONLY when a tire/rider crosses the correct oriented lip and speed gate; no launch from reverse, beside, in the bypass or midair
- launch amplitude and gap length must be calibrated against speed, gravity (stepAirborne), flight duration, collision and terrain slope. Specify target speed band, e.g. 6–10 units/s only after measuring actual bike speeds and integration step; do not hardcode until validated
- bike tires, rider, camera and landing are on identical authored physical support
- while airborne, passing above the pit or fallen log may not snap to lower terrain; under-jumping drops physically into the shallow channel, and rider can exit on foot or ride the bypass
- preserve keyboard steering, jump button, player mode transitions, Shasta following and click-to-navigate; gracefully prevent automated click-to-move route crossing a jump as if it were flat ground.
- no mandatory high-speed gap in the route to the photograph, climbing site, exit or other world content.

Visual testing: capture lip, pit and landing both from approach and side profile. Failing to see daylight/space between the takeoff and receiving bank is a rejection.

## 5. Joshua tree and desert ecology overhaul

A genuinely Joshua Tree-like impression, not a generic beige ground with green blobs:
- Trunks: warm weathered gray-tan woody grain at silhouette scale; dark narrow creases, irregular taper; 3–5 branching archetypes with bent asymmetrical arms.
- Crown: spiky narrow pointed radial leaves, layered desaturated olive/blue-green and pale yellow-green, darker skirts of dry hanging leaves. Avoid round spherical leaf clusters, palms, neon or repetitive equal-height clones.
- Scenery: pale coarse sandy-grus patches, light monzogranite, muted creosote greens, localized ochre dry grasses, occasional subtle small flowers. Large dune fields, saguaros and giant boulder piles are rejected.
- Placement: habitat suitability from biomeAt elevation/moisture/slope/soil and authored course exclusion; age-height clusters rather than uniform random scatter. Keep ~60–75% of main basin sightline open, with taller tree clusters away from jump landing sightlines.
- Variation is stable in world-space; no camera-induced new trees, clipping rosettes into trail or scale variants breaking silhouette.

Desert wildlife (authored sparse anchors, no roaming everywhere):
- fence/chuckwalla-style lizards bask on sun-exposed rock and dart into crevices
- desert iguana variant only if silhouette distinguishable
- sidewinder/rattlesnake or another locally plausible small desert snake coils in shaded soil pocket; movement is non-aggressive, no strikes at Shasta/player
- small ground squirrel or kangaroo rat, jackrabbit, one rare roadrunner/quail/raven distant pass
- optional desert tortoise as a hidden quiet encounter if the time budget allows.
- Prefer 2–4 reptile body archetypes with shared color/material variants rather than nine independent articulated animals.
- Confine habitat regions away from high-speed berms and collision runouts; no animal positioned as a hazard to be run over. Ambient animal behavior is nondestructive and does not incentivize chasing wildlife.

## 6. Rainforest: lush but species-identifiable ecology

Preserve Manuel Antonio/Costa Rica identity and current 3 rainforest planting bands. Richness comes from authored layers, not simply doubling polygon counts:
- overhead broadleaf crowns and buttress roots
- understory heliconia red/orange clusters, orchids/bromeliads magenta/yellow/purple accents, epiphytes, lianas and fern terraces
- canopy light pools and shadow, moist creek patches, clear passages and hiding spots
- do not plant tropical vegetation on Joshua terrain; one shared biomeAt sampler is authority.

Birds: current two macaws and two toucans are a starter, not an endpoint. Add distinct parrot types with credible anatomy: macaws with long tapered tails and wide wing profile; toucans with large directional bill; smaller parrots with short tail/compact posture. Color is selective: scarlet/blue/gold macaws, yellow/orange bills, emerald/moss green parrots. A few perch->look->short-flight beats are more useful than dozens of constantly circling birds.

Snakes:
- eyelash vipers: SMALL (readable when the user deliberately looks closely), optional yellow and green variants; recognizable brow/eyelash scale accents and slender prehensile branch grip; perched only, no attack behavior
- boas: larger muted patterned thick-bodied coils crossing a horizontal limb, head/body continuous, branch attached; very slow breathing/head movement
- **anaconda**: anacondas are South American, not indigenous to Manuel Antonio, and are semi-aquatic more than typical canopy vipers. To honor the requested visual without misrepresenting the setting, use at most ONE rare, clearly fictional "South American river guest" encounter at a separate wet tributary/lagoon-edge pocket, or reserve this animal for a later South American mini-biome. Do not describe it as a locally observed Costa Rica snake.
- Snakes never block player pathways, force combat, or teleport into view; attach to actual trunk/branch topology, avoid free-floating bodies.
- Reduce cost by shared tubular skeleton profiles and only animating visible animals.

Sloth/photo authority: The user's uploaded actual sloth image shows a pale tan face with dark mask, long gray-beige shaggy fur, limbs clasped to a broad lichen/moss-speckled trunk and one forelimb stretched upward and around it. Replace generic hanging egg-shaped silhouette with a low visible side-on trunk-hugging hero at an accessible viewpoint. Fur texture/proportions may remain stylized, but outline and facial palette should be recognizably informed by the image. No generic smiling/cartoon expression.

Photo ingestion is a separate provenanced media task:
1. Locate the *actual* uploaded binary in the live implementation workspace. No made-up path, no substitute internet sloth, no faux photograph.
2. Derive optimized web/thumb variants, retaining original photo aspect ratio, removing EXIF GPS and retaining source provenance.
3. Add one real manifest entry in src/data/visualArchive.ts only after files are physically committed/served; use a nonconflicting ID.
4. Add a single accurate photo-memory discovery near the hero sloth. Short truthful caption; do not assert a specific date/place unless provided.
5. Preserve direct photography access and accessibility alt text. If original photo cannot be obtained by the build environment, ship only the modeled hero and mark the photo attachment as blocked pending asset handoff, not done.

## 7. Underwater schools: convincing pack motion and morphing formations

Current 34 tropical fish are individually orbiting; replace/add authored **school groups** whose fish follow coherent group velocity and shape constraints. Target three distinctly readable experiences:
- **bait ball**: school contracts into a roughly spherical swarm then expands; individual fish still point along local tangent
- **ribbon / spiral**: traveling corkscrew or crescent, follows reef channel without impossible motion through rocks
- **split-and-reform**: one shoal parts around a coral bommie or ray path then merges.

Also allow a cold kelp-school of slender anchovy-like fish, not the tropical palette duplicated across both coasts. Avoid perfect static geometric rings or synchronized formation snapping. Use bounded phases and smooth interpolation over seconds, not a single-frame morph.

Implement lib/world/schools.ts as a deterministic state update and tests:
  SchoolSpec {id,marineZone,centerPath,bounds,count,phaseSeed,palette,forms}
  SchoolState {center,velocity,shape,phase,fish[]}
  stepSchool(state,dt,visibleObstacles): SchoolState
Prefer seeded polar/ribbon coordinates plus cohesion/separation/alignment rather than naïve O(N^2) pairwise boids per fish. If neighbor interactions are necessary, spatial hashing or per-school coarse bins. Avoid React state per fish. Use shared fish geometry/instanced body/tails/fins, and update matrices at a bounded cadence only while zone visible.

Provisional active density, to be profiled rather than blindly committed: 2–4 schools, 20–45 fish per school, with level-of-detail thinning as needed. Keep fish above seaFloorHeight with depth clearance and below SEA_SURFACE by a visible margin, inside waterZone matching school habitat; never pass through coral, kelp trunks, shoreline or diver. Turning radius/acceleration and minimum separation should be tested. Player motion cannot drive them infinitely away or trigger jitter.

## 8. Golden UCSD-inspired tridents: grounded secrets, not UI collectibles

Three quiet, visually high-quality golden trident sculptures inspired by the UC San Diego trident symbol, NOT a claim to be historical artifacts, official marks or the exact protected UCSD seal:
1. kelp shelf: partly set in sand/rock near a kelp break with reachable dive envelope
2. lagoon reef: tucked in sandy channel adjacent to, not piercing, a coral bommie
3. hardest one: discoverable underwater grotto/stone recess only if that pocket exists in the actual terrain and safe swim/depth audits pass.

Geometry: custom three-pronged taper, central spear, two swept lateral prongs, slim shaft with muted warm metal/bronze specular response; approximately human-scale, no neon yellow or emissive flash. Authored shared mesh/material, instanced if identical; subtle golden glints only in appropriate sunlight. Avoid placing in shallow beach surf, live coral or tight egress gaps.

Discovery semantics: proximity plus actual underwater depth, optional focus/look or existing interact action. On discovery reveal one unobtrusive factual connection to UCSD Bioengineering / research projects or /about, no external brand mark and no points/currency/completion requirement. Object remains in place after discovery; do not "collect" or imply touching real sea life. Build accessible equivalent through conventional website navigation for users unable/unwilling to dive.

Extend discovery data by a discriminated content ID or 'WorldArtifact' table with actual 3D position incl y, type, link, safeDepth and zone. Current nearbyDiscovery checks x/z alone; depth/dive-mode must be included for underwater objects, while preserving the original legacy point-based signature/call sites. Raycast hit tests must not expose a trident on land or through the sea surface.

## 9. Fill the *whole* island intelligently

"Fill all areas" means a planned landscape occupancy system, not covering every patch with shrubs. Build a small deterministic **occupancy audit** across the land/nearshore domain first; classify cells (e.g. 6–8 unit sampling) by primary/secondary biome, slope, moisture, visible-from-route, cave/water/shoreline exclusion, path, authored discovery and scenery density.

Coverage categories by cell:
- active ecological habitat (vegetation, rock structure, fauna)
- active gameplay (sport course, climbing, parkour, reef swim)
- discoverable destination (photos, project markers, paper archive, artifacts)
- deliberate visual negative space (vista, open desert sightline, bare granite, sandy beach, open water)

Every *reachable* land cell should have a justified category; intentional scenic emptiness is valid. Fail arbitrary empty procedural-plane regions with no visual rationale. Flag unfilled long corridors from usual camera vantage using screenshot heatmaps, not only numerical labels.

Regional treatment:
- west rocky surf/kelp: tide rocks, kelp canopy, animals and trident; maintain cold identity
- redwood lowlands: fern understory, deadwood, variable trunks, subtle wildlife and walkable clearings
- west/snow ridge: altitudinal conifer change, rock ribs, open ski bowl, drainage, cave roof protected
- southwest mixed valley/creek: scrub meadow and true lower-flow greenery; stream banks remain passable
- east dry Joshua basin: expanded course, clustered trees, wash/grus, lizards and snakes, open vistas
- central scrub/transition: dry woodland, bunchgrass, weathered rocks, authored ridge paths; provide world-scale spatial breathing room
- northeast rainforest: bright canopy flowers, sloth photo viewpoint, parrots, toucans, vipers and boas, dense canopy with walkable light pockets
- east tropical beach/lagoon: coherent sand-to-coral sequence, schooling fish, underwater trident
- outer world boundary: coast/water fade and distant believable silhouettes, not suddenly visible square cutoffs.

Do not increase every biome's vegetation count by a global multiplier. Existing objects remain stable across camera movement; introduce deterministic chunking/culling without erasing an adjacent visible biome in one frame. Do not move the user's meaningful destinations solely to fill gaps.

## 10. Architecture and file ownership

Prefer these small modules, preserving existing function signatures through adapters where possible:

| Path | Responsibility |
| --- | --- |
| lib/world/desertTrack.ts | pure course, arc-length and nearest-centerline sampler, jump descriptors |
| lib/world/gapPhysics.ts (new) | physical gap profile, flight viability, runout/bypass classification |
| lib/world/model.ts | apply authored terrain to global height; keep caves and hydrology unchanged |
| lib/world/activities.ts | route sport clearance, speed/heading launch, bike landing and safe bypass |
| components/world/worldRenderer.ts | integrate only; gradually extract bulky geometry and animation code |
| components/world/worldDesertProps.ts (new) | Joshua variants, bleached logs, dry wash and desert animal statics |
| components/world/worldHabitats.ts | spatially bounded ecosystem vegetation and occupancy |
| lib/world/ecology.ts | species anchors, biome correctness, habitats and seeded behavior |
| components/world/worldCanopyFauna.ts (new) | shared parrot/macaw/toucan/snake/sloth geometry & low-cadence motion |
| lib/world/schools.ts (new) | deterministic fish formation behavior independent of Three.js |
| components/world/worldMarineDiscoveries.ts (new) | batched trident geometry and depth-aware discovery visuals |
| components/world/worldReef.ts | reef collision bounds/school safe volumes, geometry lifecycle |
| lib/world/model.ts + content/discovery layer | preserve ordinary region/photo interactions; add depth-aware artifact discovery |
| src/data/visualArchive.ts + public/visual-archive/... | genuine sloth original-derived, optimized photo + thumbnails |
| docs/world/ | image/architecture evidence, occupancy and runtime budget report |

Do not pack new behavior directly into the current ~4,184-line worldRenderer.ts. Build pure math/behavior modules with inexpensive unit contracts and thin runtime adapters.

## 11. Performance, accessibility and safety gates

Preserve the parent master spec gates:
- **<100 draw calls** at worst combined boundary view
- target <=70 typical active biome, <=90,000 visible triangles, <=100 renderables
- scenes/roots culled by frustum + camera-aware distance, not player biome identity; no obvious pop when traveling quickly
- current adaptive DPR and hidden-tab/pause/reduced-motion behavior preserved
- no new heavyweight 3D physics or asset downloads without documented budget approval
- no unbounded fish/boid pair scans, allocations each frame, or large per-animal components
- all acquired GPU resources disposed on unmount; WebGL context loss/recovery and mobile portrait viewport tested
- maintain keyboard/pointer focus, no mandatory audio, optional exploration, direct traditional link path, readable captions and reduced-motion static wildlife.

Explicit performance instrumentation: draw calls, geometries/materials, triangles, GPU memory proxy, script/update ms (especially schools), camera p50/p95 fps across quality tiers at desktop and mobile. Include cold load versus post-travel measurements and compare to baseline at same camera/viewport. If a budget fails, implement LOD/instancing/chunking rather than ignoring the budget.

## 12. Evidence-driven test plan

**Pure geometry and route tests**
- centerline length >=274.25; ideally >=300, without repeated laps; closed and finite
- tangent/grade/curvature sampled densely; at least 3 separated chapters, no unintentional lane crossing
- endpoint/bridge/cave/water/reef exclusion (world_bounds + biomeAt + collision)
- deterministic geometry, terrain/material parity and stable spatial nearest-centerline queries
- 3+ complete simulated laps both directions only where physically allowed, with identical starting seed; walking access to bypasses.

**Gap and physics tests**
- visible lip->real depressed channel->visible landing->runout for 2 distinct authored gaps
- wrong-direction launch absent, slow approach safely rolls/stops, safe speed clears gap
- fast frame step cannot skip narrow trigger or cause multiple launches
- underjump physically contacts dry wash without a stuck/falling-forever state
- fallen Joshua physical model lives below intended flight arc and is never within the safe runout
- click-to-navigate and foot mode use bypass and do not pretend the gap is solid tabletop.

**Wildlife and photo tests**
- habitat/biome anchor validity, low active counts, no scenery intersection
- Joshua silhouette/palette variants; snake and lizard distinct from rocks
- eyelash viper visible scale/prehensile grip, boa coils attached to branch
- South American anaconda explicitly separated as fiction/guest, not incorrectly attributed to Manuel Antonio
- birds animate only while visible; sloth pose/color matches user's image by human visual signoff
- photo provenance, EXIF removal, valid manifest entry, actual available image bytes, responsive rendition and real photo viewer.

**Marine tests**
- coherent shape-change state continuity and max acceleration/tail alignment
- no fish in land/air, coral/kelp penetration, reef-floor collision or diver collision
- per-school bounded counts/CPU and deterministic updates; static reduced-motion view
- 3 tridents are submerged, reachable, do not pierce coral, use accurate interaction depth/range and actual educational links
- sunken artifact discovery is not triggerable from land/surface just by sharing x/z.

**Island coverage tests**
- produce heatmap of reachable empty land patches before and after change
- every region has at least one meaningful route, ecosystem landmark or explicitly classified open area
- no new island-edge cutoffs, cave blockage, waterfall discontinuity or island-wide habitat pop
- multi-view screenshot diff at biome boundaries and from mountain overview.

**Browser release matrix**
- desktop mouse/keyboard, touch/mobile, low-DPR, reduced motion, pause/resume, context loss, water mode changes
- 3 desert line views from riding speed, 2 gap side views, snake/lizard closeup, tree variants, sloth closeup matching reference, rainforest upper/lower canopy, bait-ball/ribbon/split school, 3 trident discoveries
- verify all links work and return exactly to exploration state.
- use real browser screenshots and a reviewer acknowledgement; green typecheck/unit tests alone are not release-ready.

## 13. Work plan, ownership and dependencies

**Tranche 0: measured island audit (must pass before expanding terrain)**
- capture current screenshots and dynamic perf baseline
- compute base loop's 91.416 length in a test and occupied/empty cell map
- inspect actual photo bytes; decide whether media ingestion can proceed
- verify world CI separate from unrelated World Loom 1000-scene audit: that tool does NOT validate this island's jumping/wildlife.
Deliver: snapshot + occupancy CSV/JSON, terrain hazard map, traceable task breakdown.

**Tranche 1: pure 3x centerline engine**
- extract route samplers and arc-length, draw blockout route, keep old landmarks functional
- test length/corridor/terrain and review aerial screenshot before adding gameplay props.
Deliver: 3x route with no new jump risks.

**Tranche 2: two authentic gap jumps + tabletop**
- geometry and physics parity, bypasses, dry wash, fallen Joshua scenery, tests.
Deliver: three rideable skill levels and recorded browser traversals.

**Tranche 3: desert visual ecology and island scrub infill**
- higher-quality Joshua branches/crowns/materials; reptile/animal anchors; landscape coverage audit and cleanup.
Deliver: recognizable Mojave ambience and intentionally filled unused corridors.

**Tranche 4: rainforest biological richness and user's sloth photo**
- vivid flora, existing birds upgraded + parrots, vipers, boa, single anaconda guest if ecological separation credible, photo-informed sloth and valid media ingestion.
Deliver: convincing, performant exploration sequence in Manuel Antonio composite.

**Tranche 5: schooling fish and UCSD-inspired artifacts**
- bounded formation controller, three underwater morphing behaviors, golden trident discovery with depth-aware interactions.
Deliver: visually discernible school morphs and three real reachable secrets.

**Tranche 6: integration/visual quality/release**
- isolate/prune old visuals; optimize mesh and draw budget; mobile/browser matrix; fix regressions; merge only after all gates pass.
Deliver: QA report, preview links/screenshots, clean branch/PR and explicit release decision.

Each tranche should be separately reviewable and committed. Agent must report tests actually executed, screenshots taken, measured fps and known issues. Never silently bypass the npm security audit. Do not merge to the production branch solely on this scope document.

## 14. Definition of Done

This milestone is accepted only when:
1. A unique contiguous full-lap path measures >=274.25 units, is visibly broader geographically, and avoids protected assets.
2. Two distinct physical gaps (arroyo and fallen Joshua) plus a safe tabletop can be ridden or bypassed; wrong/under-speed behavior is tested.
3. Joshua trees have recognizable woody/spiky silhouettes and an ecologically plausible muted multi-material palette; desert wildlife is present but sparse.
4. Rainforest has distinct macaws, parrots, toucans, eyelash vipers, boa, and a visually photo-faithful sloth; any anaconda is geographically contextualized.
5. Genuine sloth image is committed to the archive and opens in a real viewer **only if source bytes are available and verified**; otherwise explicitly reported as outstanding.
6. Reef has coherent pack fish with bait-ball, ribbon and split/reform shapes; three modeled golden tridents are safe to locate underwater and depth-gated.
7. Previously blank reachable areas have intentional biome/negative-space classification evidenced by an occupancy heatmap and representative screenshots.
8. No regressed cave, waterfall, ocean separation, Shasta, direct site links, mobile controls, accessible browsing or renderer lifecycle.
9. Full dedicated world CI, targeted browser review, production build and stated visual/perf budgets pass. Unrelated site-security blockers remain visible, never suppressed.

This contract defines intended implementation, **not completed features**.
