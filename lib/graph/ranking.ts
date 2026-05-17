import type { NeuralNode } from '@/lib/data/schemas';

/**
 * Compute the importance score for a node
 * This determines graph node size, homepage visibility, and sort order
 */
export function computeNodeImportance(node: NeuralNode): number {
  let score = 0;

  // Base importance from manual curation (0-100)
  score += node.importance ?? 50;

  // Recent work should float upward (0-20 points)
  score += (node.recencyScore ?? 50) * 0.2;

  // Type bonuses
  if (node.type === 'publication') score += 25;
  if (node.type === 'case-study') score += 25;
  if (node.type === 'role') score += 15;

  // Tag bonuses for priority areas
  const tags = node.tags.map((t) => t.toLowerCase());
  const domains = node.domains.map((d) => d.toLowerCase());

  // DataJoint ecosystem
  if (tags.includes('datajoint') || domains.includes('neural data infrastructure')) {
    score += 20;
  }

  // Major employers/deployments
  if (tags.includes('harvard') || tags.includes('sabatini')) score += 15;
  if (tags.includes('allen institute') || tags.includes('mindscope')) score += 15;
  if (tags.includes('panoptic bio')) score += 15;

  // Research priorities
  if (tags.includes('neurofmx') || tags.includes('neuros')) score += 18;
  if (
    tags.includes('mechanistic-interpretability') ||
    tags.includes('mechanistic interpretability')
  ) {
    score += 15;
  }
  if (tags.includes('bci') || tags.includes('brain-computer interface')) {
    score += 15;
  }
  if (tags.includes('neatlabs')) score += 12;

  // Publications from NEATLABs
  if (node.type === 'publication' && tags.includes('neatlabs')) {
    score += 10;
  }

  // GitHub stats add mild signal
  if (node.github?.stars) {
    score += Math.min(node.github.stars * 2, 20);
  }

  // Forks are generally lower priority unless DataJoint
  if (node.github?.isFork) {
    score -= 10;
    // But DataJoint forks can be meaningful
    if (tags.includes('datajoint')) score += 15;
  }

  // Featured flag
  if (node.featured) score += 10;

  // Ensure score is within bounds
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get visual weight for a node based on importance
 * Returns 1-10 scale for node sizing
 */
export function getVisualWeight(importance: number): number {
  if (importance >= 95) return 10;
  if (importance >= 85) return 8;
  if (importance >= 75) return 7;
  if (importance >= 65) return 6;
  if (importance >= 55) return 5;
  if (importance >= 45) return 4;
  if (importance >= 35) return 3;
  if (importance >= 25) return 2;
  return 1;
}

/**
 * Get node radius for graph visualization
 */
export function getNodeRadius(importance: number): number {
  return 8 + importance * 0.22;
}

/**
 * Get node opacity for graph visualization
 */
export function getNodeOpacity(importance: number): number {
  return 0.35 + importance / 160;
}

/**
 * Determine if node should have glow effect
 */
export function shouldGlow(importance: number): boolean {
  return importance > 80;
}

/**
 * Sort nodes by importance (descending)
 */
export function sortByImportance(nodes: NeuralNode[]): NeuralNode[] {
  return [...nodes].sort((a, b) => {
    const aScore = a.computedImportance ?? computeNodeImportance(a);
    const bScore = b.computedImportance ?? computeNodeImportance(b);
    return bScore - aScore;
  });
}

/**
 * Filter nodes by view mode
 */
export function filterByMode(
  nodes: NeuralNode[],
  mode: 'recruiter' | 'researcher' | 'builder' | 'full-brain' | 'personal'
): NeuralNode[] {
  if (mode === 'full-brain') return nodes;

  return nodes.filter((node) => {
    // Always show nodes explicitly marked for this mode
    if (node.modeVisibility.includes(mode)) return true;

    // Mode-specific filtering
    switch (mode) {
      case 'recruiter':
        // Show professional, high-importance nodes
        return (
          (node.computedImportance ?? node.importance) >= 70 &&
          ['project', 'role', 'publication', 'case-study', 'organization'].includes(
            node.type
          )
        );

      case 'researcher':
        // Show research-related nodes
        return (
          node.type === 'publication' ||
          node.domains.some((d) =>
            ['NEATLABs Research', 'Neural Signal Discovery', 'Publications'].includes(d)
          ) ||
          node.tags.some((t) =>
            ['neuroscience', 'research', 'publication', 'lfp', 'neural-decoding'].includes(
              t.toLowerCase()
            )
          )
        );

      case 'builder':
        // Show infrastructure and tools
        return (
          node.domains.some((d) =>
            [
              'Scientific DevOps',
              'Scientific Workflow Systems',
              'Neural Data Infrastructure',
            ].includes(d)
          ) ||
          node.tags.some((t) =>
            [
              'infrastructure',
              'docker',
              'aws',
              'monitoring',
              'real-time',
              'hardware',
            ].includes(t.toLowerCase())
          )
        );

      case 'personal':
        // Show personal interests
        return (
          node.type === 'personal-interest' ||
          node.domains.includes('Life Outside the Lab') ||
          node.tags.some((t) =>
            ['shasta', 'adventure', 'sports', 'gaming', 'food', 'personal'].includes(
              t.toLowerCase()
            )
          )
        );

      default:
        return true;
    }
  });
}
