# World expansion implementation status

Implementation candidate on `feat/sids-world`. This is not a visual acceptance record.

## Implemented

- Normalized, seeded land-biome fields shared by ground color and habitat placement, with continuous desert/scrub/forest/alpine weights.
- Joshua basin destination: warm granite formations, slot passage, Joshua trees, creosote, cholla and ocotillo subzones; sparse local wildlife.
- Rainforest destination: broadleaf canopy, palms, buttress roots, vines, fern understory, low-count canopy and ground animal silhouettes.
- Redwood understory and deadwood; cold-water kelp remains separate from the warm lagoon.
- Larger overlapping mountain masses, flat Arcade floor, continuous local cave shell/shoulders, offset throat, three left/back/right game niches and ceiling lantern.
- Snowmelt ribbon, waterfall curtain, plunge pool and outflow; second flat chamber opens the canonical Paper Archive using publication records from the existing generated graph.
- Nine procedural coral forms in garden/bommie/channel/slope compositions and a three-draw swimming turtle; shared ray wing movement.
- Ten ramps and twelve classified fallen logs. Six reserved route corridors protect approaches/runouts from procedural vegetation. Planks and vehicle support share ramp surfaces.
- Shasta remains harness-free with the existing natural coat/gait. Timed pursuit commits to return, reunion and cooldown; faster catch-up and local obstacle detours.
- Three photo discoveries reference existing archive entries without invented locations. Projects, games, papers and photographs retain canonical routes/data.

## Integrated contract corrections

- Joshua crowns have five deterministic branching variants, with pointed rosettes, dry juniper and ribbed barrel cacti. Rainforest midstory, leaf litter, trunk epiphytes and distinct perched monkey/hanging sloth silhouettes use existing geometry batches.
- Beach vegetation tapers continuously. Soil, sand, rock and slope suitability constrain placement; shoreline materials blend into their respective cold or warm marine habitat.
- Ramp launch strips match deck width and lip location. Airborne motion integrates in world space; the legacy ski kicker now faces a smooth open-bowl landing clear of the Arcade excavation.
- A sparse winding gravel wash opens the desert approach. Three additional granite ledges support a reachable climbing sequence with shared rendering/collision data.
- Cave and waterfall floors, shell support, basin, lip, pool and outflow now share tested geometry/height contracts. Both cave collision routes permit entry and exit.
- Sharks and cold-water fish use single-draw profiled bodies and swept fins; tropical fish retain instancing, and rays deform through subdivided wings with preserved central thickness.
- Regional panels select relevant existing photographs. Navigation labels match canonical destinations, and the Paper Archive orders canonical publications newest first.

## Verification and remaining acceptance

The integrated candidate passes 689 unit tests, lint, TypeScript, the production build and the bundle budget (0.57 MB compressed client JavaScript in the analyzer report). Automated checks cover biome normalization/continuity, flat cave floors, upstream drainage descent, sport roles, ramp surfaces, canonical content, and chase/return behavior. The existing browser audit now includes the new destinations, offset tunnel traversal and individual side-wall game selection; its budget thresholds are unchanged.

Local visual/browser qualification is pending: the environment rejected local browser sockets, and cloud-browser approval review was blocked by the session usage limit. No screenshots or runtime performance measurements from this candidate are claimed.

Before release, run the browser audit on the exact committed candidate and inspect approach, threshold, chamber, snowmelt, behind-waterfall, desert, rainforest, lagoon and mobile captures. Confirm uninterrupted cave entry/exit, all three spatial game selections, Paper Archive discovery, rider clearance and Shasta reunion around obstacles. Measure combined neighboring habitats against the unchanged <100 draw-call gate and preferred triangle budget.

Remaining authored habitat work includes the rainforest creek/wet-pocket and overlook composition; hero fauna remain static.

The master contract remains authoritative. Fine-grained plant/animal silhouette quality, hero-animal articulation, complete camera occlusion behavior and terrain-shaped landings require that visual/traversal acceptance; numerical tests are not substitutes. Keep PR #91 draft until these gates pass.
