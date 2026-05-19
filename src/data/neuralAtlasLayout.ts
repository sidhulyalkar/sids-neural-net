/**
 * Safe neural atlas layout data.
 *
 * This is intentionally an irregular constellation:
 * - not every node connects directly to Core
 * - no single central node should dominate the graph
 * - labels should stay inside the viewport with modest padding
 * - anchors should remain tiny; soma radii are clamped elsewhere
 *
 * Claude can use this as a data-driven target when wiring renderer-side layout.
 */
export const neuralAtlasNavNodes = [
  { id: 'about', label: 'Core', x: -0.08, y: 0.05, isIdentity: true },
  { id: 'projects', label: 'Builds', x: 0.35, y: -0.28, isIdentity: false },
  { id: 'publications', label: 'Paper Archive', x: 0.32, y: 0.32, isIdentity: false },
  { id: 'photography', label: 'Visual Cortex', x: -0.38, y: 0.12, isIdentity: false },
  { id: 'contact', label: 'Contact', x: -0.28, y: -0.32, isIdentity: false },
  { id: 'research-ideas', label: 'Research Ideas', x: 0.08, y: 0.38, isIdentity: false },
  { id: 'professional-work', label: 'Deployed Systems', x: -0.18, y: -0.22, isIdentity: false },
] as const;

export const neuralAtlasTractConnections = [
  { from: 'about', to: 'projects' },
  { from: 'about', to: 'publications' },
  { from: 'projects', to: 'research-ideas' },
  { from: 'publications', to: 'research-ideas' },
  { from: 'photography', to: 'about' },
  { from: 'professional-work', to: 'projects' },
] as const;

export function validateNeuralAtlasLayoutData() {
  const identityConnections = neuralAtlasTractConnections.filter(
    (connection) => connection.from === 'about' || connection.to === 'about'
  );

  return {
    navNodeCount: neuralAtlasNavNodes.length,
    tractCount: neuralAtlasTractConnections.length,
    identityDirectConnectionCount: identityConnections.length,
    isSparse: neuralAtlasTractConnections.length <= 6,
    isNotHubAndSpoke: identityConnections.length <= 3,
  };
}
