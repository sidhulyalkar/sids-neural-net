/**
 * Strict Visual Limits for Neural Atlas
 *
 * The goal is a minimal, elegant dendritic landing page.
 * One beautiful neuron spread across the screen.
 */

export const VISUAL_LIMITS = {
  // Soma limits - compact anchors, not planets
  maxSomaRadius: 18,
  minSomaRadius: 10,
  maxIdentitySomaRadius: 16,
  maxOtherSomaRadius: 8,
  maxHaloRadius: 40,
  maxHaloOpacity: 0.08,

  // Branch limits - visible but elegant traces
  maxBranchWidth: 2.2,
  minBranchWidth: 0.35,
  maxTerminalTwigWidth: 0.5,
  maxAxonWidth: 1.2,

  // Segment budgets
  maxNavNodes: 7,
  maxPrimaryBranches: 8,
  maxChildBranchesPerPrimary: 4,
  maxGlyphSegmentsPerNode: 80,
  minGlyphSegmentsPerNode: 40,
  maxBackgroundSegments: 80,
  maxTractSegments: 60,
  maxTotalSegments: 140,

  // Performance
  dprCap: 1.5,
  enableHeavyGlow: false,
  enableBlurFilters: false,
} as const;

/**
 * Navigation Node Layout
 * Positioned as endpoints of dendritic branches
 */
export const NAV_LAYOUT = {
  // Central soma - the origin point
  identity: { x: -0.12, y: 0.08 },

  // Branch endpoints - distributed organically
  projects: { x: 0.42, y: -0.18 },       // Right-lower
  publications: { x: 0.28, y: 0.35 },    // Upper right
  photography: { x: -0.45, y: 0.22 },    // Left upper
  contact: { x: -0.35, y: -0.38 },       // Lower left
  ideas: { x: 0.15, y: 0.42 },           // Upper center-right
  work: { x: -0.22, y: -0.18 },          // Lower left-center
} as const;

/**
 * Color palette - elegant scientific tones with better visibility
 */
export const ATLAS_PALETTE = {
  background: '#020306',

  // Primary traces - visible but not harsh
  primaryTrace: 'rgba(210, 230, 225, 0.55)',
  secondaryTrace: 'rgba(120, 190, 220, 0.30)',
  activeTrace: 'rgba(125, 249, 255, 0.9)',

  // Soma colors
  somaFill: 'rgba(210, 220, 205, 0.22)',
  somaStroke: 'rgba(220, 245, 235, 0.7)',

  // Label colors
  labelBg: 'rgba(3, 6, 10, 0.78)',
  labelBorder: 'rgba(180, 220, 220, 0.26)',

  // Navigation node colors - more saturated for visibility
  identityColor: '#f0ebe3',
  projectsColor: '#7dd4e8',
  publicationsColor: '#c4a8e0',
  photographyColor: '#e0b0c4',
  contactColor: '#a8c4e0',
  ideasColor: '#b0e0a8',
  workColor: '#e0e4a8',

  // Tract/connection colors
  traceGray: '#4a4d52',
  traceCyan: '#5a7882',
  traceViolet: '#6a5878',
} as const;

/**
 * Layer opacities - more visible traces
 */
export const LAYER_ALPHA = {
  backgroundTissue: 0.15,
  backgroundTissueHover: 0.22,
  navGlyph: 0.55,
  navGlyphHover: 0.8,
  navGlyphActive: 0.92,
  tract: 0.35,
  tractHover: 0.55,
  soma: 0.75,
  somaActive: 0.95,
} as const;

export type VisualLimits = typeof VISUAL_LIMITS;
export type NavLayout = typeof NAV_LAYOUT;
