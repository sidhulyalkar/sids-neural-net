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
    'A local-first physiological persona exploring 900 deterministic miniature nature worlds, combining privacy-safe sensing evidence, explicit game preferences, layered 2.5D rendering, and inspectable local memory.',
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
    copy: 'Evidence can animate the explorer while explicit choices shape a completely separate local preference model, world history, favorites, and field journal.',
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
        intro="A physiology-reactive tiny explorer living inside a 900-world procedural nature atlas. Each world is rendered as an illustrated 2.5D diorama in real 3D space, with layered parallax, atmosphere, motion, wildlife, activities, and an inspectable rendering blueprint. The body can react to measured evidence; the personality only learns from choices you deliberately make."
        actions={
          <>
            <ExternalLinkChip href="https://github.com/sidhulyalkar/WiFisio-Atlas">
              WiFisio-Atlas
            </ExternalLinkChip>
            <ExternalLinkChip href="https://github.com/sidhulyalkar/sids-neural-net">
              website source
            </ExternalLinkChip>
          </>
        }
      />

      <PhysiologyPersonaLab />

      <SectionShell eyebrow="atlas architecture" title="900 worlds without 900 hard-coded scenes">
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">world manifest</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              Every world has a stable ID, collection, terrain, palette, focal subject, wildlife, activity set, atmosphere, preference bias, and deterministic seed. The atlas is data first, so a new world is a scene specification rather than another page of fragile rendering code.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">scene compiler</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              Each specification becomes a richer visual brief: foreground, midground, backdrop, depth mode, camera grammar, lighting, motion, interaction cue, and a vocabulary of renderable subjects such as trees, mushrooms, coral, crystal, water, mountains, weather, celestial cards, and wildlife.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">2.5D diorama renderer</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              Flat-shaded props and illustration-like planes live at real 3D depths. Orbiting the camera separates the layers with parallax, while procedural animation gives water, fog, rain, snow, glow, foliage, celestial events, and tiny animals just enough motion to feel inhabited.
            </p>
          </article>
        </div>
      </SectionShell>

      <SectionShell eyebrow="field guide" title="seventeen collections, one continuous little universe">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-cyan/20 bg-cyan/[0.035] p-5">
            <h3 className="font-mono text-sm text-text-primary">🌲 001–100 · original atlas</h3>
            <p className="mt-2 text-xs leading-6 text-text-secondary/70">The first forests, water worlds, mountains, meadows, deserts, skies, caves, rivers, coasts, and playful nature landmarks that established the visual language.</p>
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
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              Choosing a world or activity can update six transparent game preferences: curiosity, energy, collecting, exploring, calm-world affinity, and wild-world affinity. The sliders remain directly editable, and the entire persona plus atlas state can be exported or erased.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">recommendation does not self-train</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              The World Director can suggest or automatically wander to somewhere novel, but an algorithm-selected destination does not become evidence about the visitor merely because it was shown. Favorites and deliberate choices remain distinct explicit signals.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">mood is temporary atmosphere</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              Calm, curious, energized, and sleepy are self-report controls for the current visit. They can affect recommendations and presentation without permanently rewriting personality. Physiological evidence can animate the body without being turned into a psychological label.
            </p>
          </article>
        </div>
      </SectionShell>

      <SectionShell eyebrow="performance" title="large atlas, one WebGL world at a time">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">lightweight field guide</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              The browser never mounts 900 WebGL canvases. Atlas cards use tiny CSS previews and render 48 entries per page. Only the selected world owns a React Three Fiber scene, with bounded object counts, deterministic scatter, and a capped device pixel ratio.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">procedural assets over downloads</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              Most geometry is generated from reusable primitives instead of hundreds of texture packs or heavy GLTF files. A pine, coral shelf, shell, crystal cluster, aurora ribbon, or cloud layer can be recolored and composed from the world blueprint while retaining a consistent visual style.
            </p>
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
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              WiFisio currently has a respiration-oriented sleep mechanics study. It can estimate respiratory features, but that is not the same thing as validated sleep staging. A model-agnostic benchmark in the research repository evaluates four-stage predictions against PSG-derived labels using accuracy, balanced accuracy, macro F1, kappa, calibration, probability quality, abstention coverage, and per-subject results.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
            <h3 className="font-mono text-sm text-text-primary">target experiment</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              The first serious target is patient-disjoint WiFi CSI plus polysomnography. Respiration reproduction comes first, then sleep/wake, then wake/light/deep/REM. Every stage keeps a simple baseline, null controls, held-out subjects, and calibration so a prettier sequence model cannot quietly hide leakage.
            </p>
          </article>
        </div>
      </SectionShell>

      <SectionShell eyebrow="camera" title="personal without pretending to read a mind">
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-mono text-sm text-text-primary">expression is animation evidence</h3>
              <p className="mt-3 text-xs leading-6 text-text-secondary/70">
                A future browser-local face-landmark adapter can supply smile intensity, blink rate, head pose, and mouth motion. Those are expression features, not ground-truth mood. Actual mood remains explicitly self-reported. Raw frames stay local unless a separate research protocol deliberately records them.
              </p>
            </div>
            <div>
              <h3 className="font-mono text-sm text-text-primary">appearance can stay ephemeral</h3>
              <p className="mt-3 text-xs leading-6 text-text-secondary/70">
                The current camera interaction samples only a soft appearance color in the browser. The explorer can gain richer local-only accessories and facial animation without requiring the public site to store a face, biometric template, or inferred identity.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell eyebrow="next" title="where the atlas can grow without losing its rules">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['1 · persistent objects', 'Let collected shells, stones, seeds, flowers, and crystals appear back at the explorer’s tiny home as explicitly earned decorations.'],
            ['2 · daily world state', 'Use deterministic local date seeds for weather and rare discoveries, then compute elapsed changes when the visitor returns rather than pretending a browser tab simulated life in the background.'],
            ['3 · richer hero silhouettes', 'Continue expanding reusable focal-object families so even extremely specific entries such as honeycomb, observatory, pumpkin, sea glass, mineral geodes, and garden structures gain bespoke geometry.'],
            ['4 · replay memories', 'Let de-identified physiology replays become special journeys the persona can revisit while confidence, observability, and abstentions remain inspectable underneath.'],
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
