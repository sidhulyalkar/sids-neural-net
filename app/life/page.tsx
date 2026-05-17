import { Metadata } from 'next';
import { Mountain, Gamepad2, Utensils, Tv, Waves, Dog, Heart } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Life',
  description: 'Adventures, interests, and life outside the lab.',
};

const interests = [
  {
    icon: Mountain,
    title: 'Adventure',
    description: 'Hiking, backpacking, and exploring trails with Shasta. From local peaks to backcountry adventures.',
    color: 'green',
  },
  {
    icon: Waves,
    title: 'Water Sports',
    description: 'Surfing, paddleboarding, and enjoying the California coast.',
    color: 'cyan',
  },
  {
    icon: Gamepad2,
    title: 'Gaming',
    description: 'From competitive shooters to story-driven RPGs. Currently playing through various indies.',
    color: 'violet',
  },
  {
    icon: Tv,
    title: 'Anime & Media',
    description: 'Appreciating animation as an art form. Always open to recommendations.',
    color: 'rose',
  },
  {
    icon: Utensils,
    title: 'Food',
    description: 'Exploring cuisines, cooking experiments, and finding the best local spots.',
    color: 'amber',
  },
];

export default function LifePage() {
  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-text-primary">Life Outside the Lab</h1>
          <p className="mt-4 text-lg text-text-secondary">
            I like systems that move: brains, trails, teams, games, oceans, codebases, and conversations.
          </p>
        </div>

        {/* Shasta Section */}
        <section className="mb-16">
          <div className="glass-card overflow-hidden">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Shasta avatar placeholder */}
              <div className="flex-shrink-0">
                <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl bg-gradient-to-br from-amber/20 to-rose/20 flex items-center justify-center border border-rose/20">
                  <Dog className="w-24 h-24 text-rose/60" />
                </div>
              </div>

              {/* Shasta content */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Heart className="w-5 h-5 text-rose" />
                  <h2 className="text-2xl font-bold text-text-primary">Meet Shasta</h2>
                </div>
                <p className="text-text-secondary mb-4">
                  The real star of this website. Trail scout, snow goblin, morale engineer.
                  She&apos;s the reason half my hikes have become more interesting and the other half have become
                  stories about chasing her up ridgelines.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 text-sm bg-rose/10 text-rose rounded-full">
                    Trail Expert
                  </span>
                  <span className="px-3 py-1 text-sm bg-amber/10 text-amber rounded-full">
                    Snow Enthusiast
                  </span>
                  <span className="px-3 py-1 text-sm bg-green/10 text-green rounded-full">
                    Adventure Partner
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interests Grid */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Interests</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interests.map((interest) => {
              const Icon = interest.icon;
              return (
                <div
                  key={interest.title}
                  className="glass-card hover:border-rose/20 transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-lg bg-${interest.color}/10`}
                      style={{ backgroundColor: `rgba(var(--${interest.color}-rgb, 102, 227, 255), 0.1)` }}
                    >
                      <Icon
                        className="w-6 h-6"
                        style={{ color: `var(--${interest.color})` }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary group-hover:text-rose transition-colors">
                        {interest.title}
                      </h3>
                      <p className="text-sm text-text-secondary mt-1">{interest.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Philosophy */}
        <section className="mb-16">
          <div className="glass-card bg-gradient-to-br from-bg-panel to-bg-deep">
            <h2 className="text-xl font-bold text-text-primary mb-4">On Balance</h2>
            <blockquote className="text-text-secondary italic border-l-2 border-rose/30 pl-4">
              &quot;The best research happens when you&apos;re not at your desk. The best ideas
              come from the intersection of technical depth and lived experience.
              Trails teach patience. Games teach systems thinking. Food teaches
              creativity. It all feeds back.&quot;
            </blockquote>
          </div>
        </section>

        {/* Footer note */}
        <div className="text-center text-sm text-text-muted">
          <p>
            This page exists because neural networks aren&apos;t just algorithms.
            <br />
            The human ones need hobbies too.
          </p>
        </div>
      </div>
    </div>
  );
}
