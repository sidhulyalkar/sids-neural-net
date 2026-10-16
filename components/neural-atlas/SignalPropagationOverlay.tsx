import { motion } from 'framer-motion';
import { nodeTypeColors } from './registry';
import type { NeuralAtlasNode } from './registry';

type SignalPropagationOverlayProps = {
  node: NeuralAtlasNode | null;
};

export function SignalPropagationOverlay({ node }: SignalPropagationOverlayProps) {
  if (!node) return null;

  const color = nodeTypeColors[node.type];

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[80] overflow-hidden bg-bg-deep"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0.18] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2, times: [0, 0.12, 0.82, 1], ease: 'easeInOut' }}
      aria-hidden="true"
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.92), rgba(102,227,255,0.64) 9%, rgba(167,139,250,0.48) 23%, rgba(6,11,30,0.92) 58%, #02040c 100%)',
        }}
        animate={{ scale: [0.55, 1.25, 1.9], filter: ['blur(18px)', 'blur(4px)', 'blur(28px)'] }}
        transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[150vmax] w-8 origin-center -translate-x-1/2 -translate-y-1/2 bg-white/80 shadow-[0_0_80px_rgba(102,227,255,0.9)]"
        animate={{ rotate: [22, 78, 132], opacity: [0, 1, 0] }}
        transition={{ duration: 1.85, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(90deg, transparent 0 8px, ${color}33 9px, transparent 11px)`,
        }}
        animate={{ x: ['-16%', '16%'], opacity: [0, 0.5, 0] }}
        transition={{ duration: 2 }}
      />
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-6">
        <motion.div
          className="max-w-xl text-center"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.94, 1, 1.05] }}
          transition={{ duration: 1.7, times: [0, 0.2, 0.75, 1] }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-white/75">signal propagation</p>
          <p className="mt-4 text-3xl font-black text-white sm:text-5xl">{node.label}</p>
        </motion.div>
      </div>
    </motion.div>
  );
}
