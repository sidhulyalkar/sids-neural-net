'use client';

// Consent-first control. The camera and MediaPipe runtime are not imported or
// started until the visitor explicitly enables local signal sensing.

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, CameraOff, ShieldCheck } from 'lucide-react';
import { useSensingStore } from '@/lib/stores/sensingStore';
import { expressionToTokens, rgbToCss, strongestObservableSignal } from '../expression';
import { cn } from '@/lib/utils';

const SIGNAL_LABELS = {
  facialActivity: 'Face active',
  smileActivation: 'Smile active',
  browActivity: 'Brows active',
  mouthActivity: 'Mouth active',
  expressionAsymmetry: 'Asymmetry',
  blinkActivation: 'Blink',
  eyeOpenness: 'Eyes open',
  stillness: 'Still',
} as const;

export function SensingToggle() {
  const pathname = usePathname();
  const enabled = useSensingStore((state) => state.enabled);
  const status = useSensingStore((state) => state.status);
  const reading = useSensingStore((state) => state.reading);
  const setEnabled = useSensingStore((state) => state.setEnabled);
  const [showConsent, setShowConsent] = useState(false);
  const dotColor = rgbToCss(expressionToTokens(reading).primaryRGB);
  const strongest = strongestObservableSignal(reading);
  const label = reading.intensity < 0.08 ? 'Signals quiet' : SIGNAL_LABELS[strongest];

  // Keep the landing page visually quiet. Camera/gesture sensing remains
  // available everywhere else and can still be entered from its dedicated UI.
  if (pathname === '/') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 print:hidden" data-gesture-ignore>
      <AnimatePresence>
        {showConsent && !enabled && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-80 rounded-xl border border-white/10 bg-bg-panel/95 p-4 shadow-glow-cyan backdrop-blur"
            role="dialog"
            aria-label="Camera signal sensing consent"
          >
            <div className="mb-2 flex items-center gap-2 text-cyan">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-semibold">Signal-reactive site</span>
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">
              Uses your webcam to measure visible facial activation and, if you choose, hand gestures.
              It does <strong className="text-text-primary">not infer emotions or mental state</strong>.
              Frames stay on this device, are never stored, and the camera is released when you turn the feature off.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { setShowConsent(false); setEnabled(true); }}
                className="flex-1 rounded-lg bg-cyan/15 px-3 py-2 text-xs font-semibold text-cyan transition hover:bg-cyan/25"
              >
                Enable camera signals
              </button>
              <button
                onClick={() => setShowConsent(false)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-text-secondary transition hover:border-white/20"
              >
                Not now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(status === 'denied' || status === 'unsupported' || status === 'error') && enabled && (
        <div className="w-64 rounded-lg border border-rose/30 bg-bg-panel/95 p-3 text-xs text-text-secondary backdrop-blur">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-rose">
            <CameraOff className="h-3.5 w-3.5" />
            {status === 'denied' && 'Camera blocked'}
            {status === 'unsupported' && 'Not supported'}
            {status === 'error' && 'Signal runtime error'}
          </div>
          {status === 'denied' && 'Allow camera access in your browser to use local signal interactions.'}
          {status === 'unsupported' && 'This browser does not support the required local camera or inference APIs.'}
          {status === 'error' && 'Turn camera signals off and on to restart the local runtime.'}
        </div>
      )}

      <button
        onClick={() => enabled ? setEnabled(false) : setShowConsent((value) => !value)}
        aria-pressed={enabled}
        className={cn(
          'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur transition-all',
          enabled
            ? 'border-white/15 bg-bg-panel/90 text-text-primary'
            : 'border-white/10 bg-bg-panel/80 text-text-secondary hover:border-cyan/40 hover:text-cyan',
        )}
      >
        {enabled ? (
          <>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ backgroundColor: dotColor, boxShadow: `0 0 10px ${dotColor}` }} />
            <span>{status === 'running' ? label : 'Starting signals…'}</span>
            <X className="h-3.5 w-3.5 opacity-60" />
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            <span>Camera signals</span>
          </>
        )}
      </button>
    </div>
  );
}
