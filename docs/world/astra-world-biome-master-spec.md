# Astra master specification — Sid's World biome, mountain, cave, waterfall, ecology, and reef redesign

Status: **implementation contract for Astra**
Authoring intent: replace the current accumulation of scenic primitives with a coherent island-scale world architecture.

## Frozen baseline and authority

Astra should begin from the current World Mode branch, but the visual design in this document takes precedence over the current cave/waterfall implementation.

The current runtime cave is **not** an accepted design target. It may be replaced wholesale.

The existing Shasta locomotion system is already qualified and should not be rewritten. The current Shasta visual contract is also explicit:

- male husky mix
- lean athletic proportions
- amber eyes
- pink-brown nose
- continuous relaxed plume tail
- **no harness rendered in World Mode**
- **no volumetric tan eyebrow/crown bubbles**
- forehead/skull silhouette stays clean
- coat markings must not be implemented as bulbous geometry

Any later world work must preserve Shasta's current movement gates.

---

# 1. Product goal

Sid's World should feel like one explorable autobiographical island with large, legible ecosystems, closer to the biome readability of Valheim than to a theme-park collection of props.

The world should be readable at three levels:

1. **Island scale** — the player can orient by mountain, coast, forest, desert, rainforest.
2. **Biome scale** — each region has its own terrain, vegetation, wildlife, light, color, and activities.
3. **Discovery scale** — caves, reefs, photos, videos, publications, and games reward exploration.

The interface remains quiet. Visuals and movement should do the storytelling.

---

# 2. Island biome coverage

Target biomes:

1. **Alpine mountain / snow**
2. **Santa Cruz redwood forest**
3. **California coastal scrub + beach**
4. **Cold-water kelp forest / rocky reef**
5. **South Pacific tropical lagoon / coral reef**
6. **Manuel Antonio rainforest**
7. **Joshua Tree / Southern California desert**

The world should not use hard rectangular biome borders.

Add a reusable biome sampler:

```ts
export type BiomeId =
  | "alpine"
  | "redwood"
  | "coastal-scrub"
  | "cold-beach"
  | "kelp"
  | "lagoon"
  | "rainforest"
  | "desert";

export type BiomeSample = {
  primary: BiomeId;
  secondary?: BiomeId;
  blend: number; // 0..1
};

export function biomeAt(point: Point): BiomeSample;
```

Use weighted distance fields / smooth blend regions so:
- ground color transitions gradually;
- vegetation density tapers naturally;
- fog and ambient color shift gradually;
- wildlife does not stop exactly at an invisible border.

Recommended starting transition widths: **6–15 world units**, refined by terrain scale and the shared transition contract in sections 16.6–16.9.

---

# 3. World topology

Conceptual arrangement:

```
                         NORTH

                    ALPINE SUMMIT
               /                     \
       REDWOOD FOREST             DRY RIDGE
            |                         |
       COLD COAST               JOSHUA TREE
       / KELP                    DESERT
            \                     /
             CENTRAL MEADOW / PATH
               \               /
                 RAINFOREST
                    |
             TROPICAL BEACH
                    |
              LAGOON REEF

                         SOUTH
```

Relationships matter more than exact coordinates.

Required geographic logic:

- redwood forest climbs toward the alpine mountain;
- alpine snowmelt feeds the waterfall drainage;
- dry mountain shoulder grades into desert;
- desert grades into Southern California scrub;
- rainforest grades into tropical beach;
- tropical beach grades into warm lagoon;
- California coast remains distinct from warm lagoon;
- **Arcade cavern remains at its current semantic location** and the mountain geometry expands around it.

---

# 4. Mountain redesign

## 4.1 Dominant vertical anchor

The mountain should become the dominant silhouette of the island.

Increase visual height approximately **35–60%** over the current main ridge, but do not simply multiply one Gaussian height field.

Build the mountain from multiple overlapping terrain fields:

- main summit
- secondary shoulder
- open bowl
- backside bowl
- rocky chute
- tree-line shelf
- snowmelt drainage
- dry shoulder toward desert

The summit should read as broad alpine mass, not a needle.

## 4.2 Alpine visual bands

Use altitude and exposure to create bands:

### Lower mountain
- mixed conifers
- exposed granite
- grass
- fallen logs
- bike routes

### Mid mountain
- denser conifers
- snow patches
- tree ski line
- exposed rock ribs

### Upper mountain
- broad snow cover
- sparse trees
- granite/talus
- open bowl
- visible summit

NPS Yosemite material is useful visual grounding for high-elevation Sierra-style habitat: exposed granite, sparse high-elevation trees, talus, pika/marmot/ground-squirrel scale wildlife.

Reference:
https://www.nps.gov/yose/learn/nature/mammals.htm

---

# 5. Ski / bike mountain route plan

Astra should author actual lines rather than letting random trees define gameplay.

## 5.1 Open bowl

- broad upper snow field
- moderate initial pitch
- one rollover
- one medium kicker
- generous landing
- rejoins lower mountain

## 5.2 Tree run

- steeper
- clear gaps
- alternating left/right line choice
- 2–3 fallen-tree visual features
- no unavoidable trunk collisions
- one optional log slide

## 5.3 Technical chute

- narrower
- exposed rock sides
- steeper grade
- one natural drop
- reconnects to bowl/lower run

## 5.4 Jump line

Three authored jumps:
- small
- medium
- large

Every jump must have:
- visible takeoff
- mechanical trigger using same source data
- landing slope aligned with launch vector
- enough runout

## 5.5 Lower bike line

Below snowline:
- natural rock roll
- berm-like terrain shoulder
- fallen log jump
- optional timber feature
- return path to central world

Visible geometry and mechanics must consume the same authored feature definitions.

---

# 6. Fallen-tree system

Increase environmental fallen trees, but classify them.

```ts
type FallenTreeRole =
  | "scenery"
  | "traversal"
  | "sport";
```

Recommended counts:
- 3–5 large redwood logs
- 2–4 alpine conifer logs
- 1–2 ravine bridge logs
- only selected logs are grind/jump features

Do not make every log interactive.

---

# 7. Arcade cave — required redesign

## 7.1 The current failure

The current cave reads as:
- added boulders placed on top of the mountain;
- an arch/shelter rather than negative space;
- too shallow;
- too exposed;
- game carvings visible too early;
- awkwardly cramped.

**Do not iterate this by adding more boulders. Replace the underlying cave construction.**

## 7.2 Core experience

The Arcade cave must feel **carved into the existing mountain**.

Player sequence:

1. arrive on the backside of the mountain near the current cavern region;
2. see a dark natural opening recessed into the mountain face;
3. walk across a flat threshold;
4. enter a short tunnel;
5. pass under continuous rock ceiling;
6. enter a small interior chamber;
7. only then discover the three carved game panels.

Games must not be readable from outside.

## 7.3 Preserve location

Keep the current semantic cavern location.

Do not move the destination to an easier spot.

Instead:
- enlarge/backfill the mountain shoulder around the cavern location;
- locally reshape terrain;
- embed cave shell into that mountain mass.

## 7.4 Heightfield limitation

The global terrain heightfield cannot create an overhang.

Therefore implement a **local mountain shell** for the cave.

Preferred approach:
- custom `BufferGeometry`;
- tunnel centerline;
- 6–10 irregular cross-section rings;
- each ring defines floor edge, wall, shoulder, crown, opposing shoulder, opposing wall;
- connect rings into a single continuous shell.

This creates a real ceiling and sidewalls without runtime CSG.

Use deterministic low-frequency vertex distortion so it looks carved/weathered rather than mathematically cylindrical.

## 7.5 Exterior rock language

Use the user's supplied Joshua Tree / desert rock references as shape language:

- rounded weathered masses
- broad granite domes
- joint lines
- intersecting rounded blocks
- occasional sculptural stack
- large forms partially buried in terrain
- narrow seams/passages

NPS describes Joshua Tree's characteristic formations as jointed monzogranite rounded by weathering and later exposed as stacked boulder piles.

Reference:
https://www.nps.gov/jotr/learn/nature/geologicformations.htm

The cave mountain remains alpine/granite in color, not orange desert rock. Borrow **shape language**, not desert palette.

## 7.6 Cave dimensions

Target:

- entrance width: **5–7**
- clear entrance height: **4–5**
- tunnel length: **7–10**
- chamber width: **11–14**
- chamber depth: **8–11**
- chamber height: **5–7**

Floor:
- target slope: 0–4°
- hard maximum: 6°

Camera must fit behind the explorer without clipping roof/walls.

## 7.7 Flat floor contract

The visible cave floor can look irregular, but collision must be calm.

Implement either:
- a local cave-floor height override, or
- dedicated collision/floor surface inside cave footprint.

No:
- large threshold rocks
- terrain spikes
- mountain heightfield intersecting floor
- large steps

## 7.8 Entrance composition

Outside view:
- recessed darkness
- mountain rock continues over entrance
- no freestanding arch
- no title/game text
- no glowing game panel
- subtle warm light deeper inside

Navigation should land the player at an **approach point outside** the entrance.

Expected time from menu jump to chamber: **5–12 seconds walking**.

## 7.9 Interior lantern

One small ceiling lantern.

Visual:
- dark metal frame
- warm emissive core
- one warm point light
- restrained radius
- no blown-out orange cave

Optional cool entrance fill.

## 7.10 Game layout

Do **not** place all three game names as stacked rows on one wall.

Use three separate carved niches:

- Game 1: left wall
- Game 2: rear wall
- Game 3: right wall

Each:
- title carved into rock
- one subtle symbolic rune
- large invisible interaction hit area
- enough space to walk toward it

Separation target:
- 3–5 world units center-to-center, and/or
- 35–70° viewing-angle separation

Existing `/arcade/*` routes remain canonical.

No game runtime or iframe inside the cave.

## 7.11 Cave telemetry / tests

Add:

```
data-cave-inside
data-cave-depth
data-cave-panel
data-cave-lantern
```

Gates:
- `gazeGame === ""` outside threshold
- `data-cave-inside=true` only after entrance
- all three games individually selectable
- selecting one does not resolve to neighbor
- player can walk in/out without collision
- camera does not cross cave wall
- draw-call gate remains <100

Required screenshots:
1. mountain backside approach
2. entrance
3. threshold
4. tunnel
5. chamber wide
6. each individual game panel

---

# 8. Snowmelt stream and waterfall redesign

## 8.1 Hydrology story

Water must visibly originate from snowmelt.

Required sequence:

```
upper snowfield
  ↓
melt basin
  ↓
small alpine rill
  ↓
rock-lined mountain stream
  ↓
mountain lip
  ↓
waterfall
  ↓
plunge pool
  ↓
lower stream toward forest
```

The player should be able to visually trace the drainage uphill.

## 8.2 Snowmelt source

Near upper snow:
- shallow melt basin
- wet/darker rock
- narrow first-order stream
- snow-edge transition
- occasional stones split flow

No water should appear from nowhere immediately above waterfall.

## 8.3 Reusable water-ribbon module

Create:

```ts
type WaterRibbonSpec = {
  points: readonly Vec3[];
  widths: readonly number[];
  flowSpeed: number;
  opacity: number;
};
```

Renderer:
- low-segment strip/spline geometry
- shared material
- slight animated UV/vertex shimmer if cheap
- white foam only at local high-energy sections

No water physics required.

## 8.4 Waterfall

At lip:
- stream narrows
- one main curtain
- 1–2 side strands
- transparent segmented strips
- wet darkened rock
- mist/splash at bottom only
- plunge pool
- visible outflow

Do not render as one rectangular blue box.

---

# 9. Secret waterfall cave — Paper Archive

Behind the main waterfall should be a second discoverable cave.

## 9.1 Character

Different from Arcade cave:
- smaller
- cooler light
- wet rock
- water noise implied visually
- hidden behind curtain
- quiet research space

## 9.2 Access

Player:
1. reaches plunge-pool area;
2. sees dark recess through waterfall;
3. walks behind waterfall edge / through non-solid curtain;
4. enters flat chamber.

Waterfall itself must not be a collision wall.

## 9.3 Dimensions

- hidden opening width: 3.5–5
- chamber width: 7–9
- depth: 5–7
- height: 4–5

## 9.4 Publication archive

Use existing canonical content:

- route: `/publications`
- data: `data/manual/publications.yaml`

Do not duplicate publication metadata in world code.

Interior:
- 3–5 carved stone paper tablets
- subtle waveform/neural glyphs
- one clear **Paper Archive** discovery
- optionally resolve individual tablets to existing publication detail behavior if already available

Minimal copy only.

## 9.5 Waterfall cave tests

Screenshots:
1. snowmelt basin
2. upper stream
3. stream approaching lip
4. waterfall exterior
5. waterfall with visible recess
6. behind-water view
7. paper chamber
8. plunge pool/downstream

Gates:
- water path is topologically continuous
- paper discovery cannot trigger outside cave
- `/publications` returns 200
- enter/exit without clipping
- waterfall curtain non-blocking

---

# 10. Animal realism architecture

Goal: each animal should be recognizable by silhouette at gameplay distance.

"Realistic" means:
- correct body plan
- plausible proportions
- appropriate appendages
- characteristic color blocking
- movement consistent with anatomy

Not:
- photoreal fur
- high-poly rigs everywhere
- one material/draw call per animal

## 10.1 Shared archetypes

Build reusable geometry families.

### Small mammal

Use for squirrel, mouse/rat, rabbit.

Common:
- smooth torso ellipsoid
- head ellipsoid
- muzzle
- ears
- implied/four limbs
- species tail

**Squirrel**
- slim body
- pointed face
- small ears
- large arched plume tail
- bounding/hopping motion

**Mouse / woodrat**
- round ears
- pointed muzzle
- thin tapering tail
- low scurry

**Rabbit**
- large hindquarters
- long paired ears
- tiny round tail
- hop compression/extension

### Lizard

- long low torso
- triangular head
- four splayed legs
- tapering tail
- short sprint / pause / bask

### Bird

Reusable for quail, toucans, macaws:
- body
- head
- beak
- wing masses
- tail fan
- simple legs

Birds should not be a body blob plus cylinder tail.

### Fish

Shared fish archetypes:

1. fusiform schooling fish
2. deep-bodied reef fish
3. rounded parrot/wrasse-like fish
4. elongated kelp fish

Required body parts:
- smooth body
- narrow caudal peduncle
- tail fin
- dorsal fin
- optional pectoral fins
- eyes

Use instanced schools.

### Shark

- fusiform body
- tapered snout
- dorsal fin
- paired pectorals
- narrow caudal peduncle
- forked / heterocercal-looking tail
- blacktip-specific tips where relevant

Leopard shark should include dark dorsal patterning if achievable through low-cost instances/material variation.

### Ray

Replace four-sided flat circles.

Create one shared ray wing geometry:
- diamond/wing body
- central thickness
- curved leading edge
- tapering tips
- long tail

Variants:
- manta: broad wings + cephalic lobes
- eagle ray: pointed wings + spotted upper surface
- stingray: rounder body + long thin tail
- cold-water bat ray: rounded triangular wings

Use gentle wing undulation.

### Sea turtle

New module:
- domed shell
- flatter underside
- head/neck
- long front flippers
- shorter rear flippers
- 2–3 shell patches/pattern regions

Motion:
- slow arcs
- front flipper stroke
- occasional depth change

### Frog

For rainforest:
- compact body
- broad head
- large eyes
- folded long hind legs
- small forelimbs
- rare hop

### Monkey / sloth hero

Low count only:
- torso/head/limb hierarchy
- branch attachment
- slow deterministic animation
- no full skeletal rig requirement

---

# 11. Behavior by species

- squirrel: bound → pause → investigate → flee from Shasta
- mouse/rat: scurry low, sharp direction change
- rabbit: hop
- lizard: sprint-stop-bask
- quail: ground walk + short flutter
- fish: coherent schools + slight phase offsets
- sharks: steady patrol + slow banking
- rays: glide + wing pulse
- turtles: slow flipper stroke
- jellies: bell pulse
- octopus: slow arm sway / color not required
- eel: segmented undulation
- frog: mostly stationary + rare hop
- birds: perch → hop → short flight
- monkeys: canopy traverse
- sloths: slow idle

Shasta may investigate/chase small animals but never catches or attacks them.

---

# 12. Cold-water California marine biome

Use Monterey Bay Aquarium ecosystem references for visual grounding.

Kelp forest should include:
- giant kelp
- rockfish
- anchovy schools
- leopard sharks
- bat rays
- wolf-eel-like crevice fish
- octopus
- sea stars
- urchins
- anemone-like forms
- crabs where budget allows

Monterey Bay Aquarium identifies kelp forests as vertically structured ecosystems with seafloor, midforest, and canopy communities and features giant kelp, anchovies, leopard sharks, rockfish, wolf-eels, sea stars, urchins and other invertebrates.

References:
- https://www.montereybayaquarium.org/animals-the-ocean/ecosystems/kelp-forest
- https://www.montereybayaquarium.org/visit/exhibits/kelp-forest/
- https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/leopard-shark
- https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/bat-ray

Keep California reef palette muted/cold:
- olive/gold kelp
- gray/green rock
- orange/red fish accents
- purple urchins
- blue-green water

---

# 13. South Pacific lagoon reef quality

Inspired by Sid's Bora Bora, Tahiti, and Mo'orea trip.

This is an autobiographical art-directed composite, not a claim that every represented species occurred at one exact site.

## 13.1 Reef scenes

Do not uniformly scatter coral.

Create distinct scenes:

### Shallow coral garden
- bright light
- purple/green/gold coral
- sandy channels
- small colorful fish

### Coral bommie
- one large mound
- dense fish
- turtle or ray passing nearby

### Lagoon channel
- open sand/water
- blacktip reef sharks
- rays
- sparse large coral heads

### Outer reef slope
- plate/table coral
- darker blue
- larger schools
- manta/eagle ray opportunity

## 13.2 Coral growth-form library

NOAA documents a range of common coral growth forms including branching, digitate, table, foliose, encrusting, massive, and mushroom forms.

Reference:
https://oceanservice.noaa.gov/education/tutorial_corals/coral03_growth.html

Build reusable modules:

- `MassiveCoral`
- `BranchingCoral`
- `DigitateCoral`
- `TableCoral`
- `FolioseCoral`
- `EncrustingCoral`
- `MushroomCoral`
- `SoftFanCoral`
- `WhipCoral`

Each growth form:
- one shared geometry where possible
- shared materials
- instanced placements
- seeded size/rotation variation
- clustered composition

Prefer more instances over more unique materials.

## 13.3 Marine cast priority

### High payoff / low-medium cost
- sea turtle
- butterflyfish-like fish
- surgeonfish-like schools
- parrotfish-like fish
- wrasse-like fish
- blacktip reef shark
- manta ray
- eagle ray
- stingray
- jellyfish
- urchins

### Medium cost
- octopus
- moray/eel
- starfish
- anemone forms
- small crustaceans

### Hero-only
- complex cephalopod skin animation
- large marine mammals
- high articulation animals

Do not add hero Tier until standard reef remains within budget.

---

# 14. Manuel Antonio rainforest biome

This biome is specifically inspired by Sid's Costa Rica / Manuel Antonio experience.

SINAC identifies Manuel Antonio as a highly diverse tropical forest/coastal system with rich bird and mammal fauna including squirrel/titi monkeys, white-faced monkeys, howler monkeys, two- and three-toed sloths, raccoons, coatis, and toucans.

Reference:
https://www.sinac.go.cr/EN-US/ac/acopac/pnma/Pages/default.aspx

The park also includes beach, forest, marine environments, and high viewpoints, which makes the rainforest-to-coast transition particularly relevant to this world.

## 14.1 Rainforest subzones

- tropical beach edge
- forest entrance
- dense understory
- canopy corridor
- creek/wet pocket
- rocky overlook
- optional mangrove-like transition where geography supports it

## 14.2 Flora modules

- tall trunks
- buttress-root hero trees
- broadleaf crown clusters
- palms
- lianas
- epiphyte clusters
- heliconia-like leaf/flower motifs
- ferns
- moss
- wet leaf litter

## 14.3 Wildlife

Ambient:
- small frogs
- lizards/iguanas
- butterflies
- insects
- small birds

Hero:
- toucan
- colorful macaw
- capuchin/white-faced monkey
- squirrel/titi monkey
- howler monkey
- sloth
- coati
- agouti

Macaws can be included as broader Costa Rica rainforest color/ambience even if the personal trip record does not assert a specific individual sighting.

Never label an ambient animal as "Sid saw this" without real media or explicit user statement.

---

# 15. Santa Cruz redwood biome

California State Parks sources describe coast redwood forest understory with sword fern, redwood sorrel, huckleberry, fallen logs, banana slugs, squirrels, deer, forest birds and decomposing wood habitat.

References:
- https://www.parks.ca.gov/?page_id=28726
- https://www.parks.ca.gov/?page_id=31007

## Flora
- coast redwoods
- Douglas-fir
- tanoak
- madrone
- California bay
- bigleaf maple
- huckleberry
- sword fern
- redwood sorrel
- moss

## Fauna
Low-cost:
- western/gray squirrel
- banana slug
- mouse/vole
- salamander/newt-like small amphibian
- Steller's jay / small forest bird

Hero/rare:
- black-tailed deer
- bobcat silhouette only if budget and behavior are credible

## Environmental cues
- huge vertical trunks
- fern carpet
- dark cool light
- mossy logs
- decomposing fallen redwood
- narrow filtered-sun shafts
- creek pocket

Fallen deadwood should be abundant enough to feel ecologically real, but only selected logs are sport features.

---

# 16. Joshua Tree / San Diego-origin desert biome

This biome should evoke Sid's Southern California experiences and Joshua Tree interest, without asserting a birthplace.

## 16.1 Rock formation language

The user's supplied reference images emphasize:
- warm tan rounded rock masses
- huge monolithic domes
- narrow passages
- stacked boulders
- occasional balanced / sculptural formations
- sparse shrubs around rock bases

NPS explains Joshua Tree's iconic formations as monzogranite fractured by joints, rounded by groundwater weathering, and later exposed as stacked boulder piles.

Reference:
https://www.nps.gov/jotr/learn/nature/geologicformations.htm

Create reusable formations:

### `GraniteDome`
- broad continuous mass
- rounded crown
- sparse cracks

### `JointedBoulderPile`
- 4–12 interlocking rounded blocks
- aligned fracture logic
- partly buried

### `BalancedFormation`
- narrow pedestal
- larger upper mass
- hero feature only

### `SlotPassage`
- two continuous rock masses
- walkable narrow corridor

### `ClimbingWall`
- rounded monzogranite face
- bouldering discovery / climbing potential

Avoid random asteroid piles.

## 16.2 Desert vegetation

NPS Joshua Tree references support:
- Joshua trees
- creosote
- ocotillo
- cholla
- other cacti
- pinyon/juniper at higher dry elevations
- fan palm oasis only if an oasis is deliberately authored

Reference:
https://home.nps.gov/jotr/learn/nature/plants.htm

Use:
- JoshuaTree module
- CreosoteBush
- Ocotillo
- Cholla
- BarrelCactus
- low desert grass/wildflower patches
- sparse juniper near mountain transition

## 16.3 Desert fauna

NPS notes commonly observed animals including antelope ground squirrels, jackrabbits, coyotes, red-tailed hawks, ravens, and Great Basin fence lizards.

Reference:
https://www.nps.gov/jotr/faqs.htm

World cast:
- ground squirrel
- jackrabbit
- fence lizard
- raven
- roadrunner-like bird if desired
- coyote as rare distant hero only
- desert tortoise only as rare stationary discovery if implemented respectfully

Use low wildlife density. Desert should feel open.

---

## 16.4 Visual identity and color authority

The target is a pale, sun-weathered monzogranite landscape with muted living greens, spacious sandy ground, and cool crevice shadows. Do not turn the biome into orange sandstone, red mesas, yellow dunes, or a cactus garden.

This is an art-directed Southern California / Joshua Tree composite, not a geographically literal adjacency of Joshua Tree, Santa Cruz, alpine terrain, and Costa Rica. Do not infer Sid's birthplace or sightings from this biome.

The following sRGB swatches are authored starting values, not measured ecological colors. Evaluate them under the world's existing neutral daylight, tone mapping, and exposure before tuning. Convert through the renderer's established color pipeline exactly once. Golden-hour warmth belongs primarily to shared lighting, not orange base materials.

| Surface or plant region | Base color | Secondary color | Placement rule |
| --- | --- | --- | --- |
| Main monzogranite | `#BBAA91` warm gray-beige | `#D5C4AA` pale buff | Broad exposed masses; retain readable faces in sun |
| Feldspar warmth | `#C4A795` dusty rose | `#A58C79` taupe | Restrained patches, not every boulder |
| Weathered rock / joint recess | `#8B7D6D` | `#6A6662` cool gray | Sparse weathering and recess detail; real shadows remain lighting-driven |
| Decomposed granite / grus | `#C5B18B` | `#AE9977` | Coarse aprons at rock bases grading into soil |
| Dry sandy wash | `#D7C6A5` | `#BCA987` | Pale winding drainage, sparse pebbles |
| Dry compact soil | `#AA9574` | `#91816A` | Open interspaces; avoid one flat beige field |
| Joshua living leaf rosettes | `#68735A` | `#8C9270` | Muted olive/sage; pointed leaf silhouettes |
| Joshua trunk / dead leaf skirt | `#716356` | `#9C896A` | Fibrous gray-brown trunk, straw skirt beneath tips |
| Creosote | `#646D48` | `#858666` | Small airy shrubs with visible ground beneath |
| Cholla body / spine halo | `#8E9574` | `#D9CCA8` | Muted stems; cream spines only close up |
| Ocotillo | `#7C705E` | `#818562` | Thin gray-brown canes, sparse optional leaves |
| Dry bunchgrass | `#A99A70` | `#C2B28B` | Sparse tufts; never a continuous lawn |
| Rare flower accents | `#B65F43` / `#CEB564` | — | Tiny seasonal accents, disabled by default |

Material rules:
- Rock is matte and granular: initial roughness 0.85–1.0, metalness 0. No polished/plastic boulders.
- Use low-frequency vertex/instance color variation for broad weathering, restrained fine detail at close range, and shared materials. Avoid random per-face confetti.
- Joint grooves must follow each formation's structural axes. Large forms carry the silhouette; micro-noise must not turn them into crumpled foil.
- Base burial, talus, grus, and contact shadow ground each formation. Do not paint black ambient-occlusion rings around every rock.
- A formation crossing a transition retains one coherent local material field; camera position must not recolor it.
- Preserve the alpine cave's cooler granite identity from section 7.5. This palette does not recolor the Arcade mountain.

## 16.5 Authored desert subzones

NPS distinguishes Mojave Joshua-tree communities, lower Colorado Desert ocotillo/cholla communities, and higher pinyon/juniper woodland. Use this distinction to organize the composition, not as a mandate to simulate real regional climate.

| Subzone | Landform and composition | Vegetation | Player experience |
| --- | --- | --- | --- |
| Upper Joshua basin | Broad open floor framed by 2–3 granite masses | Irregular Joshua-tree clusters with widely spaced creosote | First unmistakable desert vista; readable route |
| Granite passages | Interlocking domes, jointed blocks, grus aprons | Sparse plants in soil pockets outside passage clearance | Shaded slot walk and optional bouldering loop |
| Lower warm wash | Shallow braided dry channel and open banks | Creosote, local cholla groups, occasional ocotillo | Curving route toward coastal scrub |
| Dry mountain shoulder | Exposed ribs, talus, progressively cooler gray rock | Sparse juniper/pinyon forms fading uphill | Links desert to lower mountain before alpine snow |
| Scrub margin | Rolling gravel/soil ground with increasing plant cover | Muted sage-like shrubs and dry bunchgrass | Long, gradual link to central paths and coast |

Composition starting targets, to be tuned against actual map scale:
- Keep roughly 60–75% of the main basin floor visibly open from the entry view. This is an art target, not a biological statistic.
- Author one dominant dome, two supporting formation groups, and at most one balanced-rock hero visible from the main approach.
- Cluster plants by habitat suitability, leaving broad gaps. Avoid uniform grids and equal spacing.
- Use 3–5 Joshua-tree silhouette variants: unbranched juvenile, two-arm, asymmetric multi-arm, taller sparse crown, and one rare weathered form. Vary proportions without stretching leaf rosettes into balls.
- Joshua trees need branching woody trunks, upward/outward arms, dense pointed terminal rosettes, and restrained dead-leaf skirts. They must not read as palms, conifers, or green spheres.
- Cholla needs articulated branching segments; ocotillo needs a sparse fan of long tapering canes. No saguaros as generic desert shorthand.
- Flowering is an optional coherent seasonal treatment, not permanent scattered neon.
- Wildlife follows section 16.3 at low density, with shade/basking/perch anchors. Keep a clear main walking route and optional climbing detours.

## 16.6 Natural biome transitions — shared island contract

This section refines sections 2, 3, and 19. The existing 6–15-unit transition recommendation is a starting range for local ground/vegetation overlap, not a universal stripe painted around every biome. Large visible slopes may need a broader authored sequence. Final widths must be chosen after inspecting map scale and normal travel speed.

One spatial system must drive ground materials, vegetation suitability, habitat assignment, and atmospheric targets. Independent border noise per subsystem is forbidden.

Extend the sampler internally to normalized multi-biome weights plus continuous elevation, slope, moisture, exposure, and substrate fields. Keep the existing `primary / secondary / blend` API as a compatibility projection if callers need it; two winning labels alone must not control a three-way junction.

Required sampler invariants:
- All values finite; weights nonnegative and sum to 1 within 1e-6.
- Sample the same world-space position and seed identically regardless of camera, frame rate, travel direction, or quality tier.
- Smooth overlapping influence fields before normalization; guard the zero-total case with a defined local fallback.
- No categorical branch on `primary` for ground color, fog, or density.
- At three-way junctions, retain all relevant weights without a seam caused by swapping second place.
- Low-frequency boundary perturbation uses a shared stable world-space field. Noise must not create isolated wet-forest specks in the desert interior.

Placement:
- Derive species density from biome weights multiplied by elevation, slope, moisture, and substrate suitability.
- Generate stable candidate positions and stable per-candidate random thresholds at scene construction/chunk build time.
- Taper population density spatially; do not resample plants as the player moves.
- Mix species by habitat rather than morphing a Joshua tree into a redwood.
- Exclude paths, jump takeoffs/landings, cave mouths, interaction approaches, and water channels using existing authored footprints.
- Fauna home ranges may overlap compatible margins; animals turn through ordinary movement, never disappear on a biome line.

Terrain and appearance:
- Terrain height and surface normals remain continuous across biome boundaries. Biome masks decorate and constrain the shared terrain rather than stitch disconnected heightfields.
- Transition exposed rock to grus to soil to leaf litter through spatial material weights; fade moss/ferns with local moisture.
- Stable material variation stays attached to world space. Only atmosphere responds to camera position.
- Use the shared sun and exposure. Shift local ambient/fog gently; never use abrupt per-biome white balance, sky replacement, or colored spotlights.
- Smooth atmosphere toward the camera's local target over approximately 1–2 seconds, with a bounded frame-time update; teleports initialize to the destination target instead of carrying the old biome's fog.
- Preserve reduced-motion behavior; transitions need no animated screen effects.
- Ski snowfall remains the established mode effect across land. It does not change species distribution or redefine the desert as alpine.

## 16.7 Transition routes and geographic separation

| Connection | Required visible sequence | Reject |
| --- | --- | --- |
| Desert → mountain | Open wash → Joshua basin → dry woodland shoulder → sparse conifers/talus → patchy snow → upper snowfield | Joshua trees touching a continuous snow wall |
| Desert → California scrub | Pale gravel → mixed compact soil → denser sage-toned shrubs → coastal scrub → beach margin | Beige/green straight line or desert trees rooted in surf |
| Redwood → desert, if visible nearby | Moist forest interior → drier mixed woodland → scrub saddle behind ridge → open desert | Giant redwoods interspersed with cholla as random border scatter |
| Desert → rainforest | Route through broad scrub/central terrain and an intervening ridge; tropical moisture increases on the far side | Ferns and tropical palms immediately bordering Joshua-tree rows |
| Redwood → alpine | Fern/log understory → mixed conifer slope → sparse treeline → rock/snow | Abrupt forest deletion at altitude threshold |
| Rainforest → lagoon | Canopy thins → coastal vegetation → beach/backshore → wet shoreline → shallow sand → reef patches | Coral rooted on dry sand or rainforest ending at a ruler-straight edge |
| Kelp → warm lagoon | Separate coastal coves with rocky headland and open-water/sandy habitat gap | Coral/giant-kelp checkerboard or a visible straight water-color seam |

The fictional island compresses climate zones. Landform separation and intermediate habitats make this legible; a color gradient alone cannot make rainforest directly adjoining desert ecologically literal. Preserve distinct marine communities while blending water appearance smoothly.

Do not redirect the required alpine waterfall into a dry wash simply to connect features. Keep its established forest drainage; desert washes are normally dry unless a separate credible water source is authored.

## 16.8 Traversal, performance, and implementation order

- Author the approach along a winding wash so the first Joshua silhouettes appear before the entire basin opens.
- Reveal the main dome after a bend; offer an optional slot passage and climbing loop that reconnects with the main trail.
- The main route stays comfortably walkable, with camera clearance; scenic crevices need not all be traversable.
- Existing climbing/interaction mechanics and rendered surfaces must share their authored definitions. Decorative rocks must not imply a climbable mechanic that is absent.
- Start Phase 1 with sampler/transition fields and a palette blockout. Phase 9 builds the desert modules and qualifies the complete desert route. Do not postpone the blending architecture until final decoration.
- Keep distant landform silhouettes visible while culling dense vegetation and fauna independently.
- Camera-visible adjacent biome chunks may be rendered even when the player is in another biome. Player membership alone is not a visibility test.
- Use frustum/distance chunk culling with hysteresis and stable LOD. Avoid whole-root pop-in and transparent duplicate forests used as a crossfade.
- Shared materials, merged static formation geometry, instanced vegetation, and bounded fauna updates remain mandatory.
- Measure the shared boundary view with both neighbors visible. The existing <100 draw-call gate and preferred triangle/renderable targets apply to the combined view, not to each biome separately.
- Optional spine/flower/fine-grain detail may be reduced by quality tier; preserve Joshua-tree and rock silhouettes, paths, and discoveries.

## 16.9 Visual qualification and rejection criteria

Required fixed-seed views at identical neutral daylight/exposure:
1. Desert approach from scrub: early silhouettes and no material seam.
2. Basin wide: pale granite, open ground, distinct Joshua forms.
3. Dome close-up: matte granular surface, joint logic, grounded base.
4. Slot passage: readable shade, floor and camera clearance.
5. Lower wash: distinct cholla/ocotillo composition and dry drainage.
6. Dry shoulder looking both downhill to desert and uphill toward snow.
7. The nearest woodland/desert separation and any three-biome junction.
8. A worst-case boundary view with both neighboring habitats rendered.

Also record forward/reverse traversal of each actual desert boundary at walking and bike speed. Inspect for ground seams, lighting pulses, plant/LOD popping, collision changes, and fauna disappearance. Include desktop and the existing mobile viewport.

Acceptance:
- Neutral daylight reads warm beige/granite with subdued olive foliage; no orange wash, white clipping, neon green plants, or plasticky rock.
- Joshua trees are recognizable in silhouette without labels.
- Vegetation shifts in multiple stages tied to terrain, not in a uniform hedge.
- No duplicated overlapping terrain sheets, z-fighting, artificial straight border, or three-way junction seam.
- Main paths, bouldering approaches, Shasta following, and existing cave/sport entry routes remain usable.
- Atmosphere stays continuous across boundaries and settles correctly after navigation jumps.
- Worst-case combined rendering stays within the unchanged budget.

Add meaningful implementation tests when the substrate is built: deterministic normalized samples at interiors/edges/junctions; continuity on fixed transects; stable placement IDs; species exclusions in known incompatible habitats; and traversal/visibility regression coverage. These are future runtime qualification requirements, not claims that a documentation update has already passed visual review.

References for ecological/geological grounding (palette, density, timing and widths above are authored design targets):
- https://www.nps.gov/jotr/learn/nature/geologicformations.htm
- https://www.nps.gov/jotr/learn/nature/plants.htm


---

# 17. Ecology module API

Avoid one-off renderer code.

Recommended abstraction:

```ts
type FaunaArchetype =
  | "small-mammal"
  | "reptile"
  | "bird"
  | "fish"
  | "shark"
  | "ray"
  | "turtle"
  | "frog"
  | "hero-mammal";

type FaunaDefinition = {
  id: string;
  archetype: FaunaArchetype;
  biome: BiomeId[];
  palette: string[];
  scale: number;
  behavior: string;
  hero?: boolean;
};
```

Create shared geometry factories per archetype.

Per-species customization should primarily be:
- scale
- proportions
- appendage shape
- palette
- motion parameters

not duplicate rendering systems.

---

# 18. Rendering/performance contract

Hard existing gate:
- **<100 draw calls**

Preferred targets:
- typical active biome: **≤70**
- visible triangles: **≤90,000**
- visible renderables: **≤100**
- inactive dense biome roots hidden
- no animation updates for invisible biome fauna
- shared materials
- instancing for vegetation/coral/schools
- hero animals capped

Do not optimize by reducing visual variety to identical clones. Use:
- seeded transforms
- mirrored instances
- 2–4 palette variants
- clustered placement
- a few geometry archetypes

---

# 19. Biome root activation

Use root groups:

```
alpineRoot
redwoodRoot
desertRoot
rainforestRoot
kelpRoot
lagoonRoot
```

Rules:
- active biome fully visible/animated
- adjacent transition biome remains visible where camera/frustum and distance require it; use section 16.8 chunk visibility rather than player membership alone
- distant dense fauna roots disabled
- water fauna only animate while corresponding reef is active
- rainforest canopy hero animals only update while rainforest is active

---

# 20. Personal media discoveries

Keep personal media separate from ambient ecology.

Discovery schema should continue supporting:
- photos
- snorkeling videos
- Shasta moments
- publications
- games

Copy:
- short title
- one factual line
- no sentimental filler
- no invented locations

Video:
- load only when opened
- `preload="metadata"`
- closing returns to exact world position and heading

---

# 21. Astra implementation phases

## Phase 0 — audit and freeze
Before editing:
- inspect current exact-green baseline
- review screenshots
- preserve Shasta motion
- treat current cave/waterfall as disposable visual implementation

## Phase 1 — world/biome substrate
- add biome sampler
- increase mountain height/width
- define transition fields
- preserve navigation

## Phase 2 — Arcade cave replacement
- mountain backside shell
- flat floor
- tunnel
- chamber
- lantern
- three spatial game walls
- full cave screenshot qualification

Do not continue until this visually reads as a cave carved into mountain.

## Phase 3 — snowmelt hydrology
- melt source
- stream spline
- waterfall
- plunge pool
- lower outflow

## Phase 4 — waterfall Paper Archive cave
- hidden cave
- flat walkable floor
- publication integration
- entrance/discovery gates

## Phase 5 — alpine activity refinement
- tree run
- open bowl
- chute
- jump line
- more fallen trees

## Phase 6 — animal archetype refactor
- small mammals
- lizard
- birds
- fish
- shark
- ray
- turtle
- preserve current wildlife behavior API where possible

## Phase 7 — coral library + lagoon scenes
- coral growth-form library
- shallow garden
- bommie
- lagoon channel
- outer reef slope
- turtle

## Phase 8 — redwood biome expansion
- understory modules
- deadwood ecology
- forest fauna

## Phase 9 — desert biome
- monzogranite formation modules
- Joshua trees / creosote / ocotillo / cholla
- desert fauna
- climbing/bouldering opportunities

## Phase 10 — Manuel Antonio rainforest
- full vegetation layering
- canopy wildlife
- creek
- tropical beach transition
- personal media discoveries

---

# 22. Qualification matrix

Every phase:
- typecheck
- lint
- unit tests
- production build
- bundle budget
- World Mode browser audit
- exact-head screenshots

Biome-specific screenshots must be reviewed visually, not only by telemetry.

### Cave visual rejection test

Reject if:
- cave can still be described as "a pile of boulders with a roof";
- exterior game text is readable;
- no meaningful tunnel depth exists;
- mountain does not visually continue above entrance;
- floor is awkward or blocked.

### Waterfall rejection test

Reject if:
- water begins at lip with no upstream stream;
- fall is a rectangular sheet;
- no downstream flow exists;
- cave is simply a black hole placed beside waterfall.

### Wildlife rejection test

Reject if:
- squirrel still reads as generic ellipsoid + stick tail;
- fish are rocks with triangle tails;
- ray is a flat four-sided disc;
- shark is an ellipsoid with cones;
- rainforest animals reuse unrelated body archetypes without silhouette changes.

### Shasta rejection test

Reject if:
- harness reappears;
- brow/crown bubbles reappear;
- forehead markings alter skull geometry;
- smooth gait regresses;
- tail returns to torus/segmented chain.

---

# 23. Final design principle

The island should become richer by building **reusable ecological and geological systems**, not by adding more isolated props.

A successful result should make visitors want to wander because:
- distant biomes look different;
- paths reveal new ecology;
- wildlife feels locally appropriate;
- caves genuinely hide things;
- water has a believable source;
- mountain routes invite movement;
- reefs have composition rather than clutter;
- Sid's games, publications, photography, travels, and Shasta are discoveries inside the world rather than UI pasted on top of it.
