import { Metadata } from 'next';
import { getAllCaseStudies } from '@/lib/content/load-case-studies';
import { CaseStudyCard } from '@/components/case-studies';

export const metadata: Metadata = {
  title: 'Case Studies',
  description: 'Deep dives into significant projects and their technical architecture.',
};

export default function CaseStudiesPage() {
  const caseStudies = getAllCaseStudies();

  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary">Case Studies</h1>
          <p className="mt-2 text-lg text-text-secondary">
            {caseStudies.length} deep dives into significant projects, their technical architecture, and lessons learned.
          </p>
        </div>

        {/* Case Studies Grid */}
        {caseStudies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <h3 className="text-xl font-semibold text-text-primary">No Case Studies Yet</h3>
              <p className="mt-2 text-text-muted max-w-md">
                Case studies will be added soon.
              </p>
            </div>
          </div>
        )}

        {/* Note */}
        <div className="mt-12 p-4 bg-bg-panel/50 border border-border-subtle rounded-lg">
          <p className="text-sm text-text-muted">
            Case studies detail the technical decisions, challenges, and outcomes of major projects.
            Some details are generalized to protect proprietary information.
          </p>
        </div>
      </div>
    </div>
  );
}
