import { Metadata } from 'next';
import { getAllCaseStudies } from '@/lib/content/load-case-studies';
import { CaseStudyCard } from '@/components/case-studies';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Deep project dives into significant systems and their technical architecture.',
};

export default function CaseStudiesPage() {
  const caseStudies = getAllCaseStudies();

  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 max-w-4xl">
          <p className="technical-label">Project Deep Dives</p>
          <h1 className="mt-4 text-5xl font-black tracking-tight text-text-primary md:text-7xl">Projects</h1>
          <p className="mt-4 text-lg text-text-secondary">
            {caseStudies.length} deeper reads on the systems, architecture, tradeoffs, and lessons behind major builds.
          </p>
        </div>

        {caseStudies.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {caseStudies.map((cs) => (
              <CaseStudyCard key={cs.slug} caseStudy={cs} />
            ))}
          </div>
        ) : (
          <div className="glass-card min-h-[300px] flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-cyan/20 flex items-center justify-center">
                <svg className="h-8 w-8 text-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-text-primary">No Project Deep Dives Yet</h3>
              <p className="mt-2 text-text-muted max-w-md">
                Project writeups will be added soon.
              </p>
            </div>
          </div>
        )}

        {/* Note */}
        <div className="node-shell mt-12 p-4">
          <p className="text-sm text-text-muted">
            Project briefs detail the technical decisions, challenges, and outcomes of major systems.
            Some details are generalized to protect proprietary information.
          </p>
        </div>
      </div>
    </div>
  );
}
