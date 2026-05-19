import { Metadata } from 'next';
import Link from 'next/link';
import { getAllCaseStudies } from '@/lib/content/load-case-studies';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';

export const metadata: Metadata = {
  title: 'Deployed Systems',
  description:
    'Deep system dives into significant neuroscience data systems, applied AI builds, and technical architecture.',
  alternates: {
    canonical: '/case-studies',
  },
  openGraph: {
    title: 'Deployed Systems | Sid Neural Net',
    description: 'Deep project dives into major systems, technical tradeoffs, and architecture.',
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
        {caseStudies.length > 0 ? (
          <div className="relative grid gap-5 lg:grid-cols-3">
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
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">Stack</dt>
                    <dd className="mt-1 text-text-secondary">{cs.frontmatter.tags.slice(0, 5).join(' / ') || 'Stack details'}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">Modalities</dt>
                    <dd className="mt-1 text-text-secondary">{cs.frontmatter.domains.join(' / ') || 'Deployment context'}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">Role</dt>
                    <dd className="mt-1 text-text-secondary">Documented in project brief</dd>
                  </div>
                </dl>

                <Link href={`/case-studies/${cs.slug}`} className="mt-5 inline-flex min-h-10 items-center text-sm text-cyan hover:text-cyan-100">
                  Open system brief
                </Link>
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
    </ComicSectionLayout>
  );
}
