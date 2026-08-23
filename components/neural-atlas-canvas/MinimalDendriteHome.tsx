'use client';

import { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { VISUAL_LIMITS, ATLAS_PALETTE } from './visualLimits';

type Vec2 = { x: number; y: number };
type Dimensions = { width: number; height: number };

/**
 * Dendrite branch with hierarchical structure
 */
type DendriteBranch = {
  id: string;
  points: Vec2[];
  depth: number;
  widthStart: number;
  widthEnd: number;
  alpha: number;
  children: DendriteBranch[];
  labelId?: string; // Terminal branch that anchors a label
};

type NavLabel = {
  id: string;
  label: string;
  href: string;
  color: string;
};

/**
 * Navigation labels - will be attached to terminal branches
 */
const NAV_LABELS: NavLabel[] = [
  { id: 'projects', label: 'Builds', href: '/projects', color: '#b6d7df' },
  { id: 'publications', label: 'Paper Archive', href: '/publications', color: '#c8d2dd' },
  { id: 'work', label: 'Deployed Systems', href: '/case-studies', color: '#d6ddd3' },
  { id: 'photography', label: 'Visual Cortex', href: '/photography', color: '#d7c9d1' },
  { id: 'ideas', label: 'Research', href: '/ideas', color: '#c9d9cf' },
  { id: 'contact', label: 'Contact', href: '/contact', color: '#c2ceda' },
];

const IDENTITY_LABEL = 'Core';

const INITIAL_DIMENSIONS: Dimensions = { width: 0, height: 0 };

function getStableViewportDimensions(container: HTMLElement): Dimensions {
  const rect = container.getBoundingClientRect();
  const viewport = window.visualViewport;
  const width = Math.round(rect.width || viewport?.width || window.innerWidth || 0);
  const height = Math.round(rect.height || viewport?.height || window.innerHeight || 0);

  return { width, height };
}

/**
 * Seeded random for consistent morphology
 */
function seededRNG(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let v = state;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate organic curved path between two points
 */
function generateOrganicPath(
  start: Vec2,
  end: Vec2,
  rng: () => number,
  segmentCount: number = 8,
  wobbleFactor: number = 0.15
): Vec2[] {
  const points: Vec2[] = [{ ...start }];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const baseAngle = Math.atan2(dy, dx);

  let x = start.x;
  let y = start.y;
  let angle = baseAngle;

  for (let i = 1; i <= segmentCount; i++) {
    const t = i / segmentCount;

    // Add perpendicular wobble
    const wobble = (rng() - 0.5) * length * wobbleFactor * (1 - t * 0.5);
    const perpX = -Math.sin(baseAngle) * wobble;
    const perpY = Math.cos(baseAngle) * wobble;

    // Angular drift
    angle += (rng() - 0.5) * 0.25;

    // Interpolate with drift
    x = start.x + dx * t + perpX;
    y = start.y + dy * t + perpY;

    points.push({ x, y });
  }

  return points;
}

/**
 * Generate a full dendritic tree from soma
 */
function generateDendriticTree(
  somaCenter: Vec2,
  viewportWidth: number,
  viewportHeight: number,
  seed: string,
  labelIds: string[]
): { allBranches: DendriteBranch[]; labelPositions: Map<string, Vec2> } {
  const rng = seededRNG(seed);
  const allBranches: DendriteBranch[] = [];
  const labelPositions = new Map<string, Vec2>();

  // Tree spans 65-80% of viewport
  const treeRadius = Math.min(viewportWidth, viewportHeight) * 0.38;

  // 6 primary dendrites
  const primaryCount = 6;
  let labelIndex = 0;

  // Assign labels to primary dendrites (some will have navigation, others decorative)
  const labelsPerPrimary: (string | null)[] = [];
  for (let i = 0; i < primaryCount; i++) {
    if (labelIndex < labelIds.length) {
      labelsPerPrimary.push(labelIds[labelIndex]);
      labelIndex++;
    } else {
      labelsPerPrimary.push(null);
    }
  }

  // Shuffle labels assignment for organic feel
  for (let i = labelsPerPrimary.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [labelsPerPrimary[i], labelsPerPrimary[j]] = [labelsPerPrimary[j], labelsPerPrimary[i]];
  }

  for (let i = 0; i < primaryCount; i++) {
    // Irregular angular distribution
    const baseAngle = (i / primaryCount) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const assignedLabel = labelsPerPrimary[i];

    // Generate primary dendrite
    const primaryLength = treeRadius * (0.7 + rng() * 0.35);
    const primaryEnd: Vec2 = {
      x: somaCenter.x + Math.cos(baseAngle) * primaryLength,
      y: somaCenter.y + Math.sin(baseAngle) * primaryLength,
    };

    const primaryPath = generateOrganicPath(somaCenter, primaryEnd, rng, 10, 0.08);

    const primaryBranch: DendriteBranch = {
      id: `primary-${i}`,
      points: primaryPath,
      depth: 0,
      widthStart: 2.2 + rng() * 0.3,
      widthEnd: 1.4 + rng() * 0.2,
      alpha: 0.65 + rng() * 0.1,
      children: [],
    };

    // Secondary branches from primary (2-4 per primary)
    const secondaryCount = 2 + Math.floor(rng() * 3);
    let labelAssigned = false;

    for (let j = 0; j < secondaryCount; j++) {
      // Branch point along primary (30% - 85% along length)
      const branchT = 0.3 + rng() * 0.55;
      const branchIndex = Math.floor(branchT * (primaryPath.length - 1));
      const branchStart = primaryPath[branchIndex];

      // Branch angle diverges from primary direction
      const primaryDir = Math.atan2(
        primaryPath[branchIndex + 1]?.y - branchStart.y || 0,
        primaryPath[branchIndex + 1]?.x - branchStart.x || 1
      );
      const branchAngle = primaryDir + (rng() > 0.5 ? 1 : -1) * (0.4 + rng() * 0.5);

      const secondaryLength = primaryLength * (0.35 + rng() * 0.25);
      const secondaryEnd: Vec2 = {
        x: branchStart.x + Math.cos(branchAngle) * secondaryLength,
        y: branchStart.y + Math.sin(branchAngle) * secondaryLength,
      };

      const secondaryPath = generateOrganicPath(branchStart, secondaryEnd, rng, 7, 0.12);

      const secondaryBranch: DendriteBranch = {
        id: `secondary-${i}-${j}`,
        points: secondaryPath,
        depth: 1,
        widthStart: 1.2 + rng() * 0.2,
        widthEnd: 0.7 + rng() * 0.15,
        alpha: 0.48 + rng() * 0.1,
        children: [],
      };

      // Terminal twigs from secondary (1-3 per secondary)
      const terminalCount = 1 + Math.floor(rng() * 3);

      for (let k = 0; k < terminalCount; k++) {
        const twigT = 0.5 + rng() * 0.45;
        const twigIndex = Math.floor(twigT * (secondaryPath.length - 1));
        const twigStart = secondaryPath[twigIndex];

        const secondaryDir = Math.atan2(
          secondaryPath[twigIndex + 1]?.y - twigStart.y || 0,
          secondaryPath[twigIndex + 1]?.x - twigStart.x || 1
        );
        const twigAngle = secondaryDir + (rng() > 0.5 ? 1 : -1) * (0.35 + rng() * 0.45);

        const twigLength = secondaryLength * (0.3 + rng() * 0.3);
        const twigEnd: Vec2 = {
          x: twigStart.x + Math.cos(twigAngle) * twigLength,
          y: twigStart.y + Math.sin(twigAngle) * twigLength,
        };

        const twigPath = generateOrganicPath(twigStart, twigEnd, rng, 5, 0.18);

        // Assign label to one terminal branch per primary (if this primary has a label)
        const shouldHaveLabel = assignedLabel && !labelAssigned && (k === terminalCount - 1 || rng() > 0.6);

        const terminalBranch: DendriteBranch = {
          id: `terminal-${i}-${j}-${k}`,
          points: twigPath,
          depth: 2,
          widthStart: 0.6 + rng() * 0.15,
          widthEnd: 0.35 + rng() * 0.1,
          alpha: 0.32 + rng() * 0.12,
          children: [],
          labelId: shouldHaveLabel ? assignedLabel : undefined,
        };

        if (shouldHaveLabel && assignedLabel) {
          labelAssigned = true;
          // Label position is at the tip of the terminal branch
          const tip = twigPath[twigPath.length - 1];
          labelPositions.set(assignedLabel, { x: tip.x, y: tip.y });
        }

        secondaryBranch.children.push(terminalBranch);
        allBranches.push(terminalBranch);
      }

      // Also add some direct terminal twigs from end of secondary
      if (rng() > 0.4) {
        const endTwigAngle = Math.atan2(
          secondaryEnd.y - secondaryPath[secondaryPath.length - 2].y,
          secondaryEnd.x - secondaryPath[secondaryPath.length - 2].x
        ) + (rng() - 0.5) * 0.6;

        const endTwigLength = secondaryLength * 0.25;
        const endTwigEnd: Vec2 = {
          x: secondaryEnd.x + Math.cos(endTwigAngle) * endTwigLength,
          y: secondaryEnd.y + Math.sin(endTwigAngle) * endTwigLength,
        };

        const endTwigPath = generateOrganicPath(secondaryEnd, endTwigEnd, rng, 4, 0.2);

        const shouldHaveEndLabel = assignedLabel && !labelAssigned;

        const endTerminal: DendriteBranch = {
          id: `end-terminal-${i}-${j}`,
          points: endTwigPath,
          depth: 2,
          widthStart: 0.5,
          widthEnd: 0.3,
          alpha: 0.28,
          children: [],
          labelId: shouldHaveEndLabel ? assignedLabel : undefined,
        };

        if (shouldHaveEndLabel && assignedLabel) {
          labelAssigned = true;
          const tip = endTwigPath[endTwigPath.length - 1];
          labelPositions.set(assignedLabel, { x: tip.x, y: tip.y });
        }

        secondaryBranch.children.push(endTerminal);
        allBranches.push(endTerminal);
      }

      primaryBranch.children.push(secondaryBranch);
      allBranches.push(secondaryBranch);
    }

    // Also add terminal directly from primary end
    const primaryEndTwig = rng() > 0.3;
    if (primaryEndTwig) {
      const endAngle = baseAngle + (rng() - 0.5) * 0.4;
      const endLength = primaryLength * 0.2;
      const directEnd: Vec2 = {
        x: primaryEnd.x + Math.cos(endAngle) * endLength,
        y: primaryEnd.y + Math.sin(endAngle) * endLength,
      };

      const directPath = generateOrganicPath(primaryEnd, directEnd, rng, 4, 0.15);

      const shouldHaveDirectLabel = assignedLabel && !labelAssigned;

      const directTerminal: DendriteBranch = {
        id: `direct-terminal-${i}`,
        points: directPath,
        depth: 2,
        widthStart: 0.55,
        widthEnd: 0.3,
        alpha: 0.3,
        children: [],
        labelId: shouldHaveDirectLabel ? assignedLabel : undefined,
      };

      if (shouldHaveDirectLabel && assignedLabel) {
        labelAssigned = true;
        const tip = directPath[directPath.length - 1];
        labelPositions.set(assignedLabel, { x: tip.x, y: tip.y });
      }

      primaryBranch.children.push(directTerminal);
      allBranches.push(directTerminal);
    }

    allBranches.push(primaryBranch);
  }

  return { allBranches, labelPositions };
}

/**
 * Flatten tree to get all branch paths for rendering
 */
function getAllBranchPaths(branches: DendriteBranch[]): DendriteBranch[] {
  const paths: DendriteBranch[] = [];

  function traverse(branch: DendriteBranch) {
    paths.push(branch);
    for (const child of branch.children) {
      traverse(child);
    }
  }

  for (const branch of branches) {
    traverse(branch);
  }

  return paths;
}

/**
 * Get branch path from root to a specific label
 */
function getBranchPathToLabel(
  branches: DendriteBranch[],
  labelId: string
): DendriteBranch[] {
  const path: DendriteBranch[] = [];

  function findPath(branch: DendriteBranch, currentPath: DendriteBranch[]): boolean {
    const newPath = [...currentPath, branch];

    if (branch.labelId === labelId) {
      path.push(...newPath);
      return true;
    }

    for (const child of branch.children) {
      if (findPath(child, newPath)) {
        return true;
      }
    }

    return false;
  }

  for (const branch of branches) {
    if (branch.depth === 0) { // Start from primary branches
      if (findPath(branch, [])) {
        break;
      }
    }
  }

  return path;
}

/**
 * Minimal Dendrite Homepage
 *
 * A single elegant dendritic neuron filling 65-80% of viewport
 * with navigation labels attached to terminal branch tips.
 */
export function MinimalDendriteHome() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>(INITIAL_DIMENSIONS);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isMeasured = dimensions.width > 0 && dimensions.height > 0;

  // Generate dendritic tree
  const { branches, labelPositions, somaCenter, somaRadius, highlightedBranches } = useMemo(() => {
    if (dimensions.width === 0) {
      return {
        branches: [],
        labelPositions: new Map<string, Vec2>(),
        somaCenter: { x: 0, y: 0 },
        somaRadius: 20,
        highlightedBranches: new Set<string>(),
      };
    }

    // Soma position - slightly above center
    const somaCenter: Vec2 = {
      x: dimensions.width * 0.48,
      y: dimensions.height * 0.42,
    };
    const somaRadius = 18;

    const labelIds = NAV_LABELS.map(l => l.id);
    const { allBranches, labelPositions } = generateDendriticTree(
      somaCenter,
      dimensions.width,
      dimensions.height,
      'dendrite-tree-v5',
      labelIds
    );

    // Get branches that lead to hovered label
    const highlightedBranches = new Set<string>();
    if (hoveredId) {
      const pathToLabel = getBranchPathToLabel(allBranches.filter(b => b.depth === 0), hoveredId);
      for (const branch of pathToLabel) {
        highlightedBranches.add(branch.id);
      }
    }

    return { branches: allBranches, labelPositions, somaCenter, somaRadius, highlightedBranches };
  }, [dimensions, hoveredId]);

  // Handle resize
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    let active = true;
    const updateDimensions = () => {
      if (!active) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!active) return;
        const next = getStableViewportDimensions(container);
        if (next.width === 0 || next.height === 0) return;

        setDimensions((current) => {
          if (current.width === next.width && current.height === next.height) {
            return current;
          }

          return next;
        });
      });
    };

    updateDimensions();
    requestAnimationFrame(updateDimensions);

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);
    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);
    window.visualViewport?.addEventListener('resize', updateDimensions);

    document.fonts?.ready.then(updateDimensions).catch(() => undefined);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
      window.visualViewport?.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, VISUAL_LIMITS.dprCap);
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Clear with background
    ctx.fillStyle = ATLAS_PALETTE.background;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Sort branches by depth (draw deeper/terminal branches first, then primary on top)
    const sortedBranches = [...branches].sort((a, b) => b.depth - a.depth);

    // Draw branches
    for (const branch of sortedBranches) {
      if (branch.points.length < 2) continue;

      const isHighlighted = highlightedBranches.has(branch.id);
      const isDimmed = hoveredId && !isHighlighted;

      // Draw tapered path
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < branch.points.length - 1; i++) {
        const t = i / (branch.points.length - 1);
        const width = branch.widthStart + (branch.widthEnd - branch.widthStart) * t;

        let alpha = branch.alpha;
        if (isHighlighted) {
          alpha = Math.min(0.95, alpha * 1.8);
        } else if (isDimmed) {
          alpha = alpha * 0.4;
        }

        const p1 = branch.points[i];
        const p2 = branch.points[i + 1];

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        if (isHighlighted) {
          ctx.strokeStyle = `rgba(120, 245, 255, ${alpha})`;
        } else {
          // Color based on depth
          if (branch.depth === 0) {
            ctx.strokeStyle = `rgba(205, 225, 220, ${alpha})`;
          } else if (branch.depth === 1) {
            ctx.strokeStyle = `rgba(165, 200, 210, ${alpha})`;
          } else {
            ctx.strokeStyle = `rgba(155, 160, 200, ${alpha})`;
          }
        }

        ctx.lineWidth = width;
        ctx.stroke();
      }

      // Draw terminal dot for labeled branches
      if (branch.labelId) {
        const tip = branch.points[branch.points.length - 1];
        const label = NAV_LABELS.find(l => l.id === branch.labelId);
        const dotRadius = isHighlighted ? 4 : 3;

        ctx.beginPath();
        ctx.arc(tip.x, tip.y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = label?.color || '#ffffff';
        ctx.globalAlpha = isHighlighted ? 0.9 : isDimmed ? 0.3 : 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Quiet central convergence: the soma itself is rendered as an SVG overlay
    // so it can stay thin, irregular, and free of canvas glow.
    ctx.beginPath();
    ctx.arc(somaCenter.x, somaCenter.y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = hoveredId ? 'rgba(224, 236, 235, 0.72)' : 'rgba(205, 222, 222, 0.52)';
    ctx.fill();

  }, [dimensions, branches, somaCenter, somaRadius, hoveredId, highlightedBranches]);

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden bg-[#020306]" data-home-dendrite="original-six">
      {/* Canvas layer */}
      <canvas ref={canvasRef} className="absolute inset-0" data-home-dendrite-canvas aria-hidden="true" />

      {/* Navigation labels - attached to branch tips */}
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${isMeasured ? 'opacity-100' : 'opacity-0'}`}>
        {NAV_LABELS.map((navLabel) => {
          const pos = labelPositions.get(navLabel.id);
          if (!pos) return null;

          const isHovered = hoveredId === navLabel.id;

          // Calculate label offset based on position relative to soma
          const offsetX = pos.x > somaCenter.x ? 16 : -16;
          const offsetY = pos.y > somaCenter.y ? 20 : -20;
          const translateX = pos.x > somaCenter.x ? '0%' : '-100%';

          return (
            <Link
              key={navLabel.id}
              href={navLabel.href}
              data-gesture-target
              data-home-dendrite-label={navLabel.id}
              className={`
                pointer-events-auto absolute transform
                whitespace-nowrap border px-2 py-1
                font-mono text-[10px] uppercase tracking-[0.12em]
                transition-all duration-200
                ${isHovered
                  ? 'border-cyan-400/40 bg-black/80 text-cyan-300 shadow-lg shadow-cyan-500/20'
                  : 'border-white/10 bg-black/50 text-white/65 hover:border-white/25 hover:text-white/90'
                }
              `}
              style={{
                left: pos.x + offsetX,
                top: pos.y + offsetY,
                transform: `translateX(${translateX})`,
              }}
              onMouseEnter={() => setHoveredId(navLabel.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {navLabel.label}
            </Link>
          );
        })}
      </div>

      {/* Hexagonal soma junction */}
      {isMeasured && (
        <svg
          className="pointer-events-none absolute overflow-visible"
          aria-hidden="true"
          data-home-soma
          style={{
            left: somaCenter.x - somaRadius * 1.5,
            top: somaCenter.y - somaRadius * 1.3,
            width: somaRadius * 3,
            height: somaRadius * 2.6,
          }}
          viewBox="0 0 60 52"
        >
          <polygon
            points="30 5.5 48.5 16.5 48.5 36.5 30 47 11.5 36.5 11.5 16.5"
            fill={hoveredId ? 'rgba(102, 227, 255, 0.09)' : 'rgba(255, 255, 255, 0.035)'}
            stroke={hoveredId ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.18)'}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M18.5 16.6 L30 10.2 L41.5 16.6"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="0.7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {/* Core label near soma */}
      {isMeasured && (
        <Link
          href="/about"
          data-gesture-target
          data-home-core
          className={`
          pointer-events-auto absolute transform -translate-x-1/2
          whitespace-nowrap border px-3 py-1.5
          font-mono text-[11px] uppercase tracking-[0.14em]
          transition-all duration-200
          ${hoveredId === 'identity'
            ? 'border-white/30 bg-black/70 text-white'
            : 'border-white/15 bg-black/40 text-white/80 hover:border-white/25 hover:text-white'
          }
        `}
        style={{
          left: somaCenter.x,
          top: somaCenter.y + somaRadius + 28,
        }}
        onMouseEnter={() => setHoveredId('identity')}
        onMouseLeave={() => setHoveredId(null)}
      >
        {IDENTITY_LABEL}
        </Link>
      )}

      {/* Title and tagline - bottom center */}
      <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 transform text-center sm:bottom-12">
        <h1 className="font-mono text-2xl font-light tracking-[0.3em] text-white/90 sm:text-3xl">
          SIDHARTH HULYALKAR
        </h1>
        <p className="mt-3 max-w-[92vw] font-mono text-[9px] uppercase tracking-[0.12em] text-white/50 sm:whitespace-nowrap sm:text-[10px]">
          NEURAL DATA SYSTEMS | MULTIMODAL FOUNDATION MODELING &amp; INTERPRETABILITY | SCIENTIFIC SOFTWARE
        </p>
      </div>
    </div>
  );
}
