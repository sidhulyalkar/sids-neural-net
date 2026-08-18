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
    'An evidence-first 3D physiological persona experiment connecting privacy-safe WiFi sensing research, local camera interaction, uncertainty, and replayable research snapshots.',
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
    copy: 'The validated evidence object can drive a whimsical 3D persona, environments, tasks, and preference learning without changing the scientific record.',
  },
];

export default function PhysiologyPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="experiment · local-first physiological computing"
        title="physio persona"
        intro="A living interface for exploring what contactless sensing can actually recover from the body. The character can be playful; the evidence underneath it stays typed, uncertain, consent-aware, and research-only."
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
              WiFisio currently has a respiration-oriented sleep mechanics study. It can estimate respiratory features, but that is not the same thing as validated sleep staging. A new model-agnostic benchmark in the research repository evaluates four-stage predictions against PSG-derived labels using accuracy, balanced accuracy, macro F1, kappa, calibration, probability quality, abstention coverage, and per-subject results.
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

      <SectionShell eyebrow="camera + personality" title="personal without pretending to read a mind">
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-mono text-sm text-text-primary">expression is animation evidence</h3>
              <p className="mt-3 text-xs leading-6 text-text-secondary/70">
                A future browser-local face-landmark adapter can supply smile intensity, blink rate, head pose, and mouth motion. Those are expression features, not ground-truth mood. Actual mood can be explicitly self-reported. Raw frames stay local unless a separate research protocol deliberately records them.
              </p>
            </div>
            <div>
              <h3 className="font-mono text-sm text-text-primary">personality is a game layer</h3>
              <p className="mt-3 text-xs leading-6 text-text-secondary/70">
                The little explorer can learn which worlds, activities, accessories, and interaction styles a visitor chooses. Those transparent preferences can change its adventures over time. They should remain editable and resettable, and they should never be presented as a psychological profile inferred from physiology or a face.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell eyebrow="next" title="from portfolio toy to open research interface">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['1 · replay', 'Publish de-identified experiment snapshots so anyone can inspect model confidence, failures, and abstentions in this viewer.'],
            ['2 · sleep benchmark', 'Adapt the public synchronized WiFi + PSG sleep dataset and freeze patient-disjoint evaluation before model iteration.'],
            ['3 · secure bridge', 'Pair a local WiFisio companion to the site with short-lived scoped tokens and a persona-only stream. Never expose the Research Hub directly.'],
            ['4 · avatar worlds', 'Let the persona collect signal motes, explore tiny environments, rest, race, garden, or study according to explicit user preferences and trustworthy evidence.'],
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
