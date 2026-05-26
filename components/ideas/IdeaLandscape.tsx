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
  rotation: number;
  rotationSpeed: number;
  color: string;
  originalColor: string;
  polygon: number[]; // Array of vertex radius multipliers
  burstTimer: number; // Timer for collision burst effect
  burstIntensity: number; // How intense the current burst is
  trail: { x: number; y: number; alpha: number }[]; // Trail effect for bursting
}

const colorMap: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 0.9)',
  violet: 'rgba(167, 139, 250, 0.9)',
  green: 'rgba(102, 240, 194, 0.9)',
  amber: 'rgba(247, 198, 107, 0.9)',
  rose: 'rgba(255, 122, 162, 0.9)',
};

const colorMapSoft: Record<string, string> = {
  cyan: 'rgba(102, 227, 255, 0.08)',
  violet: 'rgba(167, 139, 250, 0.08)',
  green: 'rgba(102, 240, 194, 0.08)',
  amber: 'rgba(247, 198, 107, 0.08)',
  rose: 'rgba(255, 122, 162, 0.08)',
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

// Generate a random irregular polygon with 5-9 vertices
function generatePolygon(sides: number): number[] {
  const vertices: number[] = [];

  for (let i = 0; i < sides; i++) {
    // More dramatic radius variation (0.55 to 1.0)
    const radiusVariation = 0.55 + Math.random() * 0.45;
    vertices.push(radiusVariation);
  }

  return vertices;
}

// Convert polygon vertices to SVG path with smooth curves
function polygonToPath(
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number,
  vertices: number[]
): string {
  const points: { x: number; y: number }[] = [];
  const sides = vertices.length;
  const angleStep = (Math.PI * 2) / sides;

  for (let i = 0; i < sides; i++) {
    const angle = angleStep * i + rotation;
    const r = radius * vertices[i];
    points.push({
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
    });
  }

  // Create a smooth curved path using quadratic bezier curves
  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < sides; i++) {
    const current = points[i];
    const next = points[(i + 1) % sides];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path += ` Q ${current.x},${current.y} ${midX},${midY}`;
  }

  path += ' Z';
  return path;
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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);
  const nodesRef = useRef<IdeaNode[]>([]);
  const lastTimeRef = useRef<number>(0);

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
    const height = Math.max(700, rect.height || 800);
    setDimensions({ width, height });

    const initialNodes: IdeaNode[] = ideas.map((idea, i) => {
      // Spread nodes across the canvas with some randomness
      const cols = Math.ceil(Math.sqrt(ideas.length * (width / height)));
      const rows = Math.ceil(ideas.length / cols);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellWidth = width / cols;
      const cellHeight = height / rows;

      const nodeRadius = 55 + Math.random() * 35; // Slightly larger for expanded area
      const sides = 5 + Math.floor(Math.random() * 5); // 5-9 sides for more variety

      // Random initial velocity in all directions
      const speed = 1.0 + Math.random() * 1.5; // Faster for larger space
      const angle = Math.random() * Math.PI * 2;

      return {
        idea,
        x: cellWidth * (col + 0.5) + (Math.random() - 0.5) * cellWidth * 0.6,
        y: cellHeight * (row + 0.5) + (Math.random() - 0.5) * cellHeight * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: nodeRadius,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.015,
        color: colorMap[idea.color],
        originalColor: colorMap[idea.color],
        polygon: generatePolygon(sides),
        burstTimer: 0,
        burstIntensity: 0,
        trail: [],
      };
    });

    setNodes(initialNodes);
    nodesRef.current = initialNodes;
  }, [ideas]);

  // Animation loop with robust physics
  useEffect(() => {
    if (prefersReducedMotion || nodes.length === 0) return;

    const animate = (currentTime: number) => {
      // Calculate delta time for frame-independent physics
      const deltaTime = lastTimeRef.current ? Math.min((currentTime - lastTimeRef.current) / 16.67, 2) : 1;
      lastTimeRef.current = currentTime;

      const currentNodes = [...nodesRef.current];
      const { width, height } = dimensions;
      const padding = 20; // Minimal edge boundary

      // Physics simulation
      for (let i = 0; i < currentNodes.length; i++) {
        const node = currentNodes[i];

        // Update trail for bursting nodes
        if (node.burstTimer > 0.3) {
          node.trail.unshift({ x: node.x, y: node.y, alpha: node.burstTimer });
          if (node.trail.length > 8) node.trail.pop();
        } else {
          // Fade out trail
          node.trail = node.trail.map(t => ({ ...t, alpha: t.alpha * 0.85 })).filter(t => t.alpha > 0.05);
        }

        // Apply velocity with delta time
        node.x += node.vx * deltaTime;
        node.y += node.vy * deltaTime;

        // Rotate (faster when bursting)
        const rotationMultiplier = node.burstTimer > 0 ? 1 + node.burstIntensity * 2 : 1;
        node.rotation += node.rotationSpeed * deltaTime * rotationMultiplier;

        // Decay burst timer
        if (node.burstTimer > 0) {
          node.burstTimer -= 0.025 * deltaTime;
          if (node.burstTimer < 0) {
            node.burstTimer = 0;
            node.burstIntensity = 0;
          }
        }

        // Boundary collision with energetic bounce
        const bounceEnergy = 0.85;
        const burstOnWall = 0.6;

        if (node.x - node.radius < padding) {
          node.x = padding + node.radius;
          node.vx = Math.abs(node.vx) * bounceEnergy;
          node.burstTimer = burstOnWall;
          node.burstIntensity = Math.abs(node.vx) / 4;
          node.rotationSpeed += (Math.random() - 0.5) * 0.02;
        }
        if (node.x + node.radius > width - padding) {
          node.x = width - padding - node.radius;
          node.vx = -Math.abs(node.vx) * bounceEnergy;
          node.burstTimer = burstOnWall;
          node.burstIntensity = Math.abs(node.vx) / 4;
          node.rotationSpeed += (Math.random() - 0.5) * 0.02;
        }
        if (node.y - node.radius < padding) {
          node.y = padding + node.radius;
          node.vy = Math.abs(node.vy) * bounceEnergy;
          node.burstTimer = burstOnWall;
          node.burstIntensity = Math.abs(node.vy) / 4;
          node.rotationSpeed += (Math.random() - 0.5) * 0.02;
        }
        if (node.y + node.radius > height - padding) {
          node.y = height - padding - node.radius;
          node.vy = -Math.abs(node.vy) * bounceEnergy;
          node.burstTimer = burstOnWall;
          node.burstIntensity = Math.abs(node.vy) / 4;
          node.rotationSpeed += (Math.random() - 0.5) * 0.02;
        }

        // Check collision with other nodes
        for (let j = i + 1; j < currentNodes.length; j++) {
          const other = currentNodes[j];
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = node.radius + other.radius;

          if (dist < minDist && dist > 0.1) {
            // Collision detected!
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // Separate the nodes (push apart)
            const separationForce = overlap / 2 + 1;
            node.x -= nx * separationForce;
            node.y -= ny * separationForce;
            other.x += nx * separationForce;
            other.y += ny * separationForce;

            // Calculate relative velocity along collision normal
            const dvx = node.vx - other.vx;
            const dvy = node.vy - other.vy;
            const dvn = dvx * nx + dvy * ny;

            // Only resolve if objects are moving toward each other
            if (dvn > 0) {
              // Mass ratio based on radius (bigger = heavier)
              const m1 = node.radius * node.radius;
              const m2 = other.radius * other.radius;
              const totalMass = m1 + m2;

              // Collision impulse with burst boost
              const restitution = 1.1; // Slightly super-elastic for fun
              const burstBoost = 2.2; // Extra energy on collision!

              const impulse = dvn * burstBoost * restitution;

              // Apply impulse based on mass ratio
              node.vx -= (impulse * m2 / totalMass) * nx;
              node.vy -= (impulse * m2 / totalMass) * ny;
              other.vx += (impulse * m1 / totalMass) * nx;
              other.vy += (impulse * m1 / totalMass) * ny;

              // Calculate collision intensity for visual effects
              const collisionSpeed = Math.sqrt(dvx * dvx + dvy * dvy);
              const intensity = Math.min(collisionSpeed / 3, 1.5);

              // Set burst timers for visual effect
              node.burstTimer = 1.2;
              node.burstIntensity = intensity;
              other.burstTimer = 1.2;
              other.burstIntensity = intensity;

              // Add spin on collision
              node.rotationSpeed += (Math.random() - 0.5) * 0.05 * intensity;
              other.rotationSpeed += (Math.random() - 0.5) * 0.05 * intensity;
            }
          }
        }

        // Add gentle random drift for organic movement
        node.vx += (Math.random() - 0.5) * 0.03 * deltaTime;
        node.vy += (Math.random() - 0.5) * 0.03 * deltaTime;

        // Apply friction (less friction when bursting)
        const baseFriction = 0.992;
        const burstFriction = 0.998;
        const friction = node.burstTimer > 0 ? burstFriction : baseFriction;
        node.vx *= Math.pow(friction, deltaTime);
        node.vy *= Math.pow(friction, deltaTime);

        // Dampen rotation over time
        node.rotationSpeed *= Math.pow(0.995, deltaTime);

        // Speed limits - higher for larger area
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        const maxSpeed = node.burstTimer > 0 ? 10 : 4;
        const minSpeed = 0.5;

        if (speed > maxSpeed) {
          node.vx = (node.vx / speed) * maxSpeed;
          node.vy = (node.vy / speed) * maxSpeed;
        }

        // Keep things moving - add gentle impulse if too slow
        if (speed < minSpeed && node.burstTimer <= 0) {
          const angle = Math.random() * Math.PI * 2;
          node.vx += Math.cos(angle) * 0.25;
          node.vy += Math.sin(angle) * 0.25;
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

  // Handle resize
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

  return (
    <div className="relative -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Landscape container - seamlessly matches site background, edge-to-edge */}
      <div
        ref={containerRef}
        className="relative h-[85vh] w-full overflow-hidden"
        style={{
          minHeight: '700px',
          maxHeight: '1000px',
          background: 'transparent',
        }}
      >
        {/* Very subtle vignette for depth */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.2) 100%)',
          }}
        />

        {/* SVG Layer for polygons and connections */}
        <svg
          className="absolute inset-0 h-full w-full"
          style={{ zIndex: 1 }}
        >
          <defs>
            {/* Glow filters for each color */}
            {Object.entries(colorMapGlow).map(([color, rgba]) => (
              <filter key={color} id={`glow-${color}`} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feFlood floodColor={rgba} />
                <feComposite in2="blur" operator="in" />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}

            {/* Burst glow filter */}
            <filter id="burst-glow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="15" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Connection lines between nearby nodes */}
          {nodes.map((node, i) =>
            nodes.slice(i + 1).map((other) => {
              const dx = other.x - node.x;
              const dy = other.y - node.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 400) return null; // Increased range for larger area

              // Connections glow brighter when both nodes are bursting
              const burstGlow = (node.burstTimer + other.burstTimer) / 2;
              const baseOpacity = Math.max(0, 1 - dist / 400) * 0.12;
              const opacity = baseOpacity + burstGlow * 0.3;

              return (
                <line
                  key={`${node.idea.id}-${other.idea.id}`}
                  x1={node.x}
                  y1={node.y}
                  x2={other.x}
                  y2={other.y}
                  stroke={burstGlow > 0.3 ? colorMapBurst[node.idea.color] : 'rgba(102, 227, 255, 0.8)'}
                  strokeWidth={burstGlow > 0.3 ? 1.5 : 0.5}
                  strokeOpacity={opacity}
                  strokeDasharray={burstGlow > 0.3 ? 'none' : '4,6'}
                />
              );
            })
          )}

          {/* Trail effects for bursting nodes */}
          {nodes.map((node) =>
            node.trail.map((point, idx) => (
              <circle
                key={`trail-${node.idea.id}-${idx}`}
                cx={point.x}
                cy={point.y}
                r={node.radius * 0.3 * point.alpha}
                fill={colorMapGlow[node.idea.color]}
                opacity={point.alpha * 0.4}
              />
            ))
          )}

          {/* Polygon nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredId === node.idea.id;
            const isSelected = selectedIdea?.id === node.idea.id;
            const isBursting = node.burstTimer > 0;

            // Scale up slightly when bursting
            const burstScale = 1 + node.burstIntensity * 0.15;
            const effectiveRadius = node.radius * (isBursting ? burstScale : 1);

            const path = polygonToPath(node.x, node.y, effectiveRadius, node.rotation, node.polygon);
            const innerPath = polygonToPath(node.x, node.y, effectiveRadius * 0.75, node.rotation, node.polygon);

            return (
              <g key={node.idea.id}>
                {/* Outer burst glow when colliding */}
                {isBursting && (
                  <path
                    d={polygonToPath(node.x, node.y, effectiveRadius * (1.2 + node.burstIntensity * 0.3), node.rotation, node.polygon)}
                    fill={colorMapGlow[node.idea.color]}
                    opacity={node.burstTimer * node.burstIntensity}
                    filter="url(#burst-glow)"
                  />
                )}

                {/* Ambient glow */}
                <path
                  d={path}
                  fill={colorMapGlow[node.idea.color]}
                  opacity={isBursting ? 0.6 + node.burstIntensity * 0.3 : 0.3}
                  filter={`url(#glow-${node.idea.color})`}
                />

                {/* Main polygon fill */}
                <path
                  d={path}
                  fill={colorMapSoft[node.idea.color]}
                  stroke={isBursting ? colorMapBurst[node.idea.color] : node.color}
                  strokeWidth={isHovered || isSelected ? 2.5 : isBursting ? 2 : 1.2}
                  strokeOpacity={isBursting ? 1 : 0.8}
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-width 0.15s ease',
                  }}
                  onMouseEnter={() => setHoveredId(node.idea.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleNodeClick(node.idea)}
                />

                {/* Inner decorative shape */}
                <path
                  d={innerPath}
                  fill="none"
                  stroke={node.color}
                  strokeWidth="0.5"
                  strokeOpacity={isBursting ? 0.5 : 0.2}
                  strokeDasharray="2,4"
                  pointerEvents="none"
                />

                {/* Center dot */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isBursting ? 4 + node.burstIntensity * 2 : 2}
                  fill={isBursting ? colorMapBurst[node.idea.color] : node.color}
                  opacity={isBursting ? 1 : 0.5}
                />
              </g>
            );
          })}
        </svg>

        {/* Text labels layer (HTML for better text rendering) */}
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 2 }}>
          {nodes.map((node) => {
            const isHovered = hoveredId === node.idea.id;
            const isSelected = selectedIdea?.id === node.idea.id;
            const isBursting = node.burstTimer > 0;
            const burstScale = 1 + node.burstIntensity * 0.15;
            const effectiveRadius = node.radius * (isBursting ? burstScale : 1);

            return (
              <button
                key={`label-${node.idea.id}`}
                className="pointer-events-auto absolute flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                style={{
                  left: node.x - effectiveRadius,
                  top: node.y - effectiveRadius,
                  width: effectiveRadius * 2,
                  height: effectiveRadius * 2,
                  transform: isHovered || isSelected ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.15s ease',
                  background: 'transparent',
                  border: 'none',
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
                  className="max-w-[85%] text-center font-mono text-[0.58rem] uppercase leading-tight tracking-wide"
                  style={{
                    color: isBursting ? colorMapBurst[node.idea.color] : node.color,
                    textShadow: isBursting
                      ? `0 0 20px ${colorMapGlow[node.idea.color]}, 0 0 40px ${colorMapGlow[node.idea.color]}`
                      : `0 0 8px ${colorMapSoft[node.idea.color]}`,
                  }}
                >
                  {node.idea.title.split(' ').slice(0, 3).join(' ')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selectedIdea && (
        <div className="mx-4 sm:mx-6 lg:mx-8 mt-6 rounded-lg border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <span
                className="mb-2 inline-block rounded-sm border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider"
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
              <div className="rounded-sm border-l-2 border-amber/50 bg-amber/5 p-3">
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
            className={`w-full text-left transition-all duration-300 rounded-lg border border-white/10 bg-white/[0.02] ${
              isExpanded ? 'border-white/20' : 'hover:border-white/15'
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
                  className="rounded-sm border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider"
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
