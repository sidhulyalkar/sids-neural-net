import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getAllCaseStudies } from '@/lib/content/load-case-studies';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';

const neatlabsSystemMap = [
  {
    title: 'Go / No-Go and Go / Wait',
    description:
      'Behavioral inhibition and impulsivity paradigms where cues, waits, premature responses, omissions, rewards, and outcomes had to become reliable neural-alignment events.',
    tags: ['inhibition', 'impulsivity', 'event timing'],
  },
  {
    title: 'Delay Discounting',
    description:
      'Reward-value experiments connecting choice behavior, waiting cost, reward timing, and cortico-striatal beta dynamics.',
    tags: ['reward value', 'temporal discounting', 'beta'],
  },
  {
    title: 'Probabilistic Reversal Learning',
    description:
      'Changing-reward tasks used to study certainty, reversal behavior, high-gamma activity, and cortico-striatal network updates.',
    tags: ['reward certainty', 'reversal', 'high gamma'],
  },
  {
    title: 'Raspberry Pi Behavioral Boxes',
    description:
      'Operant-box infrastructure and MATLAB/Simulink workflows for controllable rodent behavior, synchronized events, and electrophysiology-ready experiments.',
    tags: ['raspberry pi', 'operant boxes', 'sync'],
  },
];

const datajointElementMap = [
  {
    title: 'element-facemap',
    description:
      'Integrated deep-learning training and inference component schemas for Facemap-style facial behavior analysis inside DataJoint workflows.',
    tags: ['facial inference', 'training schemas', 'inference schemas'],
  },
  {
    title: 'element-deeplabcut',
    description:
      'Added and tested model training and inference workflows, then worked through cloud deployment issues for GPU-backed pose estimation.',
    tags: ['pose estimation', 'model training', 'cloud gpu'],
  },
  {
    title: 'element-array-ephys',
    description:
      'Integrated SpikeInterface-style spike sorting workflows into DataJoint array electrophysiology schemas for reproducible, queryable processing.',
    tags: ['spikeinterface', 'spike sorting', 'provenance'],
  },
  {
    title: 'Lu Lab deployment',
    description:
      'Deployed and optimized DeepLabCut and Facemap pipelines for real behavioral video workflows at Lu Lab, Indiana University.',
    tags: ['lu lab', 'optimization', 'behavior video'],
  },
];

export const metadata: Metadata = {
  title: 'Deployed Systems',
  description:
    'System records for neuroscience data infrastructure, behavioral research systems, and real-time creative hardware builds.',
  alternates: {
    canonical: '/case-studies',
  },
  openGraph: {
    title: 'Deployed Systems | Sids Neural Net',
    description: 'A portfolio of deployed research systems, DataJoint workflows, behavioral paradigms, and real-time hardware builds.',
    url: '/case-studies',
  },
};

export default function CaseStudiesPage() {
  const caseStudies = getAllCaseStudies();

  return (
    <ComicSectionLayout
      eyebrow="infrastructure"
      title="deployed systems"
    >
      <div className="mb-10 max-w-3xl space-y-4">
        <p className="text-base leading-relaxed text-text-secondary">
          Systems I have helped build, operate, or translate into working research environments:
          cloud neuroscience workflows, behavioral experiment infrastructure, electrophysiology
          analysis systems, and real-time creative hardware.
        </p>
        <p className="text-sm leading-relaxed text-text-muted">
          The throughline is practical translation: taking messy signals, lab constraints, hardware,
          and human workflows, then shaping them into systems other people can actually use.
        </p>
      </div>

      {caseStudies.length > 0 ? (
        <div className="relative grid gap-5 lg:grid-cols-2">
          <svg className="absolute inset-0 hidden h-full w-full opacity-35 lg:block" aria-hidden="true">
            <polyline points="120,80 248,112 360,210 510,190 690,165 760,310 940,342" fill="none" stroke="rgba(102,227,255,0.16)" strokeWidth="1" strokeDasharray="3 7" />
            <polyline points="160,420 330,350 470,455 650,390 780,342 880,500 1080,470" fill="none" stroke="rgba(205,225,220,0.12)" strokeWidth="1" strokeDasharray="2 8" />
          </svg>
          {caseStudies.map((cs) => (
            <article key={cs.slug} className="node-shell relative z-10 flex h-full flex-col p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <p className="technical-label">system record</p>
                <span className="border border-green/25 bg-green/10 px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-green">
                  brief available
                </span>
              </div>
              <h2 className="text-xl font-semibold leading-tight text-text-primary">{cs.frontmatter.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-text-secondary">{cs.frontmatter.summary}</p>

              <dl className="mt-5 grid gap-3 border-t border-white/10 pt-4 text-sm">
                {cs.frontmatter.role && (
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">Role</dt>
                    <dd className="mt-1 text-text-secondary">{cs.frontmatter.role}</dd>
                  </div>
                )}
                {cs.frontmatter.scope && (
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">Scope</dt>
                    <dd className="mt-1 text-text-secondary">{cs.frontmatter.scope}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">Stack</dt>
                  <dd className="mt-1 text-text-secondary">{cs.frontmatter.tags.slice(0, 5).join(' / ') || 'Stack details'}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">Context</dt>
                  <dd className="mt-1 text-text-secondary">{cs.frontmatter.domains.join(' / ') || 'Deployment context'}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Link href={`/case-studies/${cs.slug}`} className="inline-flex min-h-10 items-center text-sm text-cyan hover:text-cyan-100">
                  Open system brief
                </Link>
                {cs.frontmatter.sourceUrl && (
                  <a
                    href={cs.frontmatter.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
                  >
                    Public source
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="node-shell flex min-h-[300px] items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-text-primary">No field system briefs yet</h2>
            <p className="mt-2 text-text-muted max-w-md">
              Add real deployment briefs in <span className="font-mono">content/case-studies</span>.
            </p>
          </div>
        </div>
      )}

      <section className="mt-12 border-t border-white/10 pt-10">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="technical-label">datajoint element work</p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">Reusable neuroscience workflow integrations</h2>
          </div>
          <Link href="/case-studies/datajoint-multimodal-pipelines" className="inline-flex min-h-10 items-center text-sm text-cyan hover:text-cyan-100">
            Open DataJoint brief
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {datajointElementMap.map((item) => (
            <article key={item.title} className="border border-white/10 bg-white/[0.02] p-5">
              <h3 className="text-base font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{item.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-white/10 bg-white/5 px-2 py-1 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 border-t border-white/10 pt-10">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="technical-label">research systems map</p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">NEATLABs behavioral systems scope</h2>
          </div>
          <Link href="/case-studies/neatlabs-core-research" className="inline-flex min-h-10 items-center text-sm text-cyan hover:text-cyan-100">
            Open NEATLABs brief
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {neatlabsSystemMap.map((item) => (
            <article key={item.title} className="border border-white/10 bg-white/[0.02] p-5">
              <h3 className="text-base font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{item.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-white/10 bg-white/5 px-2 py-1 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-base font-semibold text-text-primary">Experimental comparison space</h3>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Across these systems, the analysis work had to support comparisons across healthy and TBI-related animal
            cohorts, task conditions, trial outcomes, and pharmacological contexts including saline, methylphenidate,
            and ketamine where relevant to the lab&apos;s experiments.
          </p>
        </div>
      </section>
    </ComicSectionLayout>
  );
}
