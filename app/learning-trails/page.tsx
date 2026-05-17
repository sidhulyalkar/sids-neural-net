import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Learning Trails',
  description: 'A structured map of current learning paths and areas of study.',
};

export default function LearningTrailsPage() {
  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary">Learning Trails</h1>
          <p className="mt-2 text-lg text-text-secondary">
            A structured map of current learning paths and areas of active study.
          </p>
        </div>

        <div className="glass-card min-h-[400px] flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-violet/20 flex items-center justify-center">
              <svg className="h-8 w-8 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-text-primary">Learning Trails Coming Soon</h3>
            <p className="mt-2 text-text-muted max-w-md">
              Structured learning paths for mechanistic interpretability, systems programming, and more.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
