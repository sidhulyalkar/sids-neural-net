'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ResearchIdea } from '@/data/research-ideas';

interface IdeaNode {
  idea: ResearchIdea;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  burstTimer: number;
  burstIntensity: number;
  isHovered: boolean;
}

const colorMap: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 0.9)',
  violet: 'rgba(167, 139, 250, 0.9)',
  green: 'rgba(102, 240, 194, 0.9)',
  amber: 'rgba(247, 198, 107, 0.9)',
  rose: 'rgba(255, 122, 162, 0.9)',
};

const colorMapSoft: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 0.06)',
  violet: 'rgba(167, 139, 250, 0.06)',
  green: 'rgba(102, 240, 194, 0.06)',
  amber: 'rgba(247, 198, 107, 0.06)',
  rose: 'rgba(255, 122, 162, 0.06)',
};

const colorMapGlow: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 0.4)',
  violet: 'rgba(167, 139, 250, 0.4)',
  green: 'rgba(102, 240, 194, 0.4)',
  amber: 'rgba(247, 198, 107, 0.4)',
  rose: 'rgba(255, 122, 162, 0.4)',
};

const colorMapBurst: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 1)',
  violet: 'rgba(167, 139, 250, 1)',
  green: 'rgba(102, 240, 194, 1)',
  amber: 'rgba(247, 198, 107, 1)',
  rose: 'rgba(255, 122, 162, 1)',
};

// Unique symbols for each research idea
const ideaSymbols: Record<string, { path: string; viewBox: string }> = {
  'neural-search': {
    path: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    viewBox: '0 0 24 24',
  },
  'foundation-neural': {
    path: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    viewBox: '0 0 24 24',
  },
  'mechinterp-neuro': {
    path: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    viewBox: '0 0 24 24',
  },
  'bci-middleware': {
    path: 'M13 10V3L4 14h7v7l9-11h-7z',
    viewBox: '0 0 24 24',
  },
  'session-stitching': {
    path: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    viewBox: '0 0 24 24',
  },
  'experiment-generation': {
    path: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    viewBox: '0 0 24 24',
  },
  'neural-qc': {
    path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    viewBox: '0 0 24 24',
  },
  'brain-behavior-alignment': {
    path: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    viewBox: '0 0 24 24',
  },
  'provenance-search': {
    path: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    viewBox: '0 0 24 24',
  },
  'ecog-foundation': {
    path: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    viewBox: '0 0 24 24',
  },
};

const defaultSymbol = {
  path: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  viewBox: '0 0 24 24',
};

// Node dimensions
const COLLAPSED_SIZE = 72;
const EXPANDED_WIDTH = 160;
const EXPANDED_HEIGHT = 80;

interface IdeaLandscapeProps {
  ideas: ResearchIdea[];
}

export function IdeaLandscape({ ideas }: IdeaLandscapeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<IdeaNode[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<ResearchIdea | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);
  const nodesRef = useRef<IdeaNode[]>([]);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width || 800;
    const height = Math.max(700, rect.height || 800);
    setDimensions({ width, height });

    const initialNodes: IdeaNode[] = ideas.map((idea, i) => {
      const cols = Math.ceil(Math.sqrt(ideas.length * (width / height)));
      const rows = Math.ceil(ideas.length / cols);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellWidth = width / cols;
      const cellHeight = height / rows;

      const speed = 0.5 + Math.random() * 0.8;
      const angle = Math.random() * Math.PI * 2;

      return {
        idea,
        x: cellWidth * (col + 0.5) + (Math.random() - 0.5) * cellWidth * 0.4,
        y: cellHeight * (row + 0.5) + (Math.random() - 0.5) * cellHeight * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        width: COLLAPSED_SIZE,
        height: COLLAPSED_SIZE,
        color: colorMap[idea.color],
        burstTimer: 0,
        burstIntensity: 0,
        isHovered: false,
      };
    });

    setNodes(initialNodes);
    nodesRef.current = initialNodes;
  }, [ideas]);

  useEffect(() => {
    if (prefersReducedMotion || nodes.length === 0) return;

    const animate = (currentTime: number) => {
      const deltaTime = lastTimeRef.current ? Math.min((currentTime - lastTimeRef.current) / 16.67, 2) : 1;
      lastTimeRef.current = currentTime;

      const currentNodes = [...nodesRef.current];
      const { width, height } = dimensions;
      const padding = 50;

      for (let i = 0; i < currentNodes.length; i++) {
        const node = currentNodes[i];

        const isHovered = hoveredId === node.idea.id;
        node.isHovered = isHovered;

        // Smooth size interpolation
        const targetWidth = isHovered ? EXPANDED_WIDTH : COLLAPSED_SIZE;
        const targetHeight = isHovered ? EXPANDED_HEIGHT : COLLAPSED_SIZE;
        node.width += (targetWidth - node.width) * 0.12;
        node.height += (targetHeight - node.height) * 0.12;

        const collisionRadius = Math.max(node.width, node.height) / 2;

        node.x += node.vx * deltaTime;
        node.y += node.vy * deltaTime;

        if (node.burstTimer > 0) {
          node.burstTimer -= 0.02 * deltaTime;
          if (node.burstTimer < 0) {
            node.burstTimer = 0;
            node.burstIntensity = 0;
          }
        }

        // Boundary collision
        const bounceEnergy = 0.8;
        if (node.x - collisionRadius < padding) {
          node.x = padding + collisionRadius;
          node.vx = Math.abs(node.vx) * bounceEnergy;
          node.burstTimer = 0.4;
          node.burstIntensity = Math.abs(node.vx) / 3;
        }
        if (node.x + collisionRadius > width - padding) {
          node.x = width - padding - collisionRadius;
          node.vx = -Math.abs(node.vx) * bounceEnergy;
          node.burstTimer = 0.4;
          node.burstIntensity = Math.abs(node.vx) / 3;
        }
        if (node.y - collisionRadius < padding) {
          node.y = padding + collisionRadius;
          node.vy = Math.abs(node.vy) * bounceEnergy;
          node.burstTimer = 0.4;
          node.burstIntensity = Math.abs(node.vy) / 3;
        }
        if (node.y + collisionRadius > height - padding) {
          node.y = height - padding - collisionRadius;
          node.vy = -Math.abs(node.vy) * bounceEnergy;
          node.burstTimer = 0.4;
          node.burstIntensity = Math.abs(node.vy) / 3;
        }

        // Node collision
        for (let j = i + 1; j < currentNodes.length; j++) {
          const other = currentNodes[j];
          const otherRadius = Math.max(other.width, other.height) / 2;

          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = collisionRadius + otherRadius + 12;

          if (dist < minDist && dist > 0.1) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            const separationForce = overlap / 2 + 2;
            node.x -= nx * separationForce;
            node.y -= ny * separationForce;
            other.x += nx * separationForce;
            other.y += ny * separationForce;

            const dvx = node.vx - other.vx;
            const dvy = node.vy - other.vy;
            const dvn = dvx * nx + dvy * ny;

            if (dvn > 0) {
              const burstBoost = 1.6;
              node.vx -= dvn * nx * burstBoost;
              node.vy -= dvn * ny * burstBoost;
              other.vx += dvn * nx * burstBoost;
              other.vy += dvn * ny * burstBoost;

              const intensity = Math.min(Math.sqrt(dvx * dvx + dvy * dvy) / 3, 1);
              node.burstTimer = 0.8;
              node.burstIntensity = intensity;
              other.burstTimer = 0.8;
              other.burstIntensity = intensity;
            }
          }
        }

        node.vx += (Math.random() - 0.5) * 0.015 * deltaTime;
        node.vy += (Math.random() - 0.5) * 0.015 * deltaTime;

        const friction = node.burstTimer > 0 ? 0.996 : 0.988;
        node.vx *= Math.pow(friction, deltaTime);
        node.vy *= Math.pow(friction, deltaTime);

        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        const maxSpeed = node.burstTimer > 0 ? 6 : 2.5;
        const minSpeed = 0.25;

        if (speed > maxSpeed) {
          node.vx = (node.vx / speed) * maxSpeed;
          node.vy = (node.vy / speed) * maxSpeed;
        }

        if (speed < minSpeed && node.burstTimer <= 0) {
          const angle = Math.random() * Math.PI * 2;
          node.vx += Math.cos(angle) * 0.15;
          node.vy += Math.sin(angle) * 0.15;
        }
      }

      nodesRef.current = currentNodes;
      setNodes([...currentNodes]);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [prefersReducedMotion, dimensions, nodes.length, hoveredId]);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width, height: Math.max(700, rect.height) });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNodeClick = useCallback((idea: ResearchIdea) => {
    setSelectedIdea(prev => prev?.id === idea.id ? null : idea);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, idea: ResearchIdea) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNodeClick(idea);
    }
  }, [handleNodeClick]);

  // Format title with consistent line breaks
  const formatTitle = (title: string): string[] => {
    const words = title.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    const maxChars = 16;

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxChars) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 3);
  };

  return (
    <div className="relative -mx-4 sm:-mx-6 lg:-mx-8">
      <div
        ref={containerRef}
        className="relative h-[85vh] w-full overflow-hidden"
        style={{ minHeight: '700px', maxHeight: '1000px', background: 'transparent' }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.15) 100%)' }}
        />

        {/* Connection lines */}
        <svg className="absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
          {nodes.map((node, i) =>
            nodes.slice(i + 1).map((other) => {
              const dx = other.x - node.x;
              const dy = other.y - node.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 320) return null;

              const burstGlow = (node.burstTimer + other.burstTimer) / 2;
              const opacity = Math.max(0, 1 - dist / 320) * 0.08 + burstGlow * 0.2;

              return (
                <line
                  key={`${node.idea.id}-${other.idea.id}`}
                  x1={node.x}
                  y1={node.y}
                  x2={other.x}
                  y2={other.y}
                  stroke={burstGlow > 0.15 ? colorMapBurst[node.idea.color] : 'rgba(102, 227, 255, 0.5)'}
                  strokeWidth={burstGlow > 0.15 ? 1.5 : 0.5}
                  strokeOpacity={opacity}
                  strokeDasharray={burstGlow > 0.15 ? 'none' : '2,6'}
                />
              );
            })
          )}
        </svg>

        {/* Nodes */}
        <div className="absolute inset-0" style={{ zIndex: 2 }}>
          {nodes.map((node) => {
            const isHovered = hoveredId === node.idea.id;
            const isSelected = selectedIdea?.id === node.idea.id;
            const isBursting = node.burstTimer > 0;
            const symbol = ideaSymbols[node.idea.id] || defaultSymbol;
            const titleLines = formatTitle(node.idea.title);

            return (
              <button
                key={node.idea.id}
                className="absolute flex items-center justify-center transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                style={{
                  left: node.x - node.width / 2,
                  top: node.y - node.height / 2,
                  width: node.width,
                  height: node.height,
                  background: colorMapSoft[node.idea.color],
                  border: `1.5px solid ${isBursting ? colorMapBurst[node.idea.color] : isHovered || isSelected ? colorMap[node.idea.color] : `${colorMap[node.idea.color]}50`}`,
                  borderRadius: isHovered ? '14px' : '50%',
                  boxShadow: isBursting
                    ? `0 0 ${16 + node.burstIntensity * 12}px ${colorMapGlow[node.idea.color]}`
                    : isHovered
                    ? `0 0 16px ${colorMapGlow[node.idea.color]}`
                    : 'none',
                  transform: `scale(${isBursting ? 1 + node.burstIntensity * 0.08 : 1})`,
                }}
                onClick={() => handleNodeClick(node.idea)}
                onKeyDown={(e) => handleKeyDown(e, node.idea)}
                onMouseEnter={() => setHoveredId(node.idea.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(node.idea.id)}
                onBlur={() => setHoveredId(null)}
                aria-label={`Research idea: ${node.idea.title}`}
                aria-pressed={isSelected}
              >
                {/* Symbol (collapsed state) */}
                <div
                  className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
                  style={{ opacity: isHovered ? 0 : 1 }}
                >
                  <svg
                    viewBox={symbol.viewBox}
                    className="w-7 h-7"
                    fill="none"
                    stroke={isBursting ? colorMapBurst[node.idea.color] : colorMap[node.idea.color]}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={symbol.path} />
                  </svg>
                </div>

                {/* Title (expanded state) */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center px-2.5 transition-opacity duration-200"
                  style={{ opacity: isHovered ? 1 : 0 }}
                >
                  {titleLines.map((line, idx) => (
                    <span
                      key={idx}
                      className="text-center font-mono text-[0.55rem] uppercase leading-tight tracking-wide"
                      style={{ color: colorMap[node.idea.color] }}
                    >
                      {line}
                    </span>
                  ))}
                </div>

                {/* Status dot */}
                <div
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{
                    background: node.idea.status === 'active'
                      ? colorMapBurst[node.idea.color]
                      : node.idea.status === 'draft'
                      ? `${colorMap[node.idea.color]}70`
                      : `${colorMap[node.idea.color]}40`,
                    boxShadow: node.idea.status === 'active' ? `0 0 6px ${colorMapGlow[node.idea.color]}` : 'none',
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel - elegant grid layout */}
      {selectedIdea && (
        <div className="mx-4 sm:mx-6 lg:mx-8 mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-start justify-between gap-6 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <svg
                  viewBox={(ideaSymbols[selectedIdea.id] || defaultSymbol).viewBox}
                  className="w-6 h-6"
                  fill="none"
                  stroke={colorMap[selectedIdea.color]}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={(ideaSymbols[selectedIdea.id] || defaultSymbol).path} />
                </svg>
                <span
                  className="rounded-sm border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider"
                  style={{ borderColor: colorMap[selectedIdea.color], color: colorMap[selectedIdea.color] }}
                >
                  {selectedIdea.status}
                </span>
              </div>
              <h3 className="text-2xl font-semibold text-text-primary leading-tight">
                {selectedIdea.title}
              </h3>
            </div>
            <button
              onClick={() => setSelectedIdea(null)}
              className="shrink-0 rounded-lg p-2.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
              aria-label="Close details"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Thesis - prominent */}
          <div
            className="mb-8 p-4 rounded-lg border-l-2"
            style={{ borderColor: colorMap[selectedIdea.color], background: colorMapSoft[selectedIdea.color] }}
          >
            <p className="text-base text-text-primary leading-relaxed">{selectedIdea.thesis}</p>
          </div>

          {/* Grid layout for details */}
          <div className="grid gap-8 md:grid-cols-2">
            {/* Why it matters */}
            <div className="space-y-3">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-text-muted">
                Why It Matters
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">{selectedIdea.whyItMatters}</p>
            </div>

            {/* Open Question */}
            {selectedIdea.openQuestion && (
              <div className="space-y-3">
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-amber">
                  Open Question
                </p>
                <p className="text-sm text-text-secondary leading-relaxed italic">
                  "{selectedIdea.openQuestion}"
                </p>
              </div>
            )}
          </div>

          {/* Methods & Related Work */}
          <div className="grid gap-8 md:grid-cols-2 mt-8 pt-8 border-t border-white/8">
            <div className="space-y-3">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-text-muted">
                Methods & Tools
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedIdea.methods.map((method) => (
                  <span
                    key={method}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-text-secondary"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>

            {selectedIdea.relatedWork.length > 0 && (
              <div className="space-y-3">
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-text-muted">
                  Related Experience
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedIdea.relatedWork.map((work) => (
                    <span
                      key={work}
                      className="rounded-md border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider"
                      style={{ borderColor: `${colorMap[selectedIdea.color]}40`, color: colorMap[selectedIdea.color] }}
                    >
                      {work}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Domains footer */}
          <div className="flex flex-wrap items-center gap-4 mt-8 pt-6 border-t border-white/8">
            <span className="font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">Domains:</span>
            {selectedIdea.domains.map((domain) => (
              <span
                key={domain}
                className="font-mono text-[0.6rem] uppercase tracking-wider text-text-muted/70"
              >
                {domain}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Mobile fallback
export function IdeaList({ ideas }: IdeaLandscapeProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {ideas.map((idea) => {
        const isExpanded = expandedId === idea.id;
        const symbol = ideaSymbols[idea.id] || defaultSymbol;

        return (
          <button
            key={idea.id}
            className={`w-full text-left transition-all duration-300 rounded-xl border border-white/10 bg-white/[0.02] ${
              isExpanded ? 'border-white/20' : 'hover:border-white/15'
            }`}
            style={{ borderLeftColor: colorMap[idea.color], borderLeftWidth: '3px' }}
            onClick={() => setExpandedId(isExpanded ? null : idea.id)}
            aria-expanded={isExpanded}
          >
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <svg
                  viewBox={symbol.viewBox}
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke={colorMap[idea.color]}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={symbol.path} />
                </svg>
                <span
                  className="rounded-sm border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider"
                  style={{ borderColor: colorMap[idea.color], color: colorMap[idea.color] }}
                >
                  {idea.status}
                </span>
              </div>
              <h3 className="text-base font-semibold text-text-primary">{idea.title}</h3>
              <p className="mt-2 text-sm text-cyan">{idea.thesis}</p>

              {isExpanded && (
                <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
                  <p className="text-sm text-text-secondary leading-relaxed">{idea.whyItMatters}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {idea.methods.slice(0, 4).map((method) => (
                      <span
                        key={method}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[0.55rem] uppercase text-text-muted"
                      >
                        {method}
                      </span>
                    ))}
                  </div>

                  {idea.openQuestion && (
                    <p className="text-sm italic text-amber/80">"{idea.openQuestion}"</p>
                  )}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
