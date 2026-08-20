'use client';

import { useState } from 'react';
import { AlertCircle, Hand, Loader2, ShieldCheck, X } from 'lucide-react';
import { useSensingStore } from '@/lib/stores/sensingStore';

export function GestureControl() {
  const sensingStatus = useSensingStore((state) => state.status);
  const enabled = useSensingStore((state) => state.gestureEnabled);
  const status = useSensingStore((state) => state.gestureStatus);
  const error = useSensingStore((state) => state.gestureError);
  const setEnabled = useSensingStore((state) => state.setGestureEnabled);
  const [showConsent, setShowConsent] = useState(false);

  if (sensingStatus !== 'running') return null;

  return (
    <div
      className="fixed bottom-16 right-4 z-[60] flex flex-col items-end gap-2 print:hidden"
      data-gesture-ignore
    >
      {showConsent && !enabled && (
        <div
          className="w-80 rounded-xl border border-violet/25 bg-bg-panel/95 p-4 shadow-glow-violet backdrop-blur"
          role="dialog"
          aria-label="Gesture control consent"
        >
          <div className="mb-2 flex items-center gap-2 text-violet">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm font-semibold">Hands-free controls</span>
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">
            Reuses the active camera to recognize hand landmarks locally. Hand images and landmarks
            are never uploaded or stored. Enabling downloads a pinned MediaPipe gesture model.
          </p>
          <ul className="mt-3 space-y-1 font-mono text-[10px] text-text-muted">
            <li>Swipe sideways · previous / next section</li>
            <li>Open palm · open navigation</li>
            <li>Closed fist · close navigation</li>
            <li>Pinch or thumbs up · activate target</li>
            <li>Downward karate chop · page down</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowConsent(false);
                setEnabled(true);
              }}
              className="flex-1 rounded-lg bg-violet/15 px-3 py-2 text-xs font-semibold text-violet transition hover:bg-violet/25"
            >
              Enable gestures
            </button>
            <button
              type="button"
              onClick={() => setShowConsent(false)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-text-secondary transition hover:border-white/20"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {enabled && status === 'error' && (
        <div className="w-72 rounded-lg border border-rose/30 bg-bg-panel/95 p-3 text-xs text-text-secondary backdrop-blur">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-rose">
            <AlertCircle className="h-3.5 w-3.5" />
            Hand controls unavailable
          </div>
          {error || 'Try disabling and enabling gesture control again.'}
        </div>
      )}

      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => {
          if (enabled) setEnabled(false);
          else setShowConsent((value) => !value);
        }}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur transition-all ${
          enabled
            ? 'border-violet/35 bg-bg-panel/90 text-text-primary'
            : 'border-white/10 bg-bg-panel/80 text-text-secondary hover:border-violet/40 hover:text-violet'
        }`}
      >
        {status === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin text-violet" />
        ) : (
          <Hand className="h-4 w-4 text-violet" />
        )}
        <span>{enabled ? (status === 'running' ? 'Hands live' : 'Loading hands…') : 'Gesture control'}</span>
        {enabled && <X className="h-3.5 w-3.5 opacity-60" />}
      </button>
    </div>
  );
}
