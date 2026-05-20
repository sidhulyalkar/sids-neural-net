import { Metadata } from 'next';
import { Mountain, Gamepad2, Utensils, Tv, Waves, Dog, Heart } from 'lucide-react';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';

export const metadata: Metadata = {
  title: 'Life',
  description: 'Adventures, interests, and life outside the lab.',
  alternates: {
    canonical: '/life',
  },
  openGraph: {
    title: 'Life | Sid's Neural Net',
    description: 'Personal interests, field attention, and life outside the lab.',
    url: '/life',
  },
};

const interests = [
  { icon: Mountain, title: 'Adventure', description: 'Hiking, backpacking, trails with Shasta.', color: 'green' },
  { icon: Waves, title: 'Water Sports', description: 'Surfing, paddleboarding, California coast.', color: 'cyan' },
  { icon: Gamepad2, title: 'Gaming', description: 'Competitive shooters to story-driven RPGs.', color: 'violet' },
  { icon: Tv, title: 'Anime & Media', description: 'Animation as an art form.', color: 'rose' },
  { icon: Utensils, title: 'Food', description: 'Cuisines, cooking, best local spots.', color: 'amber' },
];

export default function LifePage() {
  return (
    <ComicSectionLayout
      eyebrow="personal"
      title="life"
    >
      <div className="max-w-3xl space-y-8">
        {/* Shasta Section */}
        <section className="node-shell p-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex h-32 w-32 flex-shrink-0 items-center justify-center border border-rose/20 bg-gradient-to-br from-amber/10 to-rose/10">
              <Dog className="w-12 h-12 text-rose/50" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-rose" />
                <h2 className="font-mono text-sm uppercase tracking-wide text-text-primary">Shasta</h2>
              </div>
              <p className="text-sm text-text-secondary">
                Trail scout, snow enthusiast, morale engineer.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2 py-0.5 text-xs bg-rose/10 text-rose">Trail Expert</span>
                <span className="px-2 py-0.5 text-xs bg-amber/10 text-amber">Snow Enthusiast</span>
              </div>
            </div>
          </div>
        </section>

        {/* Interests */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {interests.map((interest) => {
            const Icon = interest.icon;
            return (
              <div key={interest.title} className="border border-white/10 bg-white/[0.02] p-4">
                <Icon className="w-5 h-5 mb-2" style={{ color: `var(--${interest.color})` }} />
                <h3 className="font-mono text-xs uppercase tracking-wide text-text-primary">{interest.title}</h3>
                <p className="text-xs text-text-muted mt-1">{interest.description}</p>
              </div>
            );
          })}
        </section>
      </div>
    </ComicSectionLayout>
  );
}
