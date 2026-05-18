'use client';

import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Brain, Menu, X, Zap } from 'lucide-react';
import { NeuralGraph as NeuralGraphType, NeuralNode } from '@/lib/data/schemas';

type PlaneNode = {
  node: NeuralNode;
  x: number;
  y: number;
  radius: number;
  cluster: string;
  color: string;
};

type PlaneEdge = {
  source: string;
  target: string;
  strength: number;
  color: string;
};

const WORLD = { width: 2500, height: 1550 };

const CLUSTERS: Record<string, { x: number; y: number; color: string; label: string }> = {
  data: { x: 510, y: 420, color: '#66e3ff', label: 'data cortex' },
  ucsd: { x: 880, y: 770, color: '#66f0c2', label: 'ucsd memory' },
  models: { x: 1320, y: 390, color: '#a78bfa', label: 'model lobe' },
  bci: { x: 1580, y: 835, color: '#ff7aa2', label: 'real-time nerve' },
  applied: { x: 1900, y: 570, color: '#5b8cff', label: 'applied signal' },
  personal: { x: 1220, y: 1160, color: '#f7c66b', label: 'field memory' },
};

function classifyNode(node: NeuralNode): keyof typeof CLUSTERS {
  const haystack = [node.title, node.slug, node.cluster ?? '', ...node.domains, ...node.tags]
    .join(' ')
    .toLowerCase();

  if (haystack.includes('datajoint') || haystack.includes('allen') || haystack.includes('sabatini')) return 'data';
  if (haystack.includes('ucsd') || haystack.includes('neatlabs') || haystack.includes('lfp')) return 'ucsd';
  if (haystack.includes('mechanistic') || haystack.includes('foundation') || haystack.includes('transformer')) return 'models';
  if (haystack.includes('bci') || haystack.includes('neuros') || haystack.includes('real-time')) return 'bci';
  if (haystack.includes('panoptic') || haystack.includes('clinical') || haystack.includes('ai')) return 'applied';
  if (haystack.includes('shasta') || haystack.includes('photo') || haystack.includes('personal')) return 'personal';
  return node.importance >= 85 ? 'models' : 'personal';
}

function shortTitle(node: NeuralNode): string {
  const overrides: Record<string, string> = {
    'datajoint-multimodal-infrastructure': 'DataJoint Core',
    'harvard-sabatini-datajoint-pipeline': 'Sabatini Lab',
    'allen-mindscope-work': 'Allen Mindscope',
    'neatlabs-core-research': 'NEATLABs',
    'neuros-v1': 'neurOS-v1',
    neuroforge: 'NeuroForge',
    'neural-mm-tf-mechint': 'Mech Interp',
  };

  if (overrides[node.slug]) return overrides[node.slug];
  const cleaned = node.title
    .replace(/\s*[\(:].+$/g, '')
    .replace(/\b(multimodal|neuroscience|pipeline|pipelines|framework|project|application)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 24 ? `${cleaned.slice(0, 21)}...` : cleaned;
}

function nodeHref(node: NeuralNode): string {
  if (node.type === 'project') return `/projects/${node.slug}`;
  if (node.type === 'publication') return '/publications';
  return '/neural-net';
}

function dendriteBranchPath(
  source: PlaneNode,
  target: PlaneNode,
  control: { x: number; y: number },
  t: number,
  length: number,
  side: 1 | -1
): string {
  const oneMinusT = 1 - t;
  const x = oneMinusT * oneMinusT * source.x + 2 * oneMinusT * t * control.x + t * t * target.x;
  const y = oneMinusT * oneMinusT * source.y + 2 * oneMinusT * t * control.y + t * t * target.y;
  const dx = 2 * oneMinusT * (control.x - source.x) + 2 * t * (target.x - control.x);
  const dy = 2 * oneMinusT * (control.y - source.y) + 2 * t * (target.y - control.y);
  const magnitude = Math.hypot(dx, dy) || 1;
  const tangentX = dx / magnitude;
  const tangentY = dy / magnitude;
  const normalX = (-dy / magnitude) * side;
  const normalY = (dx / magnitude) * side;
  const controlX = x + normalX * length * 0.5 + tangentX * length * 0.16;
  const controlY = y + normalY * length * 0.5 + tangentY * length * 0.16;
  const endX = x + normalX * length + tangentX * length * 0.35;
  const endY = y + normalY * length + tangentY * length * 0.35;

  return `M ${x} ${y} Q ${controlX} ${controlY} ${endX} ${endY}`;
}

interface NeuralPlaneWorldProps {
  graph: NeuralGraphType;
}

export function NeuralPlaneWorld({ graph }: NeuralPlaneWorldProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: -260, y: -160 });
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const nodes = useMemo<PlaneNode[]>(() => {
    const selected = graph.nodes
      .filter((node) => node.type === 'project' || node.type === 'publication')
      .sort((a, b) => (b.computedImportance ?? b.importance) - (a.computedImportance ?? a.importance))
      .slice(0, 46);

    const clusterCounts = new Map<string, number>();

    return selected.map((node) => {
      const clusterKey = classifyNode(node);
      const cluster = CLUSTERS[clusterKey];
      const index = clusterCounts.get(clusterKey) ?? 0;
      clusterCounts.set(clusterKey, index + 1);

      const ring = Math.floor(index / 8) + 1;
      const angle = (index % 8) * ((Math.PI * 2) / 8) + ring * 0.33;
      const distance = 92 + ring * 78 + (index % 4) * 16;
      const importance = node.computedImportance ?? node.importance;

      return {
        node,
        x: cluster.x + Math.cos(angle) * distance,
        y: cluster.y + Math.sin(angle) * distance,
        radius: Math.max(16, Math.min(36, 13 + importance / 4.6)),
        cluster: clusterKey,
        color: cluster.color,
      };
    });
  }, [graph.nodes]);

  const nodeBySlug = useMemo(() => new Map(nodes.map((item) => [item.node.slug, item])), [nodes]);

  const edges = useMemo<PlaneEdge[]>(() => {
    const visible = new Set(nodes.map((item) => item.node.slug));
    const graphEdges = graph.edges
      .filter((edge) => visible.has(edge.source) && visible.has(edge.target))
      .slice(0, 220)
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        strength: edge.weight,
        color: edge.weight >= 7 ? 'rgba(102,227,255,0.42)' : 'rgba(102,227,255,0.16)',
      }));

    const byCluster = new Map<string, PlaneNode[]>();
    nodes.forEach((item) => byCluster.set(item.cluster, [...(byCluster.get(item.cluster) ?? []), item]));

    const clusterEdges = Array.from(byCluster.values()).flatMap((clusterNodes) =>
      clusterNodes.slice(0, 9).flatMap((item, index, array) => {
        const next = array[index + 1];
        const hub = array[0];
        return [
          ...(next ? [{ source: item.node.slug, target: next.node.slug, strength: 9, color: `${item.color}88` }] : []),
          ...(index > 1 ? [{ source: hub.node.slug, target: item.node.slug, strength: 7, color: `${item.color}55` }] : []),
        ];
      })
    );

    return [...graphEdges, ...clusterEdges];
  }, [graph.edges, nodes]);

  const active = activeSlug ? nodeBySlug.get(activeSlug) ?? null : null;

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setOffset({
      x: dragStart.current.offsetX + event.clientX - dragStart.current.x,
      y: dragStart.current.offsetY + event.clientY - dragStart.current.y,
    });
  };

  const endDrag = () => setIsDragging(false);

  const focusNode = (item: PlaneNode) => {
    setActiveSlug(item.node.slug);
    setOffset({
      x: window.innerWidth / 2 - item.x,
      y: window.innerHeight / 2 - item.y,
    });
  };

  return (
    <section className="relative h-screen overflow-hidden bg-bg-deep text-text-primary">
      <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_50%,transparent_0,rgba(5,9,20,0.16)_48%,rgba(5,9,20,0.82)_100%)]" />

      <div
        className={`absolute inset-0 z-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <motion.div
          className="absolute left-0 top-0"
          animate={{
            x: offset.x,
            y: offset.y,
            scale: active ? 1.08 : 1,
          }}
          transition={{ type: 'spring', stiffness: 58, damping: 24 }}
          style={{ width: WORLD.width, height: WORLD.height }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_30%,rgba(102,227,255,0.16),transparent_22rem),radial-gradient(circle_at_72%_52%,rgba(167,139,250,0.13),transparent_26rem),radial-gradient(circle_at_50%_76%,rgba(102,240,194,0.10),transparent_24rem)]" />
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} aria-hidden="true">
            <defs>
              <filter id="dendriteGlow">
                <feGaussianBlur stdDeviation="3.6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {Object.entries(CLUSTERS).map(([key, cluster]) => (
              <g key={key}>
                <circle cx={cluster.x} cy={cluster.y} r="225" fill="none" stroke={cluster.color} strokeOpacity="0.07" />
                <circle cx={cluster.x} cy={cluster.y} r="96" fill={cluster.color} opacity="0.025" />
                <text x={cluster.x - 72} y={cluster.y - 242} fill={cluster.color} opacity="0.42" fontSize="13" letterSpacing="5">
                  {cluster.label.toUpperCase()}
                </text>
              </g>
            ))}

            {edges.map((edge, index) => {
              const source = nodeBySlug.get(edge.source);
              const target = nodeBySlug.get(edge.target);
              if (!source || !target) return null;
              const control = {
                x: (source.x + target.x) / 2 + Math.sin(index) * 42,
                y: (source.y + target.y) / 2 + Math.cos(index * 1.7) * 42,
              };
              const activeEdge = active && (active.node.slug === edge.source || active.node.slug === edge.target);
              return (
                <g key={`${edge.source}-${edge.target}-${index}`} filter={activeEdge ? 'url(#dendriteGlow)' : undefined}>
                  <path
                    d={`M ${source.x} ${source.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`}
                    fill="none"
                    stroke={activeEdge ? source.color : edge.color}
                    strokeWidth={activeEdge ? Math.max(2, edge.strength / 2.6) : Math.max(0.8, edge.strength / 4.6)}
                    strokeLinecap="round"
                    strokeDasharray={activeEdge ? '0' : '10 18'}
                    className={activeEdge ? undefined : 'pulse-line'}
                    opacity={activeEdge ? 0.78 : 0.55}
                  />
                  <path
                    d={`M ${source.x} ${source.y} Q ${control.x - 18} ${control.y + 22} ${target.x} ${target.y}`}
                    fill="none"
                    stroke={activeEdge ? source.color : edge.color}
                    strokeWidth="0.55"
                    strokeLinecap="round"
                    opacity={activeEdge ? 0.36 : 0.18}
                  />
                  {[0.32, 0.62].map((branchT, branchIndex) => (
                    <path
                      key={branchT}
                      d={dendriteBranchPath(
                        source,
                        target,
                        control,
                        branchT,
                        activeEdge ? 54 - branchIndex * 12 : 30 - branchIndex * 6,
                        (index + branchIndex) % 2 === 0 ? 1 : -1
                      )}
                      fill="none"
                      stroke={activeEdge ? source.color : edge.color}
                      strokeWidth={activeEdge ? 1.2 : 0.5}
                      strokeLinecap="round"
                      opacity={activeEdge ? 0.48 : 0.16}
                    />
                  ))}
                </g>
              );
            })}
          </svg>

          {nodes.map((item) => {
            const isActive = activeSlug === item.node.slug;
            return (
              <button
                key={item.node.slug}
                type="button"
                aria-label={`Open ${shortTitle(item.node)}`}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: item.x, top: item.y }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  focusNode(item);
                }}
              >
                <span
                  className="relative flex items-center justify-center rounded-full border bg-bg-deep/80 backdrop-blur-md transition-transform duration-300 group-hover:scale-110"
                  style={{
                    width: item.radius * 2,
                    height: item.radius * 2,
                    borderColor: isActive ? '#ffffff' : item.color,
                    boxShadow: `0 0 ${isActive ? 48 : 24}px ${item.color}66`,
                  }}
                >
                  <span className="absolute inset-[-14px] rounded-full border border-white/10" />
                  <span className="absolute inset-[-26px] rounded-full border border-white/5" />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                </span>
                <span className={`pointer-events-none absolute left-1/2 top-full mt-4 w-44 -translate-x-1/2 border border-white/10 bg-black/[0.55] px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-secondary backdrop-blur-md transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {shortTitle(item.node)}
                </span>
              </button>
            );
          })}
        </motion.div>
      </div>

      <div className="pointer-events-none absolute left-5 top-5 z-30 max-w-sm opacity-70 transition-opacity">
        <p className="technical-label">Entering Neural Plane</p>
        <h1 className="mt-2 text-2xl font-black leading-none tracking-tight text-text-primary md:text-3xl">
          Sid Neural Net
        </h1>
      </div>

      <div className="absolute left-4 top-4 z-40">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="group mt-32 flex h-12 w-12 items-center justify-center border border-white/5 bg-transparent text-text-muted opacity-20 backdrop-blur-sm transition-all hover:border-cyan/40 hover:bg-bg-panel/70 hover:text-cyan hover:opacity-100"
          aria-label="Open hidden navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="neural-panel neural-panel-cut mt-3 w-72 p-3"
            >
              {[
                ['Full atlas', '/neural-net'],
                ['Projects', '/projects'],
                ['Timeline', '/timeline'],
                ['About', '/about'],
                ['Contact', '/contact'],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between border-b border-white/10 px-2 py-3 text-sm text-text-secondary last:border-b-0 hover:text-cyan"
                >
                  {label}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {active && (
          <motion.aside
            initial={{ opacity: 0, x: 48, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, scale: 0.96 }}
            className="neural-panel neural-panel-cut absolute bottom-5 right-5 top-20 z-40 flex w-[min(430px,calc(100vw-2.5rem))] flex-col p-5"
          >
            <button
              type="button"
              onClick={() => setActiveSlug(null)}
              className="absolute right-4 top-4 text-text-muted transition-colors hover:text-cyan"
              aria-label="Close node chamber"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="technical-label">Node Chamber</p>
            <h2 className="mt-4 pr-8 text-3xl font-black tracking-tight text-text-primary">
              {active.node.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              {active.node.summary || 'A chamber for this memory node. This can later hold artifacts, media, code notes, diagrams, and more narrative detail.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {active.node.tags.slice(0, 6).map((tag) => (
                <span key={tag} className="border border-white/10 px-2 py-1 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-text-muted">
                  {tag}
                </span>
              ))}
            </div>
            <div className="my-6 border-y border-white/10 py-4">
              <div className="flex items-center gap-2 text-sm text-cyan">
                <Zap className="h-4 w-4" />
                <span>Axon route primed</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-muted">
                Opening this node should feel like following a signal deeper into the brain. The chamber is the preview; the page is the next layer.
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <Link href={nodeHref(active.node)} className="signal-button w-full">
                Follow axon into node <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/neural-net" className="inline-flex items-center justify-center gap-2 text-sm text-text-muted hover:text-cyan">
                <Brain className="h-4 w-4" />
                Open full Cosmograph atlas
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </section>
  );
}
