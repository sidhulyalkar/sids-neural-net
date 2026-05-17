import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Field Notes',
  description: 'Thoughts, explorations, and notes on neural data systems, ML, and research.',
};

export default function FieldNotesPage() {
  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary">Field Notes</h1>
          <p className="mt-2 text-lg text-text-secondary">
            Thoughts, explorations, and notes on neural data systems, ML, and research directions.
          </p>
        </div>

        <div className="glass-card min-h-[400px] flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green/20 flex items-center justify-center">
              <svg className="h-8 w-8 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-text-primary">Field Notes Coming Soon</h3>
            <p className="mt-2 text-text-muted max-w-md">
              Blog-style notes for thinking in public about neural systems, ML, and research.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
