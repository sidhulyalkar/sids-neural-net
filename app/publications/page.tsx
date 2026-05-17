import { Metadata } from 'next';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';
import { PublicationCard } from '@/components/publications';

export const metadata: Metadata = {
  title: 'Publications',
  description: 'Peer-reviewed publications in neuroscience, neural engineering, and computational methods.',
};

export default function PublicationsPage() {
  const graph = NeuralGraphSchema.parse(graphData);

  // Filter for publications only and sort by year
  const publications = graph.nodes
    .filter((n) => n.type === 'publication')
    .sort((a, b) => {
      const yearA = a.publication?.year || 0;
      const yearB = b.publication?.year || 0;
      return yearB - yearA;
    });

  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary">Publications</h1>
          <p className="mt-2 text-lg text-text-secondary">
            {publications.length} peer-reviewed publications in neuroscience, neural engineering, and computational methods.
          </p>
        </div>

        {/* Publications List */}
        {publications.length > 0 ? (
          <div className="space-y-6">
            {publications.map((pub) => (
              <PublicationCard key={pub.id} publication={pub} />
            ))}
          </div>
        ) : (
          <div className="glass-card min-h-[300px] flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-violet/20 flex items-center justify-center">
                <svg className="h-8 w-8 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-text-primary">No Publications Yet</h3>
              <p className="mt-2 text-text-muted">
                Publication data will be populated from the data layer.
              </p>
            </div>
          </div>
        )}

        {/* Research Note */}
        <div className="mt-12 p-4 bg-bg-panel/50 border border-border-subtle rounded-lg">
          <h3 className="text-sm font-medium text-text-primary mb-2">Research Affiliations</h3>
          <p className="text-sm text-text-secondary">
            Publications from NEATLABs at UC San Diego under the guidance of Dr. Lara Bhatt,
            focusing on neural dynamics, behavioral decoding, and computational neuroscience methods.
          </p>
        </div>
      </div>
    </div>
  );
}
