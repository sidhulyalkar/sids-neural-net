'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Eye, FlaskConical, Wrench, Brain, Heart } from 'lucide-react';
import { useMode, ViewMode, modeConfigs } from '@/lib/contexts/ModeContext';
import { cn } from '@/lib/utils';

const modeIcons: Record<ViewMode, React.ComponentType<{ className?: string }>> = {
  recruiter: Eye,
  researcher: FlaskConical,
  builder: Wrench,
  'full-brain': Brain,
  personal: Heart,
};

const modeColors: Record<ViewMode, string> = {
  recruiter: 'text-cyan',
  researcher: 'text-violet',
  builder: 'text-green',
  'full-brain': 'text-amber',
  personal: 'text-rose',
};

export function ModeToggle() {
  const { mode, setMode, modeConfig } = useMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const Icon = modeIcons[mode];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-white/10 bg-bg-panel px-3 py-2 text-sm font-medium transition-all hover:border-white/20',
          modeColors[mode]
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{modeConfig.label} View</span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-bg-panel shadow-xl"
          >
            {(Object.keys(modeConfigs) as ViewMode[]).map((m) => {
              const MIcon = modeIcons[m];
              const config = modeConfigs[m];
              const isActive = mode === m;

              return (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5',
                    isActive && 'bg-white/5'
                  )}
                >
                  <MIcon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', modeColors[m])} />
                  <div>
                    <div
                      className={cn(
                        'font-medium',
                        isActive ? modeColors[m] : 'text-text-primary'
                      )}
                    >
                      {config.label}
                    </div>
                    <div className="text-xs text-text-muted">{config.description}</div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
