'use client';

import { motion } from 'framer-motion';
import { Hammer, BookOpen, ExternalLink } from 'lucide-react';
import { GlassCard, TagPill } from '@/components/ui';

const currentProjects = [
  {
    type: 'building',
    title: 'neurOS-v1',
    description: 'Real-time neural data streaming, processing, and classification framework',
    tags: ['BCI', 'Real-Time', 'Python'],
    link: 'https://github.com/sidhulyalkar/neurOS-v1',
  },
  {
    type: 'building',
    title: 'neural-mm-tf-mechint',
    description: 'Mechanistic interpretability tools for neural multi-modal transformers',
    tags: ['Mechanistic Interp', 'Transformers'],
    link: 'https://github.com/sidhulyalkar/neural-mm-tf-mechint',
  },
];

const currentLearning = [
  {
    type: 'learning',
    title: 'Mechanistic Interpretability',
    description: 'Circuit discovery, path patching, and latent interventions in neural networks',
    tags: ['Research', 'ML Theory'],
  },
  {
    type: 'learning',
    title: 'Rust for Systems Programming',
    description: 'Building high-performance, low-latency systems for real-time neural processing',
    tags: ['Rust', 'Systems'],
  },
];

export function CurrentlyBuilding() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-bg-panel/30">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Currently Building */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10 border border-cyan/20">
                <Hammer className="h-5 w-5 text-cyan" />
              </div>
              <h3 className="text-xl font-semibold text-text-primary">
                Currently Building
              </h3>
            </div>

            <div className="space-y-4">
              {currentProjects.map((project, index) => (
                <motion.div
                  key={project.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GlassCard hover padding="sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-medium text-text-primary">
                          {project.title}
                        </h4>
                        <p className="mt-1 text-sm text-text-muted">
                          {project.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {project.tags.map((tag) => (
                            <TagPill key={tag} color="cyan" size="sm">
                              {tag}
                            </TagPill>
                          ))}
                        </div>
                      </div>
                      {project.link && (
                        <a
                          href={project.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 p-2 text-text-muted hover:text-cyan transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Currently Learning */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/10 border border-violet/20">
                <BookOpen className="h-5 w-5 text-violet" />
              </div>
              <h3 className="text-xl font-semibold text-text-primary">
                Currently Learning
              </h3>
            </div>

            <div className="space-y-4">
              {currentLearning.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GlassCard hover padding="sm">
                    <h4 className="font-medium text-text-primary">
                      {item.title}
                    </h4>
                    <p className="mt-1 text-sm text-text-muted">
                      {item.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <TagPill key={tag} color="violet" size="sm">
                          {tag}
                        </TagPill>
                      ))}
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
