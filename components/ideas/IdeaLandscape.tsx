'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ResearchIdea } from '@/data/research-ideas';
import { useMediaQuery } from '@/lib/hooks/useBrowserState';

interface IdeaNode {
  idea: ResearchIdea;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  polygon: number[];
  rotation: number;
  rotationSpeed: number;
  color: string;
  burstTimer: number;
  burstIntensity: number;
  trail: { x: number; y: number; age: number }[];
}

const colorMap: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 0.9)',
  violet: 'rgba(167, 139, 250, 0.9)',
  green: 'rgba(102, 240, 194, 0.9)',
  amber: 'rgba(247, 198, 107, 0.9)',
  rose: 'rgba(255, 122, 162, 0.9)',
};

const colorMapSoft: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 0.03)',
  violet: 'rgba(167, 139, 250, 0.03)',
  green: 'rgba(102, 240, 194, 0.03)',
  amber: 'rgba(247, 198, 107, 0.03)',
  rose: 'rgba(255, 122, 162, 0.03)',
};

const colorMapGlow: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 0.5)',
  violet: 'rgba(167, 139, 250, 0.5)',
  green: 'rgba(102, 240, 194, 0.5)',
  amber: 'rgba(247, 198, 107, 0.5)',
  rose: 'rgba(255, 122, 162, 0.5)',
};

const colorMapBurst: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 1)',
  violet: 'rgba(167, 139, 250, 1)',
  green: 'rgba(102, 240, 194, 1)',
  amber: 'rgba(247, 198, 107, 1)',
  rose: 'rgba(255, 122, 162, 1)',
};

// Generate a random polygon with smooth bezier curves
function generatePolygon(vertices: number): number[] {
  const points: number[] = [];
  const angleStep = (Math.PI * 2) / vertices;

  for (let i = 0; i < vertices; i++) {
    const angle = angleStep * i - Math.PI / 2;
    const radiusVariation = 0.85 + Math.random() * 0.3;
    points.push(Math.cos(angle) * radiusVariation);
    points.push(Math.sin(angle) * radiusVariation);
  }

  return points;
}

// Convert polygon points to SVG path with smooth curves
function polygonToPath(points: number[], radius: number, centerX: number, centerY: number): string {
  if (points.length < 4) return '';

  const numPoints = points.length / 2;
  const scaledPoints: { x: number; y: number }[] = [];

  for (let i = 0; i < numPoints; i++) {
    scaledPoints.push({
      x: centerX + points[i * 2] * radius,
      y: centerY + points[i * 2 + 1] * radius,
    });
  }

  let path = `M ${scaledPoints[0].x} ${scaledPoints[0].y}`;

  for (let i = 0; i < numPoints; i++) {
    const p0 = scaledPoints[i];
    const p1 = scaledPoints[(i + 1) % numPoints];
    const p2 = scaledPoints[(i + 2) % numPoints];

    const cp1x = p1.x - (p2.x - p0.x) * 0.15;
    const cp1y = p1.y - (p2.y - p0.y) * 0.15;
    const cp2x = p1.x + (p2.x - p0.x) * 0.15;
    const cp2y = p1.y + (p2.y - p0.y) * 0.15;

    path += ` Q ${cp1x} ${cp1y} ${p1.x} ${p1.y}`;
  }

  path += ' Z';
  return path;
}

// Format title into lines that fit within polygon
function formatTitle(title: string, maxCharsPerLine: number = 12): string[] {
  const words = title.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

interface IdeaLandscapeProps {
  ideas: ResearchIdea[];
}

export function IdeaLandscape({ ideas }: IdeaLandscapeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<IdeaNode[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<ResearchIdea | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const animationRef = useRef<number | undefined>(undefined);
  const nodesRef = useRef<IdeaNode[]>([]);
  const lastTimeRef = useRef<number>(0);

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

      const speed = 0.8 + Math.random() * 0.8;
      const angle = Math.random() * Math.PI * 2;
      const vertices = 5 + Math.floor(Math.random() * 5); // 5-9 vertices

      // Smaller polygons with 14px font - tighter fit
      const titleLines = formatTitle(idea.title);
      const baseRadius = 58 + Math.min(titleLines.length * 5, 18);

      return {
        idea,
        x: cellWidth * (col + 0.5) + (Math.random() - 0.5) * cellWidth * 0.3,
        y: cellHeight * (row + 0.5) + (Math.random() - 0.5) * cellHeight * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: baseRadius,
        polygon: generatePolygon(vertices),
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        color: colorMap[idea.color],
        burstTimer: 0,
        burstIntensity: 0,
        trail: [],
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
      const padding = 5; // Minimal border - nodes can go nearly to edges

      for (let i = 0; i < currentNodes.length; i++) {
        const node = currentNodes[i];
        const mass = node.radius * node.radius;

        // Update position
        node.x += node.vx * deltaTime;
        node.y += node.vy * deltaTime;

        // Update rotation
        node.rotation += node.rotationSpeed * deltaTime;
        if (node.rotation > 360) node.rotation -= 360;
        if (node.rotation < 0) node.rotation += 360;

        // Update burst timer
        if (node.burstTimer > 0) {
          node.burstTimer -= 0.02 * deltaTime;
          if (node.burstTimer < 0) {
            node.burstTimer = 0;
            node.burstIntensity = 0;
          }

          // Add more trails during burst for dramatic effect
          if (node.burstTimer > 0.2 && Math.random() > 0.4) {
            node.trail.push({ x: node.x, y: node.y, age: 0 });
          }
        }

        // Update trails
        node.trail = node.trail
          .map(t => ({ ...t, age: t.age + 0.05 * deltaTime }))
          .filter(t => t.age < 1);

        // Boundary collision
        const bounceEnergy = 0.85;
        if (node.x - node.radius < padding) {
          node.x = padding + node.radius;
          node.vx = Math.abs(node.vx) * bounceEnergy;
          node.rotationSpeed += (Math.random() - 0.5) * 0.8;
          node.burstTimer = 0.5;
          node.burstIntensity = Math.min(Math.abs(node.vx) / 2, 1);
        }
        if (node.x + node.radius > width - padding) {
          node.x = width - padding - node.radius;
          node.vx = -Math.abs(node.vx) * bounceEnergy;
          node.rotationSpeed += (Math.random() - 0.5) * 0.8;
          node.burstTimer = 0.5;
          node.burstIntensity = Math.min(Math.abs(node.vx) / 2, 1);
        }
        if (node.y - node.radius < padding) {
          node.y = padding + node.radius;
          node.vy = Math.abs(node.vy) * bounceEnergy;
          node.rotationSpeed += (Math.random() - 0.5) * 0.8;
          node.burstTimer = 0.5;
          node.burstIntensity = Math.min(Math.abs(node.vy) / 2, 1);
        }
        if (node.y + node.radius > height - padding) {
          node.y = height - padding - node.radius;
          node.vy = -Math.abs(node.vy) * bounceEnergy;
          node.rotationSpeed += (Math.random() - 0.5) * 0.8;
          node.burstTimer = 0.5;
          node.burstIntensity = Math.min(Math.abs(node.vy) / 2, 1);
        }

        // Node-to-node collision
        for (let j = i + 1; j < currentNodes.length; j++) {
          const other = currentNodes[j];
          const otherMass = other.radius * other.radius;

          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = node.radius + other.radius + 8;

          if (dist < minDist && dist > 0.1) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // Separate nodes
            const totalMass = mass + otherMass;
            const node1Ratio = otherMass / totalMass;
            const node2Ratio = mass / totalMass;

            node.x -= nx * overlap * node1Ratio;
            node.y -= ny * overlap * node1Ratio;
            other.x += nx * overlap * node2Ratio;
            other.y += ny * overlap * node2Ratio;

            // Collision physics - dampen if already accelerating, boost if calm
            const dvx = node.vx - other.vx;
            const dvy = node.vy - other.vy;
            const dvn = dvx * nx + dvy * ny;

            if (dvn > 0) {
              const collisionSpeed = Math.sqrt(dvx * dvx + dvy * dvy);

              // Check if either node is already accelerating from a previous collision
              const nodeAlreadyBursting = node.burstTimer > 0.3;
              const otherAlreadyBursting = other.burstTimer > 0.3;
              const eitherBursting = nodeAlreadyBursting || otherAlreadyBursting;

              if (eitherBursting) {
                // DAMPEN: If already accelerating, this collision slows them down
                const dampFactor = 0.4;
                node.vx -= dvn * nx * node1Ratio * dampFactor;
                node.vy -= dvn * ny * node1Ratio * dampFactor;
                other.vx += dvn * nx * node2Ratio * dampFactor;
                other.vy += dvn * ny * node2Ratio * dampFactor;

                // Apply extra friction to slow down
                node.vx *= 0.7;
                node.vy *= 0.7;
                other.vx *= 0.7;
                other.vy *= 0.7;

                // Shorter, dimmer flash for dampened collision
                const intensity = Math.min(collisionSpeed / 3, 0.5);
                node.burstTimer = 0.4;
                node.burstIntensity = intensity;
                other.burstTimer = 0.4;
                other.burstIntensity = intensity;
              } else {
                // BOOST: If both are calm, energize them
                const burstBoost = 2.2;
                const impulse = dvn * burstBoost;

                node.vx -= impulse * nx * node1Ratio * 2;
                node.vy -= impulse * ny * node1Ratio * 2;
                other.vx += impulse * nx * node2Ratio * 2;
                other.vy += impulse * ny * node2Ratio * 2;

                // Extra directional kick
                const extraBoost = Math.min(collisionSpeed * 0.3, 1.5);
                node.vx -= nx * extraBoost * 0.4;
                node.vy -= ny * extraBoost * 0.4;
                other.vx += nx * extraBoost * 0.4;
                other.vy += ny * extraBoost * 0.4;

                // Bright burst effect
                const intensity = Math.min(collisionSpeed / 1.5, 1);
                node.burstTimer = 1.2;
                node.burstIntensity = Math.max(intensity, 0.5);
                other.burstTimer = 1.2;
                other.burstIntensity = Math.max(intensity, 0.5);
              }

              // Spin on collision (less if dampening)
              const spinFactor = eitherBursting ? 0.8 : 2.0;
              node.rotationSpeed += (Math.random() - 0.5) * spinFactor;
              other.rotationSpeed += (Math.random() - 0.5) * spinFactor;
            }
          }
        }

        // Random walk - keeps things moving and interacting
        node.vx += (Math.random() - 0.5) * 0.015 * deltaTime;
        node.vy += (Math.random() - 0.5) * 0.015 * deltaTime;

        // Friction - less friction allows more sustained movement
        const friction = node.burstTimer > 0 ? 0.996 : 0.992;
        node.vx *= Math.pow(friction, deltaTime);
        node.vy *= Math.pow(friction, deltaTime);

        // Rotation friction
        node.rotationSpeed *= Math.pow(0.992, deltaTime);

        // Speed limits - allow more movement for better interaction
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        const maxSpeed = node.burstTimer > 0 ? 5 : 2.2;
        const minSpeed = 0.3;

        if (speed > maxSpeed) {
          node.vx = (node.vx / speed) * maxSpeed;
          node.vy = (node.vy / speed) * maxSpeed;
        }

        // More frequent nudge if too slow - ensures continuous interaction
        if (speed < minSpeed && node.burstTimer <= 0 && Math.random() > 0.8) {
          const kickAngle = Math.random() * Math.PI * 2;
          node.vx += Math.cos(kickAngle) * 0.15;
          node.vy += Math.sin(kickAngle) * 0.15;
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
  }, [prefersReducedMotion, dimensions, nodes.length]);

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

  return (
    <div className="relative -mx-4 sm:-mx-8 lg:-mx-12 xl:-mx-16">
      <div
        ref={containerRef}
        className="relative h-[85vh] w-full overflow-hidden"
        style={{ minHeight: '700px', maxHeight: '1000px', background: 'transparent' }}
      >
{/* Background removed - transparent to blend with site */}

        <svg className="absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
          <defs>
            {nodes.map((node) => (
              <filter key={`glow-${node.idea.id}`} id={`glow-${node.idea.id}`} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation={6 + node.burstIntensity * 18} result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {/* Connection lines - glow intensely during burst */}
          {nodes.map((node, i) =>
            nodes.slice(i + 1).map((other) => {
              const dx = other.x - node.x;
              const dy = other.y - node.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 380) return null;

              const burstGlow = (node.burstTimer + other.burstTimer) / 2;
              const isBothBursting = node.burstTimer > 0.3 && other.burstTimer > 0.3;
              const opacity = Math.max(0, 1 - dist / 380) * 0.12 + burstGlow * 0.5;

              return (
                <line
                  key={`${node.idea.id}-${other.idea.id}`}
                  x1={node.x}
                  y1={node.y}
                  x2={other.x}
                  y2={other.y}
                  stroke={burstGlow > 0.15 ? colorMapBurst[node.idea.color] : 'rgba(102, 227, 255, 0.5)'}
                  strokeWidth={isBothBursting ? 3 : burstGlow > 0.15 ? 2 : 0.5}
                  strokeOpacity={opacity}
                  strokeDasharray={burstGlow > 0.15 ? 'none' : '3,8'}
                />
              );
            })
          )}

          {/* Trails - larger and more visible */}
          {nodes.map((node) =>
            node.trail.map((t, idx) => (
              <circle
                key={`trail-${node.idea.id}-${idx}`}
                cx={t.x}
                cy={t.y}
                r={10 * (1 - t.age)}
                fill={colorMapBurst[node.idea.color]}
                opacity={0.5 * (1 - t.age)}
              />
            ))
          )}

          {/* Polygon nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredId === node.idea.id;
            const isSelected = selectedIdea?.id === node.idea.id;
            const isBursting = node.burstTimer > 0;
            const titleLines = formatTitle(node.idea.title);
            const scale = 1 + node.burstIntensity * 0.18;

            return (
              <g
                key={node.idea.id}
                transform={`translate(${node.x}, ${node.y}) rotate(${node.rotation}) scale(${scale})`}
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node.idea)}
                onMouseEnter={() => setHoveredId(node.idea.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Intense glow effect during burst */}
                {isBursting && (
                  <>
                    {/* Outer glow ring */}
                    <path
                      d={polygonToPath(node.polygon, node.radius * 1.4, 0, 0)}
                      fill="none"
                      stroke={colorMapBurst[node.idea.color]}
                      strokeWidth={3 + node.burstIntensity * 8}
                      opacity={node.burstIntensity * 0.4}
                      filter={`url(#glow-${node.idea.id})`}
                    />
                    {/* Inner bright ring */}
                    <path
                      d={polygonToPath(node.polygon, node.radius * 1.12, 0, 0)}
                      fill="none"
                      stroke={colorMapBurst[node.idea.color]}
                      strokeWidth={2 + node.burstIntensity * 5}
                      opacity={node.burstIntensity * 0.8}
                      filter={`url(#glow-${node.idea.id})`}
                    />
                  </>
                )}

                {/* Main polygon with flash fill on burst */}
                <path
                  d={polygonToPath(node.polygon, node.radius, 0, 0)}
                  fill={isBursting
                    ? `rgba(${node.idea.color === 'cyan' ? '102, 227, 255' : node.idea.color === 'violet' ? '167, 139, 250' : node.idea.color === 'green' ? '102, 240, 194' : node.idea.color === 'amber' ? '247, 198, 107' : '255, 122, 162'}, ${0.04 + node.burstIntensity * 0.1})`
                    : colorMapSoft[node.idea.color]}
                  stroke={isBursting ? colorMapBurst[node.idea.color] : isHovered || isSelected ? colorMap[node.idea.color] : colorMapGlow[node.idea.color]}
                  strokeWidth={isBursting ? 2.5 : isHovered ? 2 : 1.5}
                  style={{
                    transition: 'stroke 0.2s, stroke-width 0.2s',
                  }}
                />

                {/* Counter-rotate text so it stays readable */}
                <g transform={`rotate(${-node.rotation})`}>
                  {/* Title text - larger and bolder */}
                  {titleLines.map((line, idx) => {
                    const totalLines = titleLines.length;
                    const lineHeight = 18;
                    const startY = -((totalLines - 1) * lineHeight) / 2;

                    return (
                      <text
                        key={idx}
                        x={0}
                        y={startY + idx * lineHeight}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isBursting ? colorMapBurst[node.idea.color] : colorMap[node.idea.color]}
                        fontSize="14"
                        fontFamily="ui-monospace, monospace"
                        fontWeight="600"
                        letterSpacing="0.04em"
                        style={{
                          textTransform: 'uppercase',
                          transition: 'fill 0.2s',
                        }}
                      >
                        {line}
                      </text>
                    );
                  })}

                  {/* Status indicator */}
                  <circle
                    cx={node.radius * 0.6}
                    cy={-node.radius * 0.6}
                    r={4}
                    fill={node.idea.status === 'active'
                      ? colorMapBurst[node.idea.color]
                      : node.idea.status === 'draft'
                      ? colorMap[node.idea.color]
                      : `${colorMap[node.idea.color]}60`}
                    stroke={isBursting ? colorMapBurst[node.idea.color] : 'none'}
                    strokeWidth={isBursting ? 2 : 0}
                    opacity={node.idea.status === 'active' ? 1 : 0.7}
                  />
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail panel */}
      {selectedIdea && (
        <div className="mx-4 mt-8 rounded-lg border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm sm:mx-6 lg:mx-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-6 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: colorMap[selectedIdea.color] }}
                />
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

          {/* Thesis */}
          <div
            className="mb-8 p-4 rounded-lg border-l-2"
            style={{ borderColor: colorMap[selectedIdea.color], background: colorMapSoft[selectedIdea.color] }}
          >
            <p className="text-base text-text-primary leading-relaxed">{selectedIdea.thesis}</p>
          </div>

          {/* Grid layout */}
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-text-muted">
                Why It Matters
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">{selectedIdea.whyItMatters}</p>
            </div>

            {selectedIdea.openQuestion && (
              <div className="space-y-3">
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-amber">
                  Open Question
                </p>
                <p className="text-sm text-text-secondary leading-relaxed italic">
                  &ldquo;{selectedIdea.openQuestion}&rdquo;
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
          <div className="mt-8 border-t border-white/8 pt-6">
            {selectedIdea.sourceLinks && selectedIdea.sourceLinks.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">Source Work:</span>
                {selectedIdea.sourceLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="rounded-md border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider transition-colors hover:bg-white/5"
                    style={{ borderColor: `${colorMap[selectedIdea.color]}55`, color: colorMap[selectedIdea.color] }}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
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

        return (
          <div
            key={idea.id}
            className={`w-full overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] text-left transition-all duration-300 ${
              isExpanded ? 'border-white/20' : 'hover:border-white/15'
            }`}
            style={{ borderLeftColor: colorMap[idea.color], borderLeftWidth: '3px' }}
          >
            <button
              className="w-full text-left"
              onClick={() => setExpandedId(isExpanded ? null : idea.id)}
              aria-expanded={isExpanded}
            >
              <div className="p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: colorMap[idea.color] }}
                  />
                  <span
                    className="rounded-sm border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider"
                    style={{ borderColor: colorMap[idea.color], color: colorMap[idea.color] }}
                  >
                    {idea.status}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-text-primary">{idea.title}</h3>
                <p className="mt-2 text-sm text-cyan">{idea.thesis}</p>
              </div>
            </button>

            {isExpanded && (
              <div className="mx-5 space-y-4 border-t border-white/10 pb-5 pt-5">
                <p className="text-sm leading-relaxed text-text-secondary">{idea.whyItMatters}</p>

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

                {idea.sourceLinks && idea.sourceLinks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {idea.sourceLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target={link.href.startsWith('http') ? '_blank' : undefined}
                        rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="rounded-md border px-2 py-0.5 font-mono text-[0.55rem] uppercase"
                        style={{ borderColor: `${colorMap[idea.color]}55`, color: colorMap[idea.color] }}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}

                {idea.openQuestion && (
                  <p className="text-sm italic text-amber/80">&ldquo;{idea.openQuestion}&rdquo;</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
