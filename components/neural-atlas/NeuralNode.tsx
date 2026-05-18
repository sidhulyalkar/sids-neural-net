import type { CSSProperties } from 'react';
import {
  BriefcaseBusiness,
  Code2,
  Compass,
  FileText,
  FlaskConical,
  Mountain,
  NotebookText,
  Orbit,
  Radio,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { nodeTypeColors } from './registry';
import type { NeuralAtlasNode } from './registry';

type NeuralNodeProps = {
  node: NeuralAtlasNode;
  index: number;
  isActive: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  isRevealed: boolean;
  onHover: (id: string | null) => void;
  onFocus: (id: string) => void;
  onOpen: (node: NeuralAtlasNode) => void;
};

const icons = {
  self: UserRound,
  paper: FileText,
  code: Code2,
  lens: Orbit,
  spark: Sparkles,
  zap: Zap,
  radio: Radio,
  mountain: Mountain,
  briefcase: BriefcaseBusiness,
  compass: Compass,
  microscope: FlaskConical,
  notebook: NotebookText,
};

const sizeClasses = {
  sm: 'h-[4.75rem] w-[4.75rem] sm:h-[5.4rem] sm:w-[5.4rem]',
  md: 'h-[6rem] w-[6rem] sm:h-[7rem] sm:w-[7rem]',
  lg: 'h-[7rem] w-[7rem] sm:h-[8.4rem] sm:w-[8.4rem]',
};

export function NeuralNodeButton({
  node,
  index,
  isActive,
  isHovered,
  isDimmed,
  isRevealed,
  onHover,
  onFocus,
  onOpen,
}: NeuralNodeProps) {
  const Icon = icons[node.glyph as keyof typeof icons] ?? Sparkles;
  const color = nodeTypeColors[node.type];
  const visible = node.initiallyVisible || isRevealed || isHovered || isActive;
  const morphologyClass = {
    soma: 'rounded-full',
    pyramidal: 'neural-node-pyramidal',
    stellate: 'neural-node-stellate rounded-full',
    interneuron: 'neural-node-interneuron rounded-full',
    glial: 'neural-node-glial rounded-full',
    bundle: 'neural-node-bundle rounded-full',
  }[node.morphology];

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.7, y: 12 }}
      animate={{
        opacity: visible ? (isDimmed ? 0.42 : 1) : 0,
        scale: isActive || isHovered ? 1.06 : 1,
        y: 0,
      }}
      transition={{ delay: node.initiallyVisible ? 0.35 + index * 0.12 : 1.4 + index * 0.04, duration: 0.72 }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onFocus(node.id)}
      onClick={() => onOpen(node)}
      className="group absolute z-20 -translate-x-1/2 -translate-y-1/2 text-left focus-visible:outline-offset-[10px]"
      style={{ left: `${node.x}%`, top: `${node.y}%`, pointerEvents: visible ? 'auto' : 'none' }}
      aria-label={`Open ${node.label}: ${node.summary}`}
    >
      <span
        className={`relative flex items-center justify-center border bg-[#050914]/78 backdrop-blur-xl transition-transform duration-300 ${morphologyClass} ${sizeClasses[node.size]}`}
        style={{
          borderColor: isActive || isHovered ? '#ffffff' : `${color}99`,
          boxShadow: `0 0 ${isActive || isHovered ? 52 : 28}px ${color}55, inset 0 0 22px ${color}14`,
        }}
      >
        <span className="absolute inset-[-18px] rounded-full border border-white/5 transition-colors group-hover:border-white/15" />
        <span className="absolute inset-[-9px] rounded-full border transition-colors" style={{ borderColor: `${color}24` }} />
        {node.kind === 'leaf' && (
          <span
            className="absolute -inset-5 opacity-70 neural-node-arbor"
            style={{ '--node-color': color } as CSSProperties}
            aria-hidden="true"
          />
        )}
        <span className="absolute h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 18px ${color}` }} />
        <Icon className="h-5 w-5 opacity-80 transition-opacity group-hover:opacity-100" style={{ color }} />
      </span>

      <span className="pointer-events-none absolute left-1/2 top-full mt-3 flex w-44 -translate-x-1/2 flex-col items-center text-center">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-text-muted">
          {node.annotation}
        </span>
        <span className="mt-1 text-sm font-semibold leading-tight text-text-primary">{node.label}</span>
      </span>
    </motion.button>
  );
}
