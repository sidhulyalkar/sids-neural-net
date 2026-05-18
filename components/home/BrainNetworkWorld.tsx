'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, Compass, Waves, Zap } from 'lucide-react';

type MemoryNode = {
  id: string;
  title: string;
  biome: string;
  x: number;
  y: number;
  size: number;
  href: string;
  color: string;
  signal: string;
  detail: string;
  tags: string[];
};

const memoryNodes: MemoryNode[] = [
  {
    id: 'datajoint',
    title: 'DataJoint Canopy',
    biome: 'Scientific infrastructure',
    x: 18,
    y: 30,
    size: 1.15,
    href: '/case-studies/datajoint-multimodal-pipelines',
    color: '#66e3ff',
    signal: 'reproducible multimodal experiments',
    detail: 'Cloud-ready pipelines for calcium imaging, electrophysiology, pose, photometry, and behavior.',
    tags: ['AWS', 'DataJoint', 'Pipelines'],
  },
  {
    id: 'neuros',
    title: 'Real-Time River',
    biome: 'BCI systems',
    x: 42,
    y: 21,
    size: 1.05,
    href: '/projects',
    color: '#66f0c2',
    signal: 'closed-loop decoding',
    detail: 'Low-latency neural streaming and adaptive interfaces where models have to respond in time.',
    tags: ['BCI', 'Latency', 'Decoding'],
  },
  {
    id: 'models',
    title: 'Foundation Storm',
    biome: 'Brain-scale models',
    x: 66,
    y: 32,
    size: 1.22,
    href: '/projects',
    color: '#a78bfa',
    signal: 'tokenizing brain dynamics',
    detail: 'Experiments around long-context neural time series, embeddings, and self-supervised structure.',
    tags: ['neurOS', 'neuroFMx', 'Transformers'],
  },
  {
    id: 'interp',
    title: 'Interpretability Cavern',
    biome: 'Mechanisms',
    x: 80,
    y: 55,
    size: 0.96,
    href: '/projects',
    color: '#f7c66b',
    signal: 'making hidden circuits legible',
    detail: 'Circuit discovery, path interventions, probes, and tools for finding where a model keeps meaning.',
    tags: ['Circuits', 'Probes', 'Mechanisms'],
  },
  {
    id: 'panoptic',
    title: 'Panoptic Signal',
    biome: 'Applied AI',
    x: 53,
    y: 62,
    size: 1.02,
    href: '/projects',
    color: '#5b8cff',
    signal: 'clinical intelligence systems',
    detail: 'Evaluation loops, retrieval systems, and applied AI surfaces for real-world biomedical decisions.',
    tags: ['RAG', 'Clinical AI', 'Evaluation'],
  },
  {
    id: 'field',
    title: 'Field Notes Ridge',
    biome: 'Creative memory',
    x: 27,
    y: 71,
    size: 0.92,
    href: '#photography',
    color: '#ff7aa2',
    signal: 'landscape, timing, texture',
    detail: 'Photography and outdoor attention as a second nervous system for noticing structure.',
    tags: ['Light', 'Travel', 'Shasta'],
  },
  {
    id: 'contact',
    title: 'Collaboration Beacon',
    biome: 'Open channel',
    x: 74,
    y: 81,
    size: 0.86,
    href: '/contact',
    color: '#66e3ff',
    signal: 'talk research, roles, systems',
    detail: 'For collaborations, applied AI conversations, neuroscience infrastructure, or strange useful prototypes.',
    tags: ['Contact', 'Research', 'Build'],
  },
];

const paths = [
  ['datajoint', 'neuros'],
  ['neuros', 'models'],
  ['models', 'interp'],
  ['interp', 'panoptic'],
  ['panoptic', 'field'],
  ['field', 'datajoint'],
  ['panoptic', 'contact'],
  ['models', 'contact'],
];

export function BrainNetworkWorld() {
  const [activeId, setActiveId] = useState(memoryNodes[0].id);
  const [visited, setVisited] = useState<string[]>([memoryNodes[0].id]);

  const activeNode = useMemo(
    () => memoryNodes.find((node) => node.id === activeId) ?? memoryNodes[0],
    [activeId]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const keys = ['ArrowRight', 'ArrowDown', 'd', 's', 'ArrowLeft', 'ArrowUp', 'a', 'w'];
      if (!keys.includes(event.key)) return;

      event.preventDefault();
      const currentIndex = memoryNodes.findIndex((node) => node.id === activeId);
      const direction = ['ArrowRight', 'ArrowDown', 'd', 's'].includes(event.key) ? 1 : -1;
      const next = memoryNodes[(currentIndex + direction + memoryNodes.length) % memoryNodes.length];
      selectNode(next.id);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeId]);

  const selectNode = (id: string) => {
    setActiveId(id);
    setVisited((current) => (current.includes(id) ? current : [...current, id]));
  };

  return (
    <section id="brain-world" className="relative min-h-screen overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 opacity-60">
        <div className="absolute left-1/2 top-1/2 h-[70rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan/10" />
        <div className="absolute left-[14%] top-[18%] h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />
        <div className="absolute bottom-[8%] right-[10%] h-80 w-80 rounded-full bg-green/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="mb-10 grid gap-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
          <div>
            <p className="technical-label">Exploration Layer</p>
            <h2 className="mt-4 text-4xl font-black leading-[0.96] tracking-tight text-text-primary md:text-6xl">
              Walk through the network like terrain.
            </h2>
          </div>
          <p className="max-w-2xl text-text-secondary">
            This is the less polite version of the portfolio: projects as weather systems, research as
            roots, field notes as ridgelines. Click a signal, or use arrow keys/WASD, and let the map
            decide what you notice next.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="neural-panel neural-panel-cut relative min-h-[680px] overflow-hidden">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <radialGradient id="worldGlow">
                  <stop offset="0%" stopColor="rgba(102,227,255,0.35)" />
                  <stop offset="100%" stopColor="rgba(102,227,255,0)" />
                </radialGradient>
              </defs>
              <path
                d="M4 78 C16 50 24 60 33 38 S54 10 70 25 S88 44 92 18"
                fill="none"
                stroke="rgba(102,227,255,0.10)"
                strokeWidth="0.6"
                strokeDasharray="1 2"
              />
              <path
                d="M7 24 C24 20 30 74 49 64 S72 40 93 70"
                fill="none"
                stroke="rgba(102,240,194,0.10)"
                strokeWidth="0.55"
                strokeDasharray="1 2.4"
              />
              {paths.map(([from, to], index) => {
                const source = memoryNodes.find((node) => node.id === from)!;
                const target = memoryNodes.find((node) => node.id === to)!;
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="rgba(102,227,255,0.22)"
                    strokeWidth="0.22"
                    strokeDasharray="1.4 2.8"
                    className="pulse-line"
                    style={{ animationDelay: `${index * 140}ms` }}
                  />
                );
              })}
              <circle cx={activeNode.x} cy={activeNode.y} r="14" fill="url(#worldGlow)" />
            </svg>

            <motion.div
              className="pointer-events-none absolute h-7 w-7 rounded-full border border-white/70 bg-cyan shadow-glow-cyan"
              animate={{
                left: `${activeNode.x}%`,
                top: `${activeNode.y}%`,
              }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
              style={{ translate: '-50% -50%' }}
            />

            {memoryNodes.map((node, index) => {
              const isActive = node.id === activeId;
              const hasVisited = visited.includes(node.id);
              return (
                <motion.button
                  key={node.id}
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06 }}
                  onClick={() => selectNode(node.id)}
                  onMouseEnter={() => selectNode(node.id)}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 text-left"
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                >
                  <span
                    className="relative flex items-center justify-center rounded-full border bg-bg-deep/80 backdrop-blur-md transition-all duration-300 group-hover:scale-110"
                    style={{
                      width: `${58 * node.size}px`,
                      height: `${58 * node.size}px`,
                      borderColor: isActive ? node.color : 'rgba(255,255,255,0.14)',
                      boxShadow: isActive ? `0 0 38px ${node.color}55` : `0 0 20px ${node.color}22`,
                    }}
                  >
                    <span className="absolute inset-[-14px] rounded-full border border-white/5" />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: node.color }} />
                  </span>
                  <span className={`pointer-events-none absolute left-1/2 top-full mt-3 w-44 -translate-x-1/2 border border-white/10 bg-black/[0.52] px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-secondary backdrop-blur-md transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {node.title}
                    {hasVisited && <span className="ml-2 text-cyan">visited</span>}
                  </span>
                </motion.button>
              );
            })}
          </div>

          <aside className="neural-panel neural-panel-cut flex min-h-[440px] flex-col justify-between p-5">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <span className="technical-label">Active Memory</span>
                <Compass className="h-5 w-5 text-cyan" />
              </div>
              <p className="text-sm text-text-muted">{activeNode.biome}</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-text-primary">{activeNode.title}</h3>
              <p className="mt-4 text-sm leading-6 text-text-secondary">{activeNode.detail}</p>
              <div className="mt-5 flex items-center gap-2 border-y border-white/10 py-3 text-sm text-cyan">
                <Zap className="h-4 w-4" />
                <span>{activeNode.signal}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {activeNode.tags.map((tag) => (
                  <span key={tag} className="border border-white/10 px-2 py-1 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-8">
              <div className="mb-4 flex items-center gap-2 text-xs text-text-muted">
                <Waves className="h-4 w-4 text-green" />
                <span>{visited.length}/{memoryNodes.length} memories touched</span>
              </div>
              <Link
                href={activeNode.href}
                className="signal-button w-full"
                onClick={(event) => {
                  if (activeNode.href.startsWith('#')) {
                    event.preventDefault();
                    document.querySelector(activeNode.href)?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                Enter this memory
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
