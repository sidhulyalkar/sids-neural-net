# Sylvaria v0.6 — Visual Systems Contract

Sylvaria v0.6 turns the v0.5 Mossglint Run into a deliberately art-directed, performance-aware living atlas. The goal is not maximal decoration. The goal is **instant biome identity, cute readable characters, crisp interaction language, and stable motion in real browsers**.

The reference target is a luminous miniature fantasy diorama: soft organic silhouettes, moss/roots/fungi, magical technology, clear traversal surfaces, expressive creatures, and a neon violet/cyan/green portal language. Gameplay information always wins over decoration.

## 1. Sprid design rules

Sprid is the visual anchor of every world.

1. **Readable at gameplay size.** Sprid must read as a round moss-born traveler at roughly 24–36 logical pixels without relying on fine texture.
2. **Face first.** Bright directional eyes are the highest-contrast facial feature. The mouth stays tiny and friendly. Eye direction follows aim so input feels connected to the character.
3. **Asymmetric crown.** A small irregular leaf/moss crown breaks the circular silhouette and makes Sprid identifiable in screenshots without widening the collision body.
4. **Portal gun separation.** The weapon is visibly detached from the torso silhouette. Barrel direction must be obvious before a shot is fired.
5. **Mossglint chamber language.** The gun chamber moves through cyan → violet → green as charge accumulates. Portal-ready state adds sparse orbiting motes rather than a full-body glow cloud.
6. **Silhouette-driven animation.** Idle breathing, running foot swing, dash squash/stretch, firing recoil, damage flicker, and portal-ready charge each alter the outline rather than relying only on particles.
7. **Consistent collision honesty.** Decorative leaves, motes, and the gun never imply a larger player hitbox.
8. **Crisp highlights.** Tiny white eye glints and gun-edge highlights stay unblurred. Bloom is secondary and bounded by the render budget.
9. **Build readability.** Future persistent gifts may add one small visual token each, but no upgrade may obscure the eyes, gun barrel, or collision core.

### Future Sprid authored-art slots

The current renderer remains procedural/vector-resolved. If authored sprites are introduced later, the registry should support:

- `sprid/body-idle@2x`
- `sprid/body-run-a@2x`, `sprid/body-run-b@2x`
- `sprid/dash@2x`
- `sprid/hit@2x`
- `sprid/crown@2x`
- `sprid/eyes@2x`
- `sprid/gun-base@2x`
- `sprid/gun-ready@2x`

All authored replacements must preserve the same logical footprint and visual states.

## 2. Enemy art rules

Enemies are pressure agents, not visual noise.

1. **Species before color.** Flying, aquatic, insect, quadruped, and wisp families must be readable in silhouette even when desaturated.
2. **Cute, not harmless-looking.** Rounded proportions and expressive faces keep the Sylvaria tone. Threat comes from pose, eye/brow accents, telegraphs, and motion rather than gore or aggressive visual clutter.
3. **Movement grammar gets a visual tell.** Dash/stalk agents receive sharper brow/line accents; orbit/weave agents stay more open and round; swoopers read horizontally; spirals use a small orbital accent.
4. **Danger color is information.** Warm danger tones are reserved for telegraphs, projectiles, health loss, and attack accents. Whole creatures should not become flat red blobs.
5. **Faces survive scale.** Two eyes plus one mouth line are sufficient. Faces remain visible in high and balanced tiers and are retained even in performance tier.
6. **Health bars stay subordinate.** Bars are short, thin, and close to the creature. Shape and motion should communicate more than UI chrome.
7. **Boss hierarchy.** Guardians use a larger unique core silhouette, orbit/ring language, a dedicated health bar, and biome-derived accents. They must be recognizable as bosses within 250 ms of appearing.
8. **Friendly ecological targets remain visually distinct.** Puzzle animals use softer rings and resonance color rather than hostile danger accents.

## 3. Per-biome palette + motif guide

Every Atlas world is classified into one of five high-level visual families. Atlas metadata still drives room geometry and scene-specific variation, but these families guarantee instant visual identity.

| Family | Background | Mid/floor | Primary glow | Secondary | Warm accent | Motifs |
| --- | --- | --- | --- | --- | --- | --- |
| **Forest / moss** | `#06120c` | `#12331f` / `#1d4a2d` | `#8dffac` | `#5fe9ff` | `#e8a76c` | ferns, mushrooms, roots, spores |
| **Cave / volcanic** | `#140a08` | `#35150f` / `#52251a` | `#66efc7` | `#4ce3ef` | `#ff9454` | basalt, embers, glow-fungi, cracks |
| **Reef / wetland** | `#04131d` | `#07384a` / `#0c5260` | `#6fffd0` | `#4edfff` | `#ff9f7c` | coral, kelp, bubbles, shells |
| **Ice / alpine** | `#071320` | `#15334a` / `#244e66` | `#b9f8ff` | `#6ec8ff` | `#c6a7ff` | crystal shards, snow, ridges, lichen |
| **Celestial / anomaly** | `#08091c` | `#161a46` / `#25265d` | `#7fffe5` | `#60d5ff` | `#df92ff` | floating shards, stars, orbit lines, void flowers |

### Palette rules

- Portal colors remain globally recognizable across all themes: violet `#9b5cff`, cyan `#52d9ff`, Mossglint green `#79ff9a`, electric blue `#6f73ff`.
- Resonance projectile colors never change by biome.
- Biome colors decorate the world and HUD edge accents; they never recolor controls into ambiguity.
- Playable floor and collision geometry must be at least one luminance step more legible than the far background.
- Background detail is lower contrast and lower saturation than gameplay objects.

### Motif rules

- Motifs render from cached 2× vector sheets and are composited with integer-aligned `drawImage` calls.
- Motifs live primarily at arena edges and never cover the spawn pocket, puzzle targets, gate anchor, or primary traversal lane.
- Parallax motion is shallow. It exists to create depth, not to compete with moving hazards.
- At least two motif types should be represented by each biome kit. Balanced and Performance may display fewer instances to preserve frame time.

## 4. UI / HUD polish rules

The HUD has one job: explain what matters **right now**.

### Information hierarchy

1. **World / room identity** — top-left.
2. **Immediate objective or extraction instruction** — room card + hint card.
3. **Mossglint / gate state** — run rail and dedicated gate button.
4. **Stability, score, timer** — compact run stats.
5. **Selected resonance** — bottom ability rail.
6. **Guardian state** — only visually loud when a guardian is active.

### Visual rules

- Active biome colors tint borders and labels, never core semantic colors.
- `PORTAL READY` / `F · FIRE GATE` is the strongest interactive emphasis after objectives are satisfied.
- Gate readiness is redundant through text, button state, Sprid gun chamber, portal anchor, audio, and particles.
- Ability selection uses a crisp one-pixel accent rail in addition to glow.
- Typography stays readable without bloom. Text shadows are decorative and subtle.
- HUD glass uses thin borders and dark fill rather than expensive large blur fields.
- `prefers-contrast: more` receives stronger borders and white semantic text.
- Reduced-motion mode removes decorative pulses while preserving hazard and attack telegraphs.

### User-selectable graphics quality

The Options menu exposes:

- **Auto** — default. Starts balanced, downshifts when frame rate is persistently low, and cautiously upgrades after sustained headroom.
- **High** — maximum decorative motif density and bounded glow.
- **Balanced** — full biome identity at a lower blur/decoration budget.
- **Performance** — preserves silhouettes, faces, telegraphs, portal readability, and interaction state while reducing decorative cost.

Gameplay simulation is never changed by visual quality.

## 5. Exact asset checklist

### Implemented in v0.6 as procedural/cached art

- [x] Sprid body, eyes, crown, root legs, portal gun, charge chamber
- [x] Sprid idle/run/dash/recoil/portal-ready state language
- [x] flying/aquatic/insect/quadruped/wisp creature silhouettes
- [x] cute enemy facial overlays
- [x] forest 2× motif sheet
- [x] volcanic 2× motif sheet
- [x] reef/wetland 2× motif sheet
- [x] ice/alpine 2× motif sheet
- [x] celestial/anomaly 2× motif sheet
- [x] biome-derived HUD variables and biome badge
- [x] Mossglint / gate / portal global glow language
- [x] adaptive render budget and transform-safe gradient cache
- [x] separate throttled decorative overlay canvas
- [x] Auto / High / Balanced / Performance visual presets

### Optional authored-art expansion slots

- [ ] 8-direction or 4-direction Sprid animation sprite atlas
- [ ] 5 biome-specific guardian portraits/silhouettes
- [ ] 7 movement-grammar enemy pose accents
- [ ] 5 biome backdrop paintings split into far/mid/foreground layers
- [ ] 5 terrain tile/decal sheets
- [ ] 30–50 biome prop variants (6–10 per family)
- [ ] bespoke Mossglint pickup animation frames
- [ ] portal distortion/noise texture atlas
- [ ] guardian defeat reward burst atlas
- [ ] world-transition tunnel texture set

These are **upgrade slots**, not dependencies. The procedural renderer remains the fallback and keeps the game lightweight.

## Crisp rendering + performance contract

Visual quality and smoothness are one system.

### Runtime rules

- Full-screen and character gradients are cached using quantized, transform-aware gradient signatures where the browser supports the optimization safely.
- Expensive `shadowBlur` is capped per visual tier where Canvas host-object patching is supported; browsers that reject the shim fall back safely to native rendering.
- Motif art is drawn once into 2× cached canvases and reused with `drawImage`.
- Decorative biome motifs/faces live on a separate transparent overlay canvas and run at a lower cadence than gameplay.
- Auto mode monitors sustained FPS rather than reacting to one slow frame.
- Quality shifts only decorative density, overlay cadence, HUD blur, and glow. Physics, input, collision, hazards, enemy budgets, portal timing, and scoring remain deterministic.

### Target budgets

- **Chrome Stable / Chromium / Firefox:** target ≥ 55 FPS in ordinary worlds; dedicated CI floor ≥ 42 FPS under headless instrumentation.
- **WebKit:** preserve input and gameplay timing under iframe throttling; Auto should prefer Balanced/Performance before compromising simulation.
- Motif overlay: ≤ 6 cached images/paint in High, ≤ 3 Balanced, ≤ 1 Performance.
- Decorative overlay cadence: 45 FPS High, 30 FPS Balanced, 24 FPS Performance.
- Gradient cache: 224 High, 144 Balanced, 72 Performance.
- Blur cap: 9 px High, 4.5 Balanced, 0.75 Performance when the Canvas host-object optimization is supported.

## Visual QA matrix

Each release should capture at least one deterministic fixture for:

1. forest / moss
2. cave / volcanic
3. reef / wetland
4. ice / alpine
5. celestial / anomaly
6. portal ready
7. extraction portal open
8. guardian encounter
9. Sprid under keyboard aim
10. Performance-tier rendering

Automated checks scan real Atlas sectors until every biome family has been encountered, load those actual worlds, verify the gameplay canvas remains nonblank/diverse, save screenshot fixtures, and validate the Performance tier separately. The four-engine Game Network matrix additionally guards Chrome Stable, Chromium, Firefox, and WebKit runtime behavior.

## Future upgrades

### v0.7 — authored silhouette pack

Replace selected procedural creature cores with tiny authored vector/sprite assets while keeping the same runtime registry and hitboxes.

### v0.8 — biome composition grammar

Give each family multiple far/mid/foreground composition templates and let Atlas metadata select among them so two forest worlds differ structurally as well as by props.

### v0.9 — guardian art + phase language

Create bespoke guardian silhouettes, telegraphs, and phase transitions tied to the five biome families.

### v1.0 — competitive visual telemetry

Record non-identifying quality tier and frame-time summaries with validated leaderboard runs so competitive submissions can distinguish player performance from device/browser constraints without exposing private information.
