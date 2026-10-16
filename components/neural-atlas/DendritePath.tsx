import { motion } from 'framer-motion';
import { nodeTypeColors } from './registry';
import type { NeuralAtlasEdge, NeuralAtlasNode } from './registry';

type DendritePathProps = {
  edge: NeuralAtlasEdge;
  source: NeuralAtlasNode;
  target: NeuralAtlasNode;
  index: number;
  activeId: string | null;
  hoveredId: string | null;
  selectedId: string | null;
};

function pathFor(source: NeuralAtlasNode, target: NeuralAtlasNode, bend = 0) {
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const controlX = midX + normalX * bend;
  const controlY = midY + normalY * bend;

  return `M ${source.x} ${source.y} L ${controlX} ${controlY} L ${target.x} ${target.y}`;
}

function branchFor(source: NeuralAtlasNode, target: NeuralAtlasNode, bend: number, t: number, side: 1 | -1) {
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = (-dy / length) * side;
  const normalY = (dx / length) * side;
  const controlX = midX + (-dy / length) * bend;
  const controlY = midY + (dx / length) * bend;
  const oneMinusT = 1 - t;
  const x = oneMinusT * oneMinusT * source.x + 2 * oneMinusT * t * controlX + t * t * target.x;
  const y = oneMinusT * oneMinusT * source.y + 2 * oneMinusT * t * controlY + t * t * target.y;
  const twig = Math.max(3.6, Math.min(8.5, length * 0.15));

  return `M ${x} ${y} L ${x + normalX * twig * 0.55} ${y + normalY * twig * 0.55} L ${x + normalX * twig} ${y + normalY * twig}`;
}

export function DendritePath({
  edge,
  source,
  target,
  index,
  activeId,
  hoveredId,
  selectedId,
}: DendritePathProps) {
  const connectedToHover = hoveredId === edge.from || hoveredId === edge.to;
  const connectedToActive = activeId === edge.from || activeId === edge.to;
  const selected = selectedId === edge.from || selectedId === edge.to;
  const bright = selected || connectedToHover || connectedToActive;
  const color = nodeTypeColors[source.type];
  const bend = edge.bend ?? 0;
  const path = pathFor(source, target, bend);

  return (
    <g>
      <motion.path
        d={path}
        fill="none"
        stroke={bright ? color : 'rgba(184,199,217,0.2)'}
        strokeLinecap="round"
        strokeWidth={bright ? 0.58 + edge.strength * 0.5 : 0.26 + edge.strength * 0.24}
        strokeOpacity={bright ? 0.78 : 0.4}
        pathLength={1}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: bright ? 1 : 0.72 }}
        transition={{ delay: 0.7 + index * 0.08, duration: 1.4, ease: 'easeInOut' }}
        className={bright ? 'dendrite-glow' : 'dendrite-idle'}
      />
      {[0.34, 0.64].map((t, branchIndex) => (
        <motion.path
          key={t}
          d={branchFor(source, target, bend, t, (index + branchIndex) % 2 === 0 ? 1 : -1)}
          fill="none"
          stroke={bright ? color : 'rgba(184,199,217,0.18)'}
          strokeLinecap="round"
          strokeWidth={bright ? 0.42 : 0.2}
          strokeOpacity={bright ? 0.55 : 0.3}
          pathLength={1}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: bright ? 0.8 : 0.46 }}
          transition={{ delay: 1 + index * 0.06 + branchIndex * 0.12, duration: 1 }}
        />
      ))}
      {selected && (
        <motion.circle r="1.15" fill="#effbff" filter="url(#atlasGlow)">
          <animateMotion dur="2s" repeatCount="1" fill="freeze" path={path} />
        </motion.circle>
      )}
    </g>
  );
}
