'use client';

import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export type FrontierMediaVisibility = 'off' | 'warm' | 'active';

export function useMediaVisibility(ref: RefObject<HTMLElement | null>): FrontierMediaVisibility {
  const [state, setState] = useState<FrontierMediaVisibility>('off');

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      const ratio = entry.intersectionRatio;
      if (ratio >= 0.65 && document.visibilityState === 'visible') setState('active');
      else if (entry.isIntersecting) setState('warm');
      else setState('off');
    }, {
      rootMargin: '500px 0px',
      threshold: [0, 0.01, 0.65],
    });

    const visibility = () => {
      if (document.visibilityState === 'hidden') setState((current) => current === 'active' ? 'warm' : current);
    };

    observer.observe(node);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [ref]);

  return state;
}
