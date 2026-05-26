'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ResearchIdea } from '@/data/research-ideas';

interface IdeaNode {
  idea: ResearchIdea;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  originalColor: string;
}

const colorMap: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 0.85)',
  violet: 'rgba(167, 139, 250, 0.85)',
  green: 'rgba(102, 240, 194, 0.85)',
  amber: 'rgba(247, 198, 107, 0.85)',
  rose: 'rgba(255, 122, 162, 0.85)',
};

const colorMapSoft: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 0.15)',
  violet: 'rgba(167, 139, 250, 0.15)',
  green: 'rgba(102, 240, 194, 0.15)',
  amber: 'rgba(247, 198, 107, 0.15)',
  rose: 'rgba(255, 122, 162, 0.15)',
};

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

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Initialize nodes
  useEffect(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width || 800;
    const height = Math.max(500, rect.height || 600);
    setDimensions({ width, height });

    const initialNodes: IdeaNode[] = ideas.map((idea, i) => {
      const angle = (i / ideas.length) * Math.PI * 2;
      const radiusFromCenter = Math.min(width, height) * 0.3;
      const nodeRadius = 60 + Math.random() * 20;

      return {
        idea,
        x: width / 2 + Math.cos(angle) * radiusFromCenter + (Math.random() - 0.5) * 100,
        y: height / 2 + Math.sin(angle) * radiusFromCenter + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: nodeRadius,
        color: colorMap[idea.color],
        originalColor: colorMap[idea.color],
      };
    });

    setNodes(initialNodes);
    nodesRef.current = initialNodes;
  }, [ideas]);

  // Animation loop
  useEffect(() => {
    if (prefersReducedMotion || nodes.length === 0) return;

    const animate = () => {
      const currentNodes = nodesRef.current;
      const { width, height } = dimensions;
      const padding = 80;

      const updatedNodes = currentNodes.map((node, i) => {
        let { x, y, vx, vy, color, originalColor } = node;

        // Apply velocity
        x += vx;
        y += vy;

        // Boundary collision
        if (x - node.radius < padding) {
          x = padding + node.radius;
          vx = Math.abs(vx) * 0.8;
        }
        if (x + node.radius > width - padding) {
          x = width - padding - node.radius;
          vx = -Math.abs(vx) * 0.8;
        }
        if (y - node.radius < padding) {
          y = padding + node.radius;
          vy = Math.abs(vy) * 0.8;
        }
        if (y + node.radius > height - padding) {
          y = height - padding - node.radius;
          vy = -Math.abs(vy) * 0.8;
        }

        // Check collision with other nodes
        for (let j = 0; j < currentNodes.length; j++) {
          if (i === j) continue;
          const other = currentNodes[j];
          const dx = other.x - x;
          const dy = other.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = node.radius + other.radius;

          if (dist < minDist && dist > 0) {
            // Collision detected - swap colors briefly
            const tempColor = color;
            color = other.color;

            // Push apart
            const overlap = minDist - dist;
            const pushX = (dx / dist) * overlap * 0.5;
            const pushY = (dy / dist) * overlap * 0.5;
            x -= pushX;
            y -= pushY;

            // Bounce velocities
            vx = -vx * 0.6 + (Math.random() - 0.5) * 0.1;
            vy = -vy * 0.6 + (Math.random() - 0.5) * 0.1;
          }
        }

        // Gradually return to original color
        if (color !== originalColor) {
          color = originalColor;
        }

        // Add slight drift
        vx += (Math.random() - 0.5) * 0.02;
        vy += (Math.random() - 0.5) * 0.02;

        // Damping
        vx *= 0.995;
        vy *= 0.995;

        // Speed limit
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > 0.8) {
          vx = (vx / speed) * 0.8;
          vy = (vy / speed) * 0.8;
        }

        return { ...node, x, y, vx, vy, color };
      });

      nodesRef.current = updatedNodes;
      setNodes(updatedNodes);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [prefersReducedMotion, dimensions, nodes.length]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width, height: Math.max(500, rect.height) });
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

  return (
    <div className="relative">
      {/* Landscape container */}
      <div
        ref={containerRef}
        className="relative h-[600px] w-full overflow-hidden rounded-lg border border-white/10 bg-bg-deep/50"
        style={{ minHeight: '500px' }}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 via-transparent to-violet/5" />

        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredId === node.idea.id;
          const isSelected = selectedIdea?.id === node.idea.id;

          return (
            <button
              key={node.idea.id}
              className={`absolute flex items-center justify-center rounded-full border transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep ${
                isSelected ? 'z-20' : isHovered ? 'z-10' : 'z-0'
              }`}
              style={{
                left: node.x - node.radius,
                top: node.y - node.radius,
                width: node.radius * 2,
                height: node.radius * 2,
                backgroundColor: colorMapSoft[node.idea.color],
                borderColor: node.color,
                boxShadow: isHovered || isSelected
                  ? `0 0 30px ${node.color}, 0 0 60px ${colorMapSoft[node.idea.color]}`
                  : `0 0 20px ${colorMapSoft[node.idea.color]}`,
                transform: isHovered || isSelected ? 'scale(1.1)' : 'scale(1)',
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
              <span
                className="px-3 text-center font-mono text-[0.65rem] uppercase leading-tight tracking-wide"
                style={{ color: node.color }}
              >
                {node.idea.title.split(' ').slice(0, 3).join(' ')}
              </span>
            </button>
          );
        })}

        {/* Connection lines (subtle) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {nodes.map((node, i) =>
            nodes.slice(i + 1).map((other) => {
              const dx = other.x - node.x;
              const dy = other.y - node.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 300) return null;
              const opacity = Math.max(0, 1 - dist / 300) * 0.15;
              return (
                <line
                  key={`${node.idea.id}-${other.idea.id}`}
                  x1={node.x}
                  y1={node.y}
                  x2={other.x}
                  y2={other.y}
                  stroke="rgba(102, 227, 255, 1)"
                  strokeWidth="0.5"
                  strokeOpacity={opacity}
                />
              );
            })
          )}
        </svg>
      </div>

      {/* Detail panel */}
      {selectedIdea && (
        <div className="mt-6 rounded-lg border border-white/10 bg-bg-panel/80 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <span
                className="mb-2 inline-block rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider"
                style={{
                  borderColor: colorMap[selectedIdea.color],
                  color: colorMap[selectedIdea.color],
                }}
              >
                {selectedIdea.status}
              </span>
              <h3 className="text-xl font-semibold text-text-primary">
                {selectedIdea.title}
              </h3>
            </div>
            <button
              onClick={() => setSelectedIdea(null)}
              className="shrink-0 rounded-md p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
              aria-label="Close details"
            >
              ✕
            </button>
          </div>

          <p className="mb-4 text-sm font-medium text-cyan">{selectedIdea.thesis}</p>

          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-text-muted">
                Why it matters
              </p>
              <p className="text-text-secondary">{selectedIdea.whyItMatters}</p>
            </div>

            <div>
              <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-text-muted">
                Methods & Tools
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedIdea.methods.map((method) => (
                  <span
                    key={method}
                    className="rounded-sm border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-text-secondary"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>

            {selectedIdea.relatedWork.length > 0 && (
              <div>
                <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-text-muted">
                  Related Experience
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedIdea.relatedWork.map((work) => (
                    <span
                      key={work}
                      className="rounded-sm border border-cyan/20 bg-cyan/5 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-cyan/80"
                    >
                      {work}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedIdea.openQuestion && (
              <div className="rounded-md border-l-2 border-amber/50 bg-amber/5 p-3">
                <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-amber">
                  Open Question
                </p>
                <p className="text-sm text-text-secondary">{selectedIdea.openQuestion}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {selectedIdea.domains.map((domain) => (
                <span
                  key={domain}
                  className="font-mono text-[0.6rem] uppercase tracking-wider text-text-muted"
                >
                  {domain}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Mobile fallback - stacked cards
export function IdeaList({ ideas }: IdeaLandscapeProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {ideas.map((idea) => {
        const isExpanded = expandedId === idea.id;
        return (
          <button
            key={idea.id}
            className={`w-full rounded-lg border text-left transition-all duration-300 ${
              isExpanded
                ? 'border-white/20 bg-bg-panel/80'
                : 'border-white/10 bg-bg-panel/40 hover:border-white/15'
            }`}
            style={{
              borderLeftColor: colorMap[idea.color],
              borderLeftWidth: '3px',
            }}
            onClick={() => setExpandedId(isExpanded ? null : idea.id)}
            aria-expanded={isExpanded}
          >
            <div className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider"
                  style={{
                    borderColor: colorMap[idea.color],
                    color: colorMap[idea.color],
                  }}
                >
                  {idea.status}
                </span>
              </div>
              <h3 className="text-base font-semibold text-text-primary">{idea.title}</h3>
              <p className="mt-1 text-sm text-cyan">{idea.thesis}</p>

              {isExpanded && (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <p className="text-sm text-text-secondary">{idea.whyItMatters}</p>

                  <div className="flex flex-wrap gap-1">
                    {idea.methods.slice(0, 4).map((method) => (
                      <span
                        key={method}
                        className="rounded-sm border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase text-text-muted"
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
