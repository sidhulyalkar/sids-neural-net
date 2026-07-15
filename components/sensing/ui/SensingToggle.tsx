'use client';

// Fixed, always-available control for the ambient emotion layer.
// Consent-first: the camera never starts until the user reads the disclosure
// and explicitly enables it.

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, CameraOff, ShieldCheck } from 'lucide-react';
import { useSensingStore } from '@/lib/stores/sensingStore';
import { emotionToTokens, rgbToCss } from '../emotion';
import { cn } from '@/lib/utils';

const EMOTION_LABELS: Record<string, string> = {
  joy: 'Joyful',
  calm: 'Calm',
  surprise: 'Surprised',
  sadness: 'Wistful',
  anger: 'Fired up',
  fear: 'Uneasy',
};

export function SensingToggle() {
  const enabled = useSensingStore((s) => s.enabled);
  const status = useSensingStore((s) => s.status);
  const reading = useSensingStore((s) => s.reading);
  const setEnabled = useSensingStore((s) => s.setEnabled);

  const [showConsent, setShowConsent] = useState(false);

  const dotColor = rgbToCss(emotionToTokens(reading).primaryRGB);
  const label = EMOTION_LABELS[reading.dominant] ?? 'Calm';

  function enable() {
    setShowConsent(false);
    setEnabled(true);
  }

  function disable() {
    setEnabled(false);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 print:hidden" data-gesture-ignore>
      <AnimatePresence>
        {showConsent && !enabled && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-72 rounded-xl border border-white/10 bg-bg-panel/95 p-4 shadow-glow-cyan backdrop-blur"
            role="dialog"
            aria-label="Emotion sensing consent"
          >
            <div className="mb-2 flex items-center gap-2 text-cyan">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-semibold">Ambient mood</span>
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">
              Uses your webcam to estimate visible facial expressions and gently tint the site.
              Video frames and expression estimates stay{' '}
              <strong className="text-text-primary">entirely on this device</strong> and are never stored.
              When enabled, your browser downloads the pinned MediaPipe model and runtime; the camera
              stream is never uploaded.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={enable}
                className="flex-1 rounded-lg bg-cyan/15 px-3 py-2 text-xs font-semibold text-cyan transition hover:bg-cyan/25"
              >
                Enable camera
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
            {status === 'error' && 'Something went wrong'}
          </div>
          {status === 'denied' && 'Allow camera access in your browser to sense mood.'}
          {status === 'unsupported' && 'This browser does not support camera access or local inference.'}
          {status === 'error' && 'Try toggling the mood layer off and on again.'}
        </div>
      )}

      <button
        onClick={() => {
          if (enabled) disable();
          else setShowConsent((v) => !v);
        }}
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
            <span
              className="h-2.5 w-2.5 animate-pulse rounded-full"
              style={{ backgroundColor: dotColor, boxShadow: `0 0 10px ${dotColor}` }}
            />
            <span>{status === 'running' ? label : 'Starting…'}</span>
            <X className="h-3.5 w-3.5 opacity-60" />
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            <span>Feel the room</span>
          </>
        )}
      </button>
    </div>
  );
}
