import type { Metadata } from 'next';
import { PhysiologyPersonaLab } from '@/components/physiology/PhysiologyPersonaLab';
import {
  ExternalLinkChip,
  PageHeader,
  PageShell,
  SectionShell,
} from '@/components/portfolio/PageShell';

export const metadata: Metadata = {
  title: 'PhysioPersona Nature Atlas | Sidharth Hulyalkar',
  description:
    'A local-first physiological persona exploring 900 deterministic miniature nature worlds through an illustrated SVG and Canvas renderer, with optional experimental Three.js scenes.',
};

const layers = [
  {
    title: 'measure',
    copy: 'WiFi CSI, mmWave, reference belts/ECG/PPG, motion, and optional browser-local expression features remain separate measured modalities.',
  },
  {
    title: 'estimate',
    copy: 'Each derived signal carries confidence, observability, provenance, reference status, and an explicit research claim boundary.',
  },
  {
    title: 'abstain',
    copy: 'Weak evidence becomes unknown. The interface is not allowed to invent a confident body state simply because an animation needs a value.',
  },
  {
    title: 'play',
    copy: 'Evidence can animate the explorer while explicit choices shape a separate local preference model, world history, favorites, and field journal.',
  },
];

const atlasCollections = [
  ['🌳 101–150 · deep woods', 'Rainforest canopies, banyan roots, bamboo, taiga, animal clearings, glowing fungi, nurse logs, and tangled understories.'],
  ['🌊 151–200 · waters', 'Reefs, bays, lagoons, wetlands, whale horizons, kelp forests, sea-glass shores, ice shelves, waterfalls, and open ocean.'],
  ['❄️ 201–250 · alpine', 'Ice caverns, blizzards, glacier valleys, summit cairns, ridgelines, winter wildlife, alpenglow, tarns, and frozen waterfalls.'],
  ['🌷 251–300 · gardens', 'Cherry avenues, tulip rows, orchards, pollinators, prairie grass, fountains, lotus blossoms, rock gardens, and flower architecture.'],
  ['🏜️ 301–350 · arid worlds', 'Savanna wildlife, slot canyons, mesas, dunes, salt flats, saguaros, badlands, desert sunsets, and tiny animal tracks.'],
  ['🌌 351–400 · weather + sky', 'Supercells, double rainbows, moons, galaxies, meteor trails, sundogs, monsoon rain, aurora, and tiny observatories.'],
  ['🍄 401–450 · fairycore', 'Moss picnics, acorn cups, tree libraries, gossamer webs, wild berries, ivy ruins, seedling stories, and absurdly cozy logs.'],
  ['✨ 451–500 · bioluminescence', 'Neon tides, ghost mushrooms, fluorescent reefs, glowworms, firefly swarms, moonlit mist, and midnight plankton.'],
  ['🌸 501–550 · pastel blooms', 'Wisteria tunnels, hydrangea, magnolia, peony, crocus, delphinium, soft flower fields, and botanical close-ups.'],
  ['🌧️ 551–600 · rain worlds', 'Tin-roof rain, dark pines, foggy lochs, muddy tracks, flooded creeks, misty marshes, storm fronts, and reflective puddles.'],
  ['🍂 601–650 · autumn', 'Maple canopies, pumpkin patches, orchards, hay bales, swirling leaves, harvest fields, gourds, seed pods, and golden grass.'],
  ['🪨 651–700 · zen', 'Balanced stones, raked sand, bamboo water features, still pools, bonsai, single leaves, mossy steps, and minimalist gardens.'],
  ['🐚 701–750 · ethereal coasts', 'Sea glass, abalone, pastel horizons, shells, moonlit sea, fog, foam, tide pools, sunbeams, and shoreline grasses.'],
  ['💎 751–800 · crystal + frost', 'Bismuth, quartz, amethyst, glacier ice, snowflakes, geodes, frozen webs, crevasses, mineral colors, and ice tunnels.'],
  ['🌵 801–850 · desert boho', 'Agave, terracotta dunes, desert sun, washed stone, dry roads, yucca, cholla, rock arches, badlands, and twilight.'],
  ['☁️ 851–900 · celestial', 'Milky Way bands, aurora curtains, nebulae, planets, cloud streets, sun halos, meteor streaks, dawn light, and thunderheads.'],
];

export default function PhysiologyPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="experiment · local-first physiological computing"
        title="physio persona · nature atlas"
        intro="A physiology-reactive tiny explorer living inside a 900-world nature atlas. The production renderer is now 2D-first: layered SVG illustration, deterministic Canvas atmosphere, pointer parallax, and a vector character rig. Every world keeps the same renderer-independent scene blueprint, so the strongest environments can later be promoted into richer Three.js and WebXR spaces without rebuilding the atlas model."
        actions={
          <>
            <ExternalLinkChip href="https://github.com/sidhulyalkar/WiFisio-Atlas">WiFisio-Atlas</ExternalLinkChip>
            <ExternalLinkChip href="https://github.com/sidhulyalkar/sids-neural-net">website source</ExternalLinkChip>
          </>
        }
      />

      <PhysiologyPersonaLab />

      <SectionShell eyebrow="rendering architecture" title="illustrate first, enter in 3D later">
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-xl border border-cyan/20 bg-cyan/[0.035] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">1 · production 2D</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              SVG owns crisp environmental forms and the vector persona. Canvas owns rain, snow, fog, stars, wind, glow, and other high-frequency effects. CSS and DOM own controls, accessibility, and lightweight transitions. Pointer movement creates layered parallax without requiring WebGL.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">2 · shared world contract</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              All 900 worlds still compile into the same focal subject, palette, foreground, midground, backdrop, atmosphere, motion, lighting, depth, camera, interaction, wildlife, activity, and deterministic-seed specification. Rendering is downstream of that contract.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">3 · experimental 3D</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              The existing React Three Fiber scene is preserved behind an explicit renderer toggle and dynamically loaded only on demand. Once a 2D world proves its composition and interaction, the same blueprint can drive real geometry, materials, lighting, depth, and eventually WebXR.
            </p>
          </article>
        </div>
      </SectionShell>

      <SectionShell eyebrow="2D scene engine" title="a tiny animated storybook window, not a static illustration">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['background', 'Color-scripted sky, celestial objects, clouds, distant ranges, islands, and atmospheric silhouettes move only slightly.'],
            ['world layers', 'Terrain, water, trees, flowers, cactus, mushrooms, crystal, rocks, wildlife, and focal objects are distributed deterministically from each world seed.'],
            ['living foreground', 'Nearby foliage moves farther with the pointer, creating depth while keeping the scene cheap enough for ordinary browsers and mobile GPUs.'],
            ['effects', 'A dedicated Canvas layer renders bounded rain, mist, snow, stars, fireflies, glow, and wind while respecting reduced-motion preferences.'],
          ].map(([title, copy]) => (
            <article key={title} className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-cyan/60">{title}</p>
              <p className="mt-3 text-xs leading-6 text-text-secondary/70">{copy}</p>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell eyebrow="field guide" title="seventeen collections, one continuous little universe">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-cyan/20 bg-cyan/[0.035] p-5">
            <h3 className="font-mono text-sm text-text-primary">🌲 001–100 · original atlas</h3>
            <p className="mt-2 text-xs leading-6 text-text-secondary/70">The first forests, water worlds, mountains, meadows, deserts, skies, caves, rivers, coasts, and playful nature landmarks that established the atlas vocabulary.</p>
          </article>
          {atlasCollections.map(([title, copy]) => (
            <article key={title} className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
              <h3 className="font-mono text-sm text-text-primary">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-text-secondary/70">{copy}</p>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell eyebrow="learning" title="train the persona, not a diagnosis">
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">explicit preference memory</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">Choosing a world or activity can update six transparent game preferences: curiosity, energy, collecting, exploring, calm-world affinity, and wild-world affinity. The sliders remain directly editable, and the entire local persona plus atlas state can be exported or erased.</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">recommendation does not self-train</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">The World Director may suggest or wander somewhere novel, but an algorithm-selected destination does not become evidence about the visitor merely because it was shown. Favorites and deliberate choices remain distinct explicit signals.</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">mood is temporary atmosphere</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">Calm, curious, energized, and sleepy are self-report controls for the current visit. They can affect recommendations and presentation without permanently rewriting personality. Physiological evidence can animate the body without becoming a psychological label.</p>
          </article>
        </div>
      </SectionShell>

      <SectionShell eyebrow="performance" title="900 worlds without 900 expensive renderers">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">2D by default</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">The normal experience mounts one SVG scene and one bounded Canvas effects layer. Canvas pixel ratio is capped, deterministic particle counts are bounded, and the atlas browser remains CSS-only with 48 entries per page.</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">3D is code-split</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">React Three Fiber is dynamically imported only after a visitor chooses the experimental renderer. The production path therefore does not initialize a WebGL context or build the Three.js scene graph just to display an atlas world.</p>
          </article>
        </div>
      </SectionShell>

      <SectionShell eyebrow="design rule" title="the avatar is downstream of evidence">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {layers.map((layer) => (
            <article key={layer.title} className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-cyan/60">{layer.title}</p>
              <p className="mt-3 text-xs leading-6 text-text-secondary/70">{layer.copy}</p>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell eyebrow="sleep" title="a benchmark before a badge">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
            <h3 className="font-mono text-sm text-text-primary">current capability</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">WiFisio currently has a respiration-oriented sleep mechanics study. It can estimate respiratory features, but that is not the same thing as validated sleep staging. A model-agnostic benchmark evaluates four-stage predictions against PSG-derived labels with calibration, abstention coverage, and per-subject results.</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
            <h3 className="font-mono text-sm text-text-primary">target experiment</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">The first serious target is patient-disjoint WiFi CSI plus polysomnography. Respiration reproduction comes first, then sleep/wake, then wake/light/deep/REM, always with simple baselines, held-out subjects, and calibration.</p>
          </article>
        </div>
      </SectionShell>

      <SectionShell eyebrow="camera" title="personal without pretending to read a mind">
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-mono text-sm text-text-primary">expression is animation evidence</h3>
              <p className="mt-3 text-xs leading-6 text-text-secondary/70">A future browser-local face-landmark adapter can supply smile intensity, blink rate, head pose, and mouth motion. Those are expression features, not ground-truth mood. Raw frames stay local unless a separate research protocol deliberately records them.</p>
            </div>
            <div>
              <h3 className="font-mono text-sm text-text-primary">appearance can stay ephemeral</h3>
              <p className="mt-3 text-xs leading-6 text-text-secondary/70">The current camera interaction samples only a soft appearance color in the browser. The explorer can gain richer local-only accessories and facial animation without requiring the public site to store a face, biometric template, or inferred identity.</p>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell eyebrow="promotion path" title="when a world earns real 3D">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['composition first', 'A 2D world should already have a recognizable focal subject, readable depth, successful palette, and a reason for the explorer to be there.'],
            ['interaction second', 'The world should contain an interaction worth carrying forward: water ripples, collecting, shelter building, fishing, weather, wildlife, or another scene-specific behavior.'],
            ['geometry third', 'Only then should the scene blueprint be translated into real geometry, materials, lights, shadows, and camera movement.'],
            ['WebXR last', 'The strongest 3D scenes can eventually expose an intentional “enter this world” transition instead of making immersive rendering mandatory for all 900 entries.'],
          ].map(([title, copy]) => (
            <article key={title} className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
              <h3 className="font-mono text-sm text-text-primary">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-text-secondary/70">{copy}</p>
            </article>
          ))}
        </div>
      </SectionShell>
    </PageShell>
  );
}
