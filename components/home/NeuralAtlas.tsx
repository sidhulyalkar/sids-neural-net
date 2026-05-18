'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

type AtlasMode = 'All' | 'Research' | 'Engineering' | 'Creative' | 'Personal';

type AtlasNode = {
  id: string;
  label: string;
  detail: string;
  x: number;
  y: number;
  size: number;
  modes: AtlasMode[];
  href: string;
};

const modes: AtlasMode[] = ['All', 'Research', 'Engineering', 'Creative', 'Personal'];

const nodes: AtlasNode[] = [
  { id: 'infra', label: 'Neural Data Infrastructure', detail: 'DataJoint, cloud workflows, multimodal experiments', x: 28, y: 31, size: 21, modes: ['Research', 'Engineering'], href: '/projects' },
  { id: 'foundation', label: 'Foundation Models', detail: 'Tokenization, long-context brain dynamics, neurOS', x: 52, y: 19, size: 19, modes: ['Research', 'Engineering'], href: '/projects' },
  { id: 'interp', label: 'Mechanistic Interpretability', detail: 'Circuit discovery, probes, interventions', x: 75, y: 35, size: 16, modes: ['Research'], href: '/projects' },
  { id: 'bci', label: 'BCI / Real-Time Systems', detail: 'Closed-loop decoding and latency-aware middleware', x: 34, y: 66, size: 17, modes: ['Research', 'Engineering'], href: '/neural-net' },
  { id: 'panoptic', label: 'Applied AI / Panoptic Bio', detail: 'Clinical intelligence, evaluation, production AI', x: 62, y: 61, size: 18, modes: ['Engineering'], href: '/projects' },
  { id: 'photo', label: 'Photography / Field Notes', detail: 'Texture, timing, landscape memory, light', x: 21, y: 82, size: 12, modes: ['Creative', 'Personal'], href: '#photography' },
  { id: 'shasta', label: 'Shasta / Outdoor Exploration', detail: 'Field energy, trail rhythm, attention outside the lab', x: 83, y: 78, size: 13, modes: ['Personal'], href: '/life' },
  { id: 'writing', label: 'Writing / Ideas', detail: 'Research notes, learning trails, system sketches', x: 48, y: 84, size: 12, modes: ['Creative', 'Research'], href: '/field-notes' },
  { id: 'contact', label: 'Contact', detail: 'Collaborations, roles, research conversations', x: 89, y: 54, size: 11, modes: ['All'], href: '/contact' },
];

const edges = [
  ['infra', 'foundation'],
  ['infra', 'bci'],
  ['foundation', 'interp'],
  ['foundation', 'panoptic'],
  ['bci', 'panoptic'],
  ['photo', 'writing'],
  ['shasta', 'photo'],
  ['writing', 'interp'],
  ['panoptic', 'contact'],
  ['shasta', 'contact'],
];

export function NeuralAtlas() {
  const [mode, setMode] = useState<AtlasMode>('All');
  const [activeNode, setActiveNode] = useState<AtlasNode | null>(nodes[0]);

  const visibleNodes = useMemo(() => {
    if (mode === 'All') return nodes;
    return nodes.filter((node) => node.modes.includes(mode));
  }, [mode]);

  const visibleIds = new Set(visibleNodes.map((node) => node.id));

  return (
    <section id="atlas" className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <p className="technical-label">Curated Network</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-text-primary md:text-6xl">
              A neural atlas, not a brochure.
            </h2>
            <p className="mt-5 max-w-2xl text-text-secondary">
              The site is organized around the systems I keep returning to: brain data infrastructure,
              adaptive AI, interpretability, real-time interfaces, visual field notes, and the human
              inputs that make the technical work sharper.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {modes.map((item) => (
                <button
                  key={item}
                  onClick={() => setMode(item)}
                  className={`signal-button ${mode === item ? 'border-cyan/70 bg-cyan/20 text-cyan-100' : ''}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="neural-panel neural-panel-cut relative min-h-[560px] overflow-hidden p-4 sm:p-6">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {edges.map(([sourceId, targetId], index) => {
                const source = nodes.find((node) => node.id === sourceId)!;
                const target = nodes.find((node) => node.id === targetId)!;
                if (!visibleIds.has(source.id) || !visibleIds.has(target.id)) return null;
                return (
                  <line
                    key={`${sourceId}-${targetId}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="rgba(102,227,255,0.28)"
                    strokeWidth="0.28"
                    strokeDasharray="1.6 2.4"
                    className="pulse-line"
                    style={{ animationDelay: `${index * 120}ms` }}
                  />
                );
              })}
            </svg>

            {visibleNodes.map((node, index) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0.86 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onMouseEnter={() => setActiveNode(node)}
                onFocus={() => setActiveNode(node)}
              >
                <Link
                  href={node.href}
                  className="group block"
                  aria-label={node.label}
                  onClick={(event) => {
                    if (node.href.startsWith('#')) {
                      event.preventDefault();
                      document.querySelector(node.href)?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <span
                    className="relative flex items-center justify-center rounded-full border border-cyan/40 bg-bg-deep/80 text-[0.62rem] font-mono uppercase tracking-[0.16em] text-cyan shadow-glow-cyan transition-all duration-300 group-hover:scale-110 group-hover:border-cyan"
                    style={{ width: node.size * 2.45, height: node.size * 2.45 }}
                  >
                    <span className="absolute inset-[-10px] rounded-full border border-cyan/10 group-hover:border-cyan/30" />
                    {node.size >= 16 ? node.label.split(' ')[0] : ''}
                  </span>
                </Link>
              </motion.div>
            ))}

            <div className="absolute bottom-4 left-4 right-4 border border-white/10 bg-black/[0.35] p-4 backdrop-blur-md sm:bottom-6 sm:left-6 sm:right-6">
              <p className="technical-label">{activeNode?.id ?? 'atlas'}</p>
              <h3 className="mt-2 text-xl font-bold text-text-primary">{activeNode?.label}</h3>
              <p className="mt-1 text-sm text-text-secondary">{activeNode?.detail}</p>
              {activeNode && (
                <Link href={activeNode.href} className="mt-4 inline-flex items-center gap-2 text-sm text-cyan hover:text-cyan-100">
                  Open node <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
