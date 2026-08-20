'use client';

// Small live readout of the emotion distribution + FPS. Doubles as a research
// artifact (you can watch the heuristic work). Only visible while running.

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ChevronDown } from 'lucide-react';
import { useSensingStore } from '@/lib/stores/sensingStore';
import { EMOTIONS, emotionToTokens, rgbToCss } from '../emotion';
import { cn } from '@/lib/utils';

const LABELS: Record<string, string> = {
  joy: 'Joy',
  calm: 'Calm',
  surprise: 'Surprise',
  sadness: 'Sadness',
  anger: 'Anger',
  fear: 'Fear',
};

export function SensingHud() {
  const status = useSensingStore((s) => s.status);
  const reading = useSensingStore((s) => s.reading);
  const fps = useSensingStore((s) => s.fps);
  const [open, setOpen] = useState(true);

  if (status !== 'running') return null;

  const accent = rgbToCss(emotionToTokens(reading).primaryRGB);

  return (
    <div className="fixed bottom-4 left-4 z-50 print:hidden" data-gesture-ignore>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-bg-panel/80 px-3 py-1.5 text-xs font-medium text-text-secondary backdrop-blur transition hover:text-cyan"
      >
        <Activity className="h-3.5 w-3.5" style={{ color: accent }} />
        <span className="font-mono">{fps} fps</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="w-52 overflow-hidden rounded-xl border border-white/10 bg-bg-panel/90 p-3 backdrop-blur"
          >
            <div className="space-y-1.5">
              {EMOTIONS.map((emotion) => {
                const value = reading.scores[emotion];
                const isDominant = emotion === reading.dominant;
                return (
                  <div key={emotion} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'w-16 shrink-0 text-[11px]',
                        isDominant ? 'font-semibold text-text-primary' : 'text-text-muted',
                      )}
                    >
                      {LABELS[emotion]}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full transition-[width] duration-150"
                        style={{
                          width: `${Math.round(value * 100)}%`,
                          backgroundColor: isDominant ? accent : 'rgba(var(--cyan-rgb), 0.4)',
                        }}
                      />
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
