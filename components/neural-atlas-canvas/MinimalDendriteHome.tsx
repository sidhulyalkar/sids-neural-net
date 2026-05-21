'use client';

import { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { VISUAL_LIMITS, ATLAS_PALETTE } from './visualLimits';

type Vec2 = { x: number; y: number };
type Dimensions = { width: number; height: number };
type Rect = { x: number; y: number; width: number; height: number };
type LabelPlacement = Vec2 & Dimensions;

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
const EDGE_MARGIN_MIN = 28;
const EDGE_MARGIN_MAX = 72;
const TWO_PI = Math.PI * 2;
const PRIMARY_ANGLE_OFFSET = -Math.PI / 2;
const PRIMARY_ENDPOINT_LABELS = new Set(NAV_LABELS.map((label) => label.id));
const NEURAL_CODE_TEXT: CSSProperties = {
  fontFamily:
    '"Roboto Mono", "IBM Plex Mono", "Berkeley Mono", "Aptos Mono", "Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", var(--font-geist-mono), monospace',
  fontFeatureSettings: '"zero" 1, "ss02" 1, "calt" 1',
  textRendering: 'geometricPrecision',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getEdgeMargin(width: number, height: number): number {
  return clamp(Math.min(width, height) * 0.045, EDGE_MARGIN_MIN, EDGE_MARGIN_MAX);
}

function getTitleBandHeight(height: number): number {
  return clamp(height * 0.18, 150, 240);
}

function distanceToInsetEdge(
  start: Vec2,
  angle: number,
  width: number,
  height: number,
  margin: number
): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const distances: number[] = [];

  if (Math.abs(dx) > 0.0001) {
    distances.push(((dx > 0 ? width - margin : margin) - start.x) / dx);
  }

  if (Math.abs(dy) > 0.0001) {
    distances.push(((dy > 0 ? height - margin : margin) - start.y) / dy);
  }

  const positiveDistances = distances.filter((distance) => Number.isFinite(distance) && distance > 0);

  return positiveDistances.length > 0 ? Math.min(...positiveDistances) : 0;
}

function containPoint(point: Vec2, width: number, height: number, margin: number, maxY = height - margin): Vec2 {
  const bottom = Math.max(margin, maxY);

  return {
    x: clamp(point.x, margin, width - margin),
    y: clamp(point.y, margin, bottom),
  };
}

function containPath(
  points: Vec2[],
  width: number,
  height: number,
  margin: number,
  maxY = height - margin
): Vec2[] {
  return points.map((point) => containPoint(point, width, height, margin, maxY));
}

function distanceBetween(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToRect(point: Vec2, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));

  return Math.sqrt(dx * dx + dy * dy);
}

function distanceBetweenRects(a: Rect, b: Rect): number {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);

  return Math.sqrt(dx * dx + dy * dy);
}

function estimateLabelSize(label: string): Dimensions {
  return {
    width: Math.max(76, label.length * 9.5 + 30),
    height: 36,
  };
}

function getCompactLabelPlacement(
  labelId: string,
  label: string,
  dimensions: Dimensions,
  titleBandHeight: number
): LabelPlacement {
  const size = estimateLabelSize(label);
  const labelOrder = ['projects', 'publications', 'work', 'photography', 'ideas', 'contact'];
  const index = Math.max(0, labelOrder.indexOf(labelId));
  const top = clamp(dimensions.height * 0.10, 56, 90);
  const bottom = Math.max(top + size.height, dimensions.height - titleBandHeight - size.height - 16);

  // Ensure minimum spacing between labels (at least label height + 8px padding)
  const minRowGap = size.height + 8;
  const availableSpace = bottom - top;
  const requiredSpace = minRowGap * (labelOrder.length - 1);

  // If not enough space, use a two-column layout with staggered positions
  const useTwoColumns = availableSpace < requiredSpace;

  if (useTwoColumns) {
    // Split into left column (even indices) and right column (odd indices)
    const isRightColumn = index % 2 === 1;
    const columnIndex = Math.floor(index / 2);
    const itemsPerColumn = Math.ceil(labelOrder.length / 2);
    const columnGap = Math.max(minRowGap, (bottom - top) / Math.max(1, itemsPerColumn - 1));
    const maxX = Math.max(16, dimensions.width - size.width - 16);

    return {
      x: isRightColumn ? maxX : 16,
      y: clamp(top + columnGap * columnIndex, 18, bottom),
      ...size,
    };
  }

  // Standard single-column staggered layout with adequate spacing
  const rowGap = Math.max(minRowGap, availableSpace / (labelOrder.length - 1));
  const maxX = Math.max(16, dimensions.width - size.width - 16);
  const rightSide = index % 2 === 1;

  return {
    x: rightSide ? maxX : 16,
    y: clamp(top + rowGap * index, 18, bottom),
    ...size,
  };
}

function getOpenLabelPlacement(
  node: Vec2,
  label: string,
  somaCenter: Vec2,
  dimensions: Dimensions,
  titleBandHeight: number,
  branchPoints: Vec2[],
  occupiedRects: Rect[] = []
): LabelPlacement {
  const size = estimateLabelSize(label);
  const dx = node.x - somaCenter.x;
  const dy = node.y - somaCenter.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const dir = { x: dx / length, y: dy / length };
  const sideX = dir.x >= 0 ? 1 : -1;
  const sideY = dir.y >= 0 ? 1 : -1;
  const maxY = Math.max(24, dimensions.height - titleBandHeight - size.height - 22);
  const minX = 18;
  const maxX = Math.max(minX, dimensions.width - size.width - 18);
  const gap = 34;

  const candidates: Vec2[] = [
    {
      x: node.x + sideX * gap + (sideX < 0 ? -size.width : 0),
      y: node.y + sideY * 12 - size.height / 2,
    },
    {
      x: node.x + sideX * (gap + 12) + (sideX < 0 ? -size.width : 0),
      y: node.y - size.height / 2,
    },
    {
      x: node.x - size.width / 2,
      y: node.y + sideY * (gap + 4) + (sideY < 0 ? -size.height : 0),
    },
    {
      x: node.x + sideX * (gap + 22) + (sideX < 0 ? -size.width : 0),
      y: node.y - sideY * (gap + size.height / 2),
    },
  ].map((candidate) => ({
    x: clamp(candidate.x, minX, maxX),
    y: clamp(candidate.y, 22, maxY),
  }));

  let best = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const rect: Rect = { ...candidate, ...size };
    const nearbyPenalty = branchPoints.reduce((score, point) => {
      const distance = distanceToRect(point, rect);
      if (distance > 48) return score;

      return score + (48 - distance);
    }, 0);
    const nodeDistance = distanceToRect(node, rect);
    const targetGapPenalty = Math.abs(nodeDistance - 24);
    const labelPenalty = occupiedRects.reduce((score, occupiedRect) => {
      const distance = distanceBetweenRects(rect, occupiedRect);
      if (distance > 42) return score;

      return score + (42 - distance) * 2.5;
    }, 0);
    const titlePenalty = candidate.y > maxY - 4 ? 80 : 0;
    const score = -nearbyPenalty - labelPenalty - targetGapPenalty - titlePenalty;

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return { ...best, ...size };
}

function circularSlotDistance(a: number, b: number, count: number): number {
  const diff = Math.abs(a - b);

  return Math.min(diff, count - diff);
}

function normalizeAngle(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function angleToSlot(angle: number, primaryCount: number): number {
  return Math.round((normalizeAngle(angle - PRIMARY_ANGLE_OFFSET) / TWO_PI) * primaryCount) % primaryCount;
}

function preferredSlotForLabel(labelId: string, primaryCount: number): number {
  const preferredAngles: Record<string, number> = {
    projects: -Math.PI / 6,
    publications: -Math.PI / 2,
    work: (-5 * Math.PI) / 6,
    contact: Math.PI,
    ideas: Math.PI / 3,
    photography: (2 * Math.PI) / 3,
  };

  return angleToSlot(preferredAngles[labelId] ?? 0, primaryCount);
}

function distributeLabelsAcrossPrimaryBranches(labelIds: string[], primaryCount: number): (string | null)[] {
  const labelsPerPrimary: (string | null)[] = Array.from({ length: primaryCount }, () => null);
  const usedSlots: number[] = [];

  for (const labelId of labelIds) {
    const targetSlot = preferredSlotForLabel(labelId, primaryCount);
    let bestSlot = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let candidate = 0; candidate < primaryCount; candidate++) {
      if (labelsPerPrimary[candidate]) continue;

      const nearestUsedDistance =
        usedSlots.length === 0
          ? primaryCount
          : Math.min(
              ...usedSlots.map((slot) => circularSlotDistance(candidate, slot, primaryCount))
            );
      const targetDistance = circularSlotDistance(candidate, targetSlot, primaryCount);
      const score = nearestUsedDistance * 100 - targetDistance;

      if (score > bestScore) {
        bestScore = score;
        bestSlot = candidate;
      }
    }

    labelsPerPrimary[bestSlot] = labelId;
    usedSlots.push(bestSlot);
  }

  return labelsPerPrimary;
}

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

  const edgeMargin = getEdgeMargin(viewportWidth, viewportHeight);
  const viewportArea = viewportWidth * viewportHeight;
  const wideViewport = viewportWidth / Math.max(viewportHeight, 1) > 1.75;
  const largeViewport = viewportArea > 1_900_000;
  const labelCeiling = viewportHeight - getTitleBandHeight(viewportHeight) - 8;
  const treeBottomCenter = labelCeiling + 70; // Restricted in center where footer text is
  const treeBottomEdge = viewportHeight - 12; // Very permissive on sides
  const treeEdgeMargin = Math.max(12, edgeMargin * 0.4); // More permissive edge margin for branches

  // Footer text is centered with max-width of min(92vw, 96rem)
  const footerHalfWidth = Math.min(viewportWidth * 0.46, 768); // Half of footer width
  const viewportCenterX = viewportWidth / 2;

  // Dynamic bottom boundary - permissive on sides, restricted in center
  const getTreeBottom = (x: number): number => {
    const distFromCenter = Math.abs(x - viewportCenterX);
    if (distFromCenter > footerHalfWidth) {
      return treeBottomEdge; // Far from center - allow to go near bottom
    }
    // Smooth transition from center to edge
    const t = distFromCenter / footerHalfWidth;
    return treeBottomCenter + (treeBottomEdge - treeBottomCenter) * t * t;
  };
  const minInterLabelDistance = clamp(Math.min(viewportWidth, viewportHeight) * 0.18, 140, 260);
  const hasLabelRoom = (point: Vec2, relaxedMultiplier = 1) =>
    [...labelPositions.values()].every(
      (existingPosition) =>
        distanceBetween(point, existingPosition) >= minInterLabelDistance * relaxedMultiplier
  );

  const primaryCount = wideViewport ? 10 : largeViewport ? 8 : 6;
  const labelsPerPrimary = distributeLabelsAcrossPrimaryBranches(labelIds, primaryCount);

  for (let i = 0; i < primaryCount; i++) {
    // Irregular angular distribution
    const baseAngle = PRIMARY_ANGLE_OFFSET + (i / primaryCount) * TWO_PI + (rng() - 0.5) * 0.4;
    const assignedLabel = labelsPerPrimary[i];
    const usePrimaryEndpointForLabel = Boolean(
      assignedLabel && PRIMARY_ENDPOINT_LABELS.has(assignedLabel)
    );

    // Generate primary dendrite
    const edgeDistance = distanceToInsetEdge(
      somaCenter,
      baseAngle,
      viewportWidth,
      viewportHeight,
      edgeMargin
    );
    const reachMin = wideViewport ? 0.48 : 0.42;
    const reachMax = wideViewport ? 0.22 : 0.18;
    const primaryLength = edgeDistance * (reachMin + rng() * reachMax);
    const minLabelDistance = primaryLength * 0.78;
    const rawPrimaryEnd = {
      x: somaCenter.x + Math.cos(baseAngle) * primaryLength,
      y: somaCenter.y + Math.sin(baseAngle) * primaryLength,
    };
    const primaryEnd = containPoint(rawPrimaryEnd, viewportWidth, viewportHeight, edgeMargin, getTreeBottom(rawPrimaryEnd.x));

    const primaryPath = containPath(
      generateOrganicPath(somaCenter, primaryEnd, rng, wideViewport ? 12 : 10, 0.08),
      viewportWidth,
      viewportHeight,
      edgeMargin,
      getTreeBottom(primaryEnd.x)
    );

    const primaryBranch: DendriteBranch = {
      id: `primary-${i}`,
      points: primaryPath,
      depth: 0,
      widthStart: 2.35 + rng() * 0.28,
      widthEnd: 1.35 + rng() * 0.22,
      alpha: 0.65 + rng() * 0.1,
      children: [],
    };

    // Secondary branches from primary (2-4 per primary)
    const secondaryCount = (wideViewport ? 3 : 2) + Math.floor(rng() * (wideViewport ? 4 : 3));
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

      const secondaryLength = primaryLength * (0.26 + rng() * 0.24);
      const rawSecondaryEnd = {
        x: branchStart.x + Math.cos(branchAngle) * secondaryLength,
        y: branchStart.y + Math.sin(branchAngle) * secondaryLength,
      };
      const secondaryEnd = containPoint(rawSecondaryEnd, viewportWidth, viewportHeight, edgeMargin, getTreeBottom(rawSecondaryEnd.x));

      const secondaryPath = containPath(
        generateOrganicPath(branchStart, secondaryEnd, rng, 7, 0.12),
        viewportWidth,
        viewportHeight,
        edgeMargin,
        getTreeBottom(secondaryEnd.x)
      );

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
      const terminalCount = 1 + Math.floor(rng() * (wideViewport ? 4 : 3));

      for (let k = 0; k < terminalCount; k++) {
        const twigT = 0.5 + rng() * 0.45;
        const twigIndex = Math.floor(twigT * (secondaryPath.length - 1));
        const twigStart = secondaryPath[twigIndex];

        const secondaryDir = Math.atan2(
          secondaryPath[twigIndex + 1]?.y - twigStart.y || 0,
          secondaryPath[twigIndex + 1]?.x - twigStart.x || 1
        );
        const twigAngle = secondaryDir + (rng() > 0.5 ? 1 : -1) * (0.35 + rng() * 0.45);

        const twigLength = secondaryLength * (0.24 + rng() * 0.26);
        const rawSecTwigEnd = {
          x: twigStart.x + Math.cos(twigAngle) * twigLength,
          y: twigStart.y + Math.sin(twigAngle) * twigLength,
        };
        const twigEnd = containPoint(rawSecTwigEnd, viewportWidth, viewportHeight, edgeMargin, getTreeBottom(rawSecTwigEnd.x));

        const twigPath = containPath(
          generateOrganicPath(twigStart, twigEnd, rng, 5, 0.18),
          viewportWidth,
          viewportHeight,
          edgeMargin,
          getTreeBottom(twigEnd.x)
        );

        const tip = twigPath[twigPath.length - 1];
        const tipIsFarEnough = distanceBetween(tip, somaCenter) >= minLabelDistance;
        const shouldHaveLabel = Boolean(
          assignedLabel &&
          !labelAssigned &&
          !usePrimaryEndpointForLabel &&
          tipIsFarEnough &&
          tip.y <= labelCeiling &&
          hasLabelRoom(tip) &&
          (k === terminalCount - 1 || rng() > 0.6)
        );

        const terminalBranch: DendriteBranch = {
          id: `terminal-${i}-${j}-${k}`,
          points: twigPath,
          depth: 2,
          widthStart: 0.6 + rng() * 0.15,
          widthEnd: 0.35 + rng() * 0.1,
          alpha: 0.32 + rng() * 0.12,
          children: [],
          labelId: (shouldHaveLabel && assignedLabel) || undefined,
        };

        if (shouldHaveLabel && assignedLabel) {
          labelAssigned = true;
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

        const endTwigLength = secondaryLength * 0.22;
        const rawEndTwigEndSec = {
          x: secondaryEnd.x + Math.cos(endTwigAngle) * endTwigLength,
          y: secondaryEnd.y + Math.sin(endTwigAngle) * endTwigLength,
        };
        const endTwigEnd = containPoint(rawEndTwigEndSec, viewportWidth, viewportHeight, edgeMargin, getTreeBottom(rawEndTwigEndSec.x));

        const endTwigPath = containPath(
          generateOrganicPath(secondaryEnd, endTwigEnd, rng, 4, 0.2),
          viewportWidth,
          viewportHeight,
          edgeMargin,
          getTreeBottom(endTwigEnd.x)
        );

        const endTip = endTwigPath[endTwigPath.length - 1];
        const shouldHaveEndLabel = Boolean(
          assignedLabel &&
          !labelAssigned &&
          !usePrimaryEndpointForLabel &&
          distanceBetween(endTip, somaCenter) >= minLabelDistance &&
          endTip.y <= labelCeiling &&
          hasLabelRoom(endTip)
        );

        const endTerminal: DendriteBranch = {
          id: `end-terminal-${i}-${j}`,
          points: endTwigPath,
          depth: 2,
          widthStart: 0.5,
          widthEnd: 0.3,
          alpha: 0.28,
          children: [],
          labelId: (shouldHaveEndLabel && assignedLabel) || undefined,
        };

        if (shouldHaveEndLabel && assignedLabel) {
          labelAssigned = true;
          labelPositions.set(assignedLabel, { x: endTip.x, y: endTip.y });
        }

        secondaryBranch.children.push(endTerminal);
        allBranches.push(endTerminal);
      }

      primaryBranch.children.push(secondaryBranch);
      allBranches.push(secondaryBranch);
    }

    // Create tree-like terminal branching at the end of primary dendrites
    const endSprayCount = 3 + Math.floor(rng() * (wideViewport ? 4 : 3));
    for (let sprayIndex = 0; sprayIndex < endSprayCount; sprayIndex++) {
      const side = sprayIndex % 2 === 0 ? 1 : -1;
      // Wider fan angle for more spread-out tree shape
      const fan = 0.32 + sprayIndex * 0.18 + rng() * 0.22;
      const sprayAngle = baseAngle + side * fan + (rng() - 0.5) * 0.15;
      // Longer primary spray branches
      const sprayLength = primaryLength * (0.18 + rng() * 0.16);
      const rawSprayEnd = {
        x: primaryEnd.x + Math.cos(sprayAngle) * sprayLength,
        y: primaryEnd.y + Math.sin(sprayAngle) * sprayLength,
      };
      const sprayEnd = containPoint(rawSprayEnd, viewportWidth, viewportHeight, treeEdgeMargin, getTreeBottom(rawSprayEnd.x));

      const sprayPath = containPath(
        generateOrganicPath(primaryEnd, sprayEnd, rng, 5, 0.14),
        viewportWidth,
        viewportHeight,
        treeEdgeMargin,
        getTreeBottom(sprayEnd.x)
      );

      const sprayBranch: DendriteBranch = {
        id: `primary-end-spray-${i}-${sprayIndex}`,
        points: sprayPath,
        depth: 2,
        widthStart: 0.7 + rng() * 0.15,
        widthEnd: 0.4 + rng() * 0.1,
        alpha: 0.32 + rng() * 0.1,
        children: [],
      };

      // Add sub-branches to each spray for tree-like appearance
      const subBranchCount = 2 + Math.floor(rng() * 3);
      for (let subIdx = 0; subIdx < subBranchCount; subIdx++) {
        // Branch off from different points along the spray
        const branchT = 0.4 + rng() * 0.5;
        const branchPointIdx = Math.floor(branchT * (sprayPath.length - 1));
        const branchStart = sprayPath[branchPointIdx];

        // Diverge from spray direction
        const sprayDir = Math.atan2(
          sprayPath[Math.min(branchPointIdx + 1, sprayPath.length - 1)].y - branchStart.y,
          sprayPath[Math.min(branchPointIdx + 1, sprayPath.length - 1)].x - branchStart.x
        );
        const subAngle = sprayDir + (rng() > 0.5 ? 1 : -1) * (0.4 + rng() * 0.5);
        const subLength = sprayLength * (0.35 + rng() * 0.3);

        const rawSubEnd = {
          x: branchStart.x + Math.cos(subAngle) * subLength,
          y: branchStart.y + Math.sin(subAngle) * subLength,
        };
        const subEnd = containPoint(rawSubEnd, viewportWidth, viewportHeight, treeEdgeMargin, getTreeBottom(rawSubEnd.x));

        const subPath = containPath(
          generateOrganicPath(branchStart, subEnd, rng, 4, 0.2),
          viewportWidth,
          viewportHeight,
          treeEdgeMargin,
          getTreeBottom(subEnd.x)
        );

        const subBranch: DendriteBranch = {
          id: `primary-end-sub-${i}-${sprayIndex}-${subIdx}`,
          points: subPath,
          depth: 3,
          widthStart: 0.45 + rng() * 0.1,
          widthEnd: 0.2 + rng() * 0.08,
          alpha: 0.24 + rng() * 0.08,
          children: [],
        };

        // Add tiny terminal twigs at the end of sub-branches
        if (rng() > 0.4) {
          const twigCount = 1 + Math.floor(rng() * 2);
          for (let twigIdx = 0; twigIdx < twigCount; twigIdx++) {
            const twigAngle = subAngle + (rng() - 0.5) * 1.2;
            const twigLength = subLength * (0.3 + rng() * 0.25);
            const rawTwigEnd = {
              x: subEnd.x + Math.cos(twigAngle) * twigLength,
              y: subEnd.y + Math.sin(twigAngle) * twigLength,
            };
            const twigEnd = containPoint(rawTwigEnd, viewportWidth, viewportHeight, treeEdgeMargin, getTreeBottom(rawTwigEnd.x));

            const twigPath = containPath(
              generateOrganicPath(subEnd, twigEnd, rng, 3, 0.25),
              viewportWidth,
              viewportHeight,
              treeEdgeMargin,
              getTreeBottom(twigEnd.x)
            );

            const twig: DendriteBranch = {
              id: `primary-end-twig-${i}-${sprayIndex}-${subIdx}-${twigIdx}`,
              points: twigPath,
              depth: 4,
              widthStart: 0.28 + rng() * 0.08,
              widthEnd: 0.12 + rng() * 0.05,
              alpha: 0.18 + rng() * 0.06,
              children: [],
            };

            subBranch.children.push(twig);
            allBranches.push(twig);
          }
        }

        sprayBranch.children.push(subBranch);
        allBranches.push(subBranch);
      }

      // Also add small terminal twigs directly at spray end
      const endTwigCount = 2 + Math.floor(rng() * 2);
      for (let endTwigIdx = 0; endTwigIdx < endTwigCount; endTwigIdx++) {
        const twigSide = endTwigIdx % 2 === 0 ? 1 : -1;
        const twigFan = 0.3 + endTwigIdx * 0.25 + rng() * 0.2;
        const twigAngle = sprayAngle + twigSide * twigFan;
        const twigLength = sprayLength * (0.25 + rng() * 0.2);

        const rawEndTwigEnd = {
          x: sprayEnd.x + Math.cos(twigAngle) * twigLength,
          y: sprayEnd.y + Math.sin(twigAngle) * twigLength,
        };
        const twigEnd = containPoint(rawEndTwigEnd, viewportWidth, viewportHeight, treeEdgeMargin, getTreeBottom(rawEndTwigEnd.x));

        const twigPath = containPath(
          generateOrganicPath(sprayEnd, twigEnd, rng, 3, 0.22),
          viewportWidth,
          viewportHeight,
          treeEdgeMargin,
          getTreeBottom(twigEnd.x)
        );

        const endTwig: DendriteBranch = {
          id: `primary-spray-endtwig-${i}-${sprayIndex}-${endTwigIdx}`,
          points: twigPath,
          depth: 3,
          widthStart: 0.35 + rng() * 0.08,
          widthEnd: 0.15 + rng() * 0.05,
          alpha: 0.2 + rng() * 0.06,
          children: [],
        };

        sprayBranch.children.push(endTwig);
        allBranches.push(endTwig);
      }

      primaryBranch.children.push(sprayBranch);
      allBranches.push(sprayBranch);
    }

    if (assignedLabel && !labelAssigned) {
      const fallbackTip = primaryPath[primaryPath.length - 1];

      primaryBranch.labelId = assignedLabel;
      labelPositions.set(assignedLabel, { x: fallbackTip.x, y: fallbackTip.y });
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
  const titleBandHeight = isMeasured ? getTitleBandHeight(dimensions.height) : 180;

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

    // Soma position - balanced enough for edge-reaching branches and bottom title.
    const somaCenter: Vec2 = {
      x: dimensions.width * 0.5,
      y: dimensions.height * 0.45,
    };
    const somaRadius = clamp(Math.min(dimensions.width, dimensions.height) * 0.014, 16, 22);

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
  const branchPoints = useMemo(() => branches.flatMap((branch) => branch.points), [branches]);
  const labelPlacements = useMemo(() => {
    const placements = new Map<string, LabelPlacement>();
    const occupiedRects: Rect[] = [];
    const useCompactLabels = dimensions.width > 0 && dimensions.width < 640;

    for (const navLabel of NAV_LABELS) {
      const pos = labelPositions.get(navLabel.id);
      if (!pos && !useCompactLabels) continue;

      if (useCompactLabels) {
        placements.set(
          navLabel.id,
          getCompactLabelPlacement(navLabel.id, navLabel.label, dimensions, titleBandHeight)
        );
        continue;
      }

      const placement = getOpenLabelPlacement(
        pos as Vec2,
        navLabel.label,
        somaCenter,
        dimensions,
        titleBandHeight,
        branchPoints,
        occupiedRects
      );
      placements.set(navLabel.id, placement);
      occupiedRects.push(placement);
    }

    return placements;
  }, [branchPoints, dimensions, labelPositions, somaCenter, titleBandHeight]);

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
    <div ref={containerRef} className="fixed inset-0 overflow-hidden bg-[#020306]">
      {/* Canvas layer */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Navigation labels - attached to branch tips */}
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${isMeasured ? 'opacity-100' : 'opacity-0'}`}>
        {NAV_LABELS.map((navLabel) => {
          const isHovered = hoveredId === navLabel.id;
          const labelPlacement = labelPlacements.get(navLabel.id);
          if (!labelPlacement) return null;

          return (
            <Link
              key={navLabel.id}
              href={navLabel.href}
              className={`
                pointer-events-auto absolute transform
                whitespace-nowrap border px-3 py-1.5
                text-xs uppercase tracking-normal sm:text-sm lg:px-3.5 lg:py-2 lg:text-[15px]
                transition-all duration-200
                ${isHovered
                  ? 'border-cyan-400/40 bg-black/80 text-cyan-300 shadow-lg shadow-cyan-500/20'
                  : 'border-white/10 bg-black/50 text-white/65 hover:border-white/25 hover:text-white/90'
                }
              `}
              style={{
                ...NEURAL_CODE_TEXT,
                left: labelPlacement.x,
                top: labelPlacement.y,
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
            fill={hoveredId ? 'rgba(102, 227, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)'}
            stroke={hoveredId ? 'rgba(230, 252, 255, 0.56)' : 'rgba(235, 245, 240, 0.32)'}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M18.5 16.6 L30 10.2 L41.5 16.6"
            fill="none"
            stroke="rgba(255, 255, 255, 0.18)"
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
          className={`
          pointer-events-auto absolute transform -translate-x-1/2
          whitespace-nowrap border px-3 py-1.5
          text-xs uppercase tracking-normal sm:text-sm lg:px-4 lg:py-2 lg:text-[15px]
          transition-all duration-200
          ${hoveredId === 'identity'
            ? 'border-white/30 bg-black/70 text-white'
            : 'border-white/15 bg-black/40 text-white/80 hover:border-white/25 hover:text-white'
          }
        `}
        style={{
          ...NEURAL_CODE_TEXT,
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
      <div className="pointer-events-none absolute bottom-8 left-1/2 w-[min(92vw,96rem)] -translate-x-1/2 transform text-center sm:bottom-12 xl:bottom-16">
        <h1
          className="font-medium leading-tight tracking-normal text-white/95"
          style={{
            ...NEURAL_CODE_TEXT,
            fontSize: 'clamp(2rem, 2.7vw, 3.4rem)',
            textShadow: 'none',
          }}
        >
          SIDHARTH HULYALKAR
        </h1>
        <p
          className="mx-auto mt-3 max-w-[82rem] text-sm uppercase leading-relaxed tracking-normal text-white/60 sm:whitespace-nowrap lg:text-base 2xl:text-lg"
          style={NEURAL_CODE_TEXT}
        >
          NEURAL DATA SYSTEMS | MULTIMODAL FOUNDATION MODELING &amp; INTERPRETABILITY | SCIENTIFIC SOFTWARE
        </p>
      </div>
    </div>
  );
}
