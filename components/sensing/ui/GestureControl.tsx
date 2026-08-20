'use client';

import { useState } from 'react';
import { AlertCircle, Hand, Loader2, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useSensingStore } from '@/lib/stores/sensingStore';

const GESTURE_GUIDE_EVENT = 'sensing:gesture-guide';
const GESTURE_RECALIBRATE_EVENT = 'sensing:gesture-recalibrate';

export function GestureControl() {
  const sensingStatus = useSensingStore((state) => state.status);
  const enabled = useSensingStore((state) => state.gestureEnabled);
  const status = useSensingStore((state) => state.gestureStatus);
  const error = useSensingStore((state) => state.gestureError);
  const setEnabled = useSensingStore((state) => state.setGestureEnabled);
  const [showConsent, setShowConsent] = useState(false);

  if (sensingStatus !== 'running') return null;

  const reopenGuide = () => window.dispatchEvent(new Event(GESTURE_GUIDE_EVENT));
  const recalibrate = () => window.dispatchEvent(new Event(GESTURE_RECALIBRATE_EVENT));

  return (
    <div
      className="fixed bottom-16 right-4 z-[60] flex flex-col items-end gap-2 print:hidden"
      data-gesture-ignore
    >
      {showConsent && !enabled && (
        <div
          className="w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-violet/30 bg-bg-panel/95 shadow-glow-violet backdrop-blur-xl"
          role="dialog"
          aria-label="Gesture control consent"
        >
          <div className="border-b border-white/10 bg-gradient-to-r from-violet/15 via-cyan/10 to-transparent p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-violet/25 bg-violet/15 text-violet">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-violet">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em]">Local hand tracking</span>
                </div>
                <h2 className="mt-1 text-sm font-semibold text-text-primary">Three gestures control the site.</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                  Hand landmarks are recognized in your browser. Camera frames and landmarks are not uploaded or stored.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 p-3 sm:grid-cols-3">
            <div className="rounded-xl border border-green/20 bg-green/[0.035] p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-green">Pinch = click</div>
              <div className="mt-1 text-[10px] leading-relaxed text-text-muted">Aim at a control, wait for green lock, pinch briefly, then release.</div>
            </div>
            <div className="rounded-xl border border-violet/20 bg-violet/[0.035] p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-violet">Fist = back</div>
              <div className="mt-1 text-[10px] leading-relaxed text-text-muted">Hold a closed fist briefly to go back one browser-history page.</div>
            </div>
            <div className="rounded-xl border border-cyan/20 bg-cyan/[0.035] p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan">Two fingers = scroll</div>
              <div className="mt-1 text-[10px] leading-relaxed text-text-muted">Raise index + middle fingers and move them vertically to scroll up or down.</div>
            </div>
          </div>

          <div className="mx-3 mb-3 rounded-xl border border-violet/20 bg-violet/[0.06] px-3 py-2.5">
            <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-violet">First use · quick calibration</div>
            <p className="mt-1 text-[10px] leading-relaxed text-text-muted">
              A short five-step course validates click, back, scroll down, and scroll up on your camera setup while tuning pointer and pinch timing. Skip anytime or recalibrate later after moving your device.
            </p>
          </div>

          <div className="flex gap-2 border-t border-white/10 p-3">
            <button
              type="button"
              onClick={() => {
                setShowConsent(false);
                setEnabled(true);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet/15 px-3 py-2.5 text-xs font-semibold text-violet transition hover:bg-violet/25"
            >
              <Hand className="h-3.5 w-3.5" />
              Enable air controls
            </button>
            <button
              type="button"
              onClick={() => setShowConsent(false)}
              className="rounded-xl border border-white/10 px-3 py-2.5 text-xs text-text-secondary transition hover:border-white/20 hover:text-text-primary"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {enabled && status === 'error' && (
        <div className="w-72 rounded-xl border border-rose/30 bg-bg-panel/95 p-3 text-xs text-text-secondary shadow-lg backdrop-blur">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-rose">
            <AlertCircle className="h-3.5 w-3.5" />
            Hand controls unavailable
          </div>
          {error || 'Try disabling and enabling gesture control again.'}
        </div>
      )}

      {enabled ? (
        <div className="flex items-stretch overflow-hidden rounded-full border border-violet/35 bg-bg-panel/90 shadow-lg backdrop-blur-xl">
          <button
            type="button"
            onClick={reopenGuide}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-violet/10"
            title="Show gesture guide"
          >
            {status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin text-violet" />
            ) : (
              <Hand className="h-4 w-4 text-violet" />
            )}
            <span>{status === 'running' ? 'Hands live' : 'Loading hands…'}</span>
            {status === 'running' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />}
            <span className="hidden font-mono text-[8px] uppercase tracking-[0.14em] text-text-muted sm:inline">guide</span>
          </button>
          {status === 'running' && (
            <button
              type="button"
              onClick={recalibrate}
              aria-label="Recalibrate gesture control"
              title="Moved your device? Recalibrate air controls"
              className="grid w-9 place-items-center border-l border-white/10 text-text-muted transition hover:bg-violet/10 hover:text-violet"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setEnabled(false)}
            aria-label="Disable gesture control"
            title="Disable gesture control"
            className="grid w-9 place-items-center border-l border-white/10 text-text-muted transition hover:bg-white/5 hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-pressed={false}
          onClick={() => setShowConsent((value) => !value)}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-bg-panel/80 px-4 py-2 text-sm font-medium text-text-secondary backdrop-blur transition-all hover:border-violet/40 hover:bg-bg-panel/95 hover:text-violet"
        >
          <Hand className="h-4 w-4 text-violet" />
          <span>Gesture control</span>
        </button>
      )}
    </div>
  );
}
