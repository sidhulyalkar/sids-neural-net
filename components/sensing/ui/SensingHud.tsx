'use client';

// Live readout of directly observable signal activations. Kept explicit so the
// visitor can see exactly what the local heuristic measures.

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ChevronDown } from 'lucide-react';
import { useSensingStore } from '@/lib/stores/sensingStore';
import { EXPRESSION_SIGNALS, expressionToTokens, rgbToCss } from '../expression';
import { cn } from '@/lib/utils';

const LABELS = {
  facialActivity: 'Face activity',
  smileActivation: 'Smile',
  eyeOpenness: 'Eye openness',
  browActivity: 'Brows',
  mouthActivity: 'Mouth',
  expressionAsymmetry: 'Asymmetry',
  blinkActivation: 'Blink',
  stillness: 'Stillness',
} as const;

export function SensingHud() {
  const status = useSensingStore((state) => state.status);
  const reading = useSensingStore((state) => state.reading);
  const fps = useSensingStore((state) => state.fps);
  const [open, setOpen] = useState(true);
  if (status !== 'running') return null;
  const accent = rgbToCss(expressionToTokens(reading).primaryRGB);

  return (
    <div className="fixed bottom-4 left-4 z-50 print:hidden" data-gesture-ignore>
      <button
        onClick={() => setOpen((value) => !value)}
        className="mb-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-bg-panel/80 px-3 py-1.5 text-xs font-medium text-text-secondary backdrop-blur transition hover:text-cyan"
      >
        <Activity className="h-3.5 w-3.5" style={{ color: accent }} />
        <span className="font-mono">local · {fps} fps</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="w-60 overflow-hidden rounded-xl border border-white/10 bg-bg-panel/90 p-3 backdrop-blur"
          >
            <p className="mb-2 text-[10px] leading-4 text-text-muted">Visible activation only. No emotion or mental-state classification.</p>
            <div className="space-y-1.5">
              {EXPRESSION_SIGNALS.map((signal) => {
                const value = reading.signals[signal];
                return (
                  <div key={signal} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-[10px] text-text-muted">{LABELS[signal]}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${Math.round(value * 100)}%`, backgroundColor: accent }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
