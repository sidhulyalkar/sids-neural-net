'use client';

import { useEffect, useRef, useState } from 'react';
import { getFrontierScrollVelocity } from '@/lib/frontier/vector/interactionPace';
import { listenFrontierSemanticTelemetry } from '@/lib/frontier/vector/telemetryEngine';

export type FrontierReadingDensity = 'scan' | 'balanced' | 'deep';

export function resolveFrontierReadingDensity(input: {
  speed: number;
  previous: FrontierReadingDensity;
  deepUntil: number;
  now: number;
}): FrontierReadingDensity {
  if (input.deepUntil > input.now && input.speed < 1.45) return 'deep';
  if (input.speed >= 0.95) return 'scan';
  if (input.previous === 'scan' && input.speed >= 0.48) return 'scan';
  return 'balanced';
}

export function useAdaptiveReadingDensity(): FrontierReadingDensity {
  const [density, setDensity] = useState<FrontierReadingDensity>('balanced');
  const densityRef = useRef<FrontierReadingDensity>('balanced');
  const deepUntilRef = useRef(0);
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    densityRef.current = density;
  }, [density]);

  useEffect(() => {
    const sample = () => {
      const now = performance.now();
      const speed = Math.abs(getFrontierScrollVelocity(now));
      const next = resolveFrontierReadingDensity({
        speed,
        previous: densityRef.current,
        deepUntil: deepUntilRef.current,
        now,
      });
      if (next !== densityRef.current) {
        densityRef.current = next;
        setDensity(next);
      }
      if (settleTimer.current !== undefined) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => {
        const settleNow = performance.now();
        const settled = resolveFrontierReadingDensity({
          speed: Math.abs(getFrontierScrollVelocity(settleNow)),
          previous: densityRef.current,
          deepUntil: deepUntilRef.current,
          now: settleNow,
        });
        if (settled !== densityRef.current) {
          densityRef.current = settled;
          setDensity(settled);
        }
      }, 560);
    };

    window.addEventListener('scroll', sample, { passive: true });
    return () => {
      window.removeEventListener('scroll', sample);
      if (settleTimer.current !== undefined) window.clearTimeout(settleTimer.current);
    };
  }, []);

  useEffect(() => listenFrontierSemanticTelemetry((event) => {
    const deep = (event.kind === 'dwell' && (event.dwellMs ?? 0) >= 8_000)
      || event.kind === 'expand'
      || event.kind === 'open';
    if (!deep) return;
    const now = performance.now();
    deepUntilRef.current = Math.max(deepUntilRef.current, now + (event.kind === 'dwell' ? 14_000 : 9_000));
    if (Math.abs(getFrontierScrollVelocity(now)) < 1.45 && densityRef.current !== 'deep') {
      densityRef.current = 'deep';
      setDensity('deep');
    }
  }), []);

  return density;
}
