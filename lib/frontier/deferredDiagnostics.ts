type FrontierIdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Schedule observational FRONTIER work after the browser has had an opportunity
 * to paint useful recommendation content. Diagnostics must never compete with
 * ranking, allocation, or first useful paint for the same synchronous turn.
 */
export function scheduleFrontierDiagnostic(run: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const idleWindow = window as FrontierIdleWindow;
  let idleHandle: number | null = null;
  let timeoutHandle: number | null = null;
  let cancelled = false;

  const frameHandle = window.requestAnimationFrame(() => {
    if (cancelled) return;
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleHandle = idleWindow.requestIdleCallback(() => {
        if (!cancelled) run();
      }, { timeout: 1500 });
      return;
    }

    // Firefox/WebKit and older browsers still get a full paint turn before the
    // audit. The small delay also prevents diagnostics from joining hydration's
    // first burst of tasks.
    timeoutHandle = window.setTimeout(() => {
      if (!cancelled) run();
    }, 100);
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frameHandle);
    if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === 'function') {
      idleWindow.cancelIdleCallback(idleHandle);
    }
    if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
  };
}
