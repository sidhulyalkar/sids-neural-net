'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, FileText, ExternalLink } from 'lucide-react';
import { MotionGlassCard, SectionHeader, TagPill, GlowButton } from '@/components/ui';

const publications = [
  {
    id: 'beta-high-gamma-2025',
    title: 'Beta and High Gamma Oscillations in the Cortico-striatal Network Link to Learned Reward Value',
    authors: ['Miranda F. Koloski', 'Morteza Salimi', 'Sidharth Hulyalkar', 'et al.'],
    venue: 'Journal of Neuroscience',
    year: 2025,
    doi: '10.1523/JNEUROSCI.1234-24.2025',
    tags: ['Neuroscience', 'Electrophysiology', 'Reward'],
  },
  {
    id: 'dmn-suppression-2021',
    title: 'Electrophysiological Correlates of Rodent Default-Mode Network Suppression Revealed by Large-Scale Local Field Potential Recordings',
    authors: ['Leila Fakhraei', 'Miranda Francoeur', 'Sidharth Hulyalkar', 'et al.'],
    venue: 'Cerebral Cortex Communications',
    year: 2021,
    doi: '10.1093/texcom/tgab017',
    tags: ['LFP', 'Default-Mode Network', 'Neuroscience'],
  },
  {
    id: 'chronic-probe-2021',
    title: 'Chronic, Multi-Site Recordings Supported by Two Low-Cost, Stationary Probe Designs',
    authors: ['Miranda J. Francoeur', 'Tianzhi Tang', 'Sidharth Hulyalkar', 'et al.'],
    venue: 'Frontiers in Psychiatry',
    year: 2021,
    doi: '10.3389/fpsyt.2021.678103',
    tags: ['Electrophysiology', 'Probe Design', 'Methods'],
  },
];

export function PublicationsHighlight() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          title="Publications"
          subtitle="Peer-reviewed research in neuroscience and neural engineering."
          accentColor="amber"
        />

        <div className="space-y-4">
          {publications.map((pub, index) => (
            <motion.div
              key={pub.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <MotionGlassCard glow="amber" className="group">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 hidden md:flex h-12 w-12 items-center justify-center rounded-xl bg-amber/10 border border-amber/20">
                    <FileText className="h-6 w-6 text-amber" />
                  </div>

                  {/* Content */}
                  <div className="flex-grow">
                    <h3 className="text-lg font-semibold text-text-primary group-hover:text-amber transition-colors">
                      {pub.title}
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      {pub.authors.join(', ')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-amber font-medium">{pub.venue}</span>
                      <span className="text-text-muted">{pub.year}</span>
                      {pub.doi && (
                        <a
                          href={`https://doi.org/${pub.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-text-muted hover:text-cyan transition-colors"
                        >
                          DOI
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pub.tags.map((tag) => (
                        <TagPill key={tag} color="amber" size="sm">
                          {tag}
                        </TagPill>
                      ))}
                    </div>
                  </div>
                </div>
              </MotionGlassCard>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <GlowButton href="/publications" variant="secondary" glowColor="amber">
            View All Publications
            <ArrowRight className="h-4 w-4" />
          </GlowButton>
        </div>
      </div>
    </section>
  );
}
