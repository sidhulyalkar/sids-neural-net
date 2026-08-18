import type { Metadata } from 'next';
import { PhysiologyPersonaLab } from '@/components/physiology/PhysiologyPersonaLab';
import {
  ExternalLinkChip,
  PageHeader,
  PageShell,
  SectionShell,
} from '@/components/portfolio/PageShell';

export const metadata: Metadata = {
  title: 'PhysioPersona | Sidharth Hulyalkar',
  description:
    'A local-first 3D physiological persona and adaptive tiny nature world connecting privacy-safe sensing evidence, explicit preferences, playful exploration, and replayable research snapshots.',
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
    copy: 'The evidence can animate a tiny explorer while explicit choices shape its worlds, habits, and memories as a separate local game layer.',
  },
];

export default function PhysiologyPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="experiment · local-first physiological computing"
        title="physio persona"
        intro="Part evidence viewer, part tiny nature world. A small 3D explorer can breathe with trustworthy signals, wander through landscapes, perform ridiculous little tasks, and gradually learn the places and activities a visitor explicitly chooses. The science stays typed and uncertain; the personality stays playful, inspectable, and local."
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

      <SectionShell eyebrow="tiny worlds" title="nature as the persona's changing playground">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['🏔️ snowy ridge', 'Pines, distant peaks, cairns, stargazing, collecting rocks, and an entirely unnecessary snow-angel career.'],
            ['🌿 fern jungle', 'Huge leaves, moss, glowing insects, wandering, gardening, and following fireflies with poor navigational discipline.'],
            ['🔥 fire cave', 'A warm little shelter for mineral collecting, campfire loafing, resting, and quiet late-night star watching near the entrance.'],
            ['🏞️ river bend', 'Reeds, stepping stones, fishing, stone skipping, wandering, and a suspiciously decorative bridge-shaped future.'],
            ['🌊 windy coast', 'Sand, water, shells, sea grass, shoreline exploring, and tiny adventures under very large weather.'],
            ['🌼 wildflower meadow', 'Flowers, gardens, fireflies, mushrooms, naps, and first-rate lying-down-looking-at-the-sky infrastructure.'],
          ].map(([title, copy]) => (
            <article key={title} className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
              <h3 className="font-mono text-sm text-text-primary">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-text-secondary/70">{copy}</p>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell eyebrow="learning" title="train the persona, not a diagnosis">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">explicit preference memory</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              Choosing worlds and activities slowly updates six transparent game preferences: curiosity, energy, collecting, exploring, calm-world affinity, and wild-world affinity. Visitors can inspect the values, drag the sliders themselves, export the JSON, or erase everything. The state lives in localStorage rather than a hidden behavioral profile on a server.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h3 className="font-mono text-sm text-text-primary">mood is temporary atmosphere</h3>
            <p className="mt-3 text-xs leading-6 text-text-secondary/70">
              Calm, curious, energized, and sleepy are explicit self-report controls for the current visit. They can influence light, pace, stars, and recommendations, but they do not permanently alter the saved trait vector. Physiology can still change evidence-reactive body animation without being converted into a psychological label.
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
                The current camera interaction samples only a soft appearance color in the browser. The little explorer can eventually gain richer local-only accessories and facial animation without requiring the public site to store a face, biometric template, or inferred identity.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell eyebrow="next" title="where the little world can grow">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['1 · richer adventures', 'Add weather events, day/night cycles, discoverable objects, tiny shelters, seasonal variants, and rare world transitions while keeping scene assets lightweight.'],
            ['2 · replay memories', 'Let de-identified physiology replays become special journeys the persona can revisit, with confidence and abstentions still visible underneath the animation.'],
            ['3 · browser-local face rig', 'Drive eyes, mouth, blink, and head pose from local landmarks while keeping self-reported mood distinct from expression features.'],
            ['4 · secure live bridge', 'Pair a local WiFisio companion with short-lived scoped tokens and stream only persona-safe evidence, never the local Research Hub or raw RF.'],
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
