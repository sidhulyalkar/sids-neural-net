'use client';

import { useEffect, useRef, useState } from 'react';
import { frontierLightningGeometry } from '@/lib/frontier/lightningGeometry';
import type { LightningGeometry } from '@/lib/frontier/lightningGeometry';
import styles from './frontier-lightning-cursor.module.css';

type Strike = {
  id: number;
  geometry: LightningGeometry;
  hit: boolean;
};

const STRIKE_TIME_MS = 165;
const STRIKE_LIFETIME_MS = 470;
const AIM_ASSIST_RADIUS = 58;

function closestCreature(article: Element, x: number, y: number, direct: Element | null) {
  if (direct instanceof HTMLButtonElement &&
      direct.dataset.frontierPopped !== 'true' &&
      direct.dataset.frontierLightningReserved !== 'true') return direct;
  let nearest: HTMLButtonElement | null = null;
  let bestDistance = AIM_ASSIST_RADIUS;
  for (const node of article.querySelectorAll<HTMLButtonElement>('[data-frontier-sprite]')) {
    if (node.dataset.popped === 'true' || node.dataset.frontierLightningReserved === 'true') continue;
    const bounds = node.getBoundingClientRect();
    if (!bounds.width || !bounds.height) continue;
    const dist = Math.hypot(x - (bounds.left + bounds.width / 2), y - (bounds.top + bounds.height / 2));
    if (dist < bestDistance) { nearest = node; bestDistance = dist; }
  }
  return nearest;
}

/** Curved, electric discharge: the bolt is the thing that pops the sprite.
 * It never owns pointer events or converts non-target clicks to interest.
 * Touch/keyboard/reduced-motion activate the native sprite button immediately.
 */
export function FrontierLightningCursor() {
  const aimRef = useRef<HTMLDivElement>(null);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const aim = aimRef.current;
    if (!aim) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let pending: { x: number; y: number; visible: boolean; hot: boolean } | null = null;
    const timers = new Set<number>();
    const onMove = (event: PointerEvent) => {
      if (!fine.matches || reduced.matches || event.pointerType === 'touch') return;
      const target = event.target instanceof Element ? event.target : null;
      const article = target?.closest('[data-frontier-story]');
      pending = {
        x: event.clientX, y: event.clientY,
        visible: Boolean(article), hot: Boolean(target?.closest('[data-frontier-sprite]')),
      };
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!pending) return;
        aim.style.transform = `translate3d(${Math.round(pending.x - 17)}px,${Math.round(pending.y - 42)}px,0)`;
        aim.style.opacity = pending.visible ? '1' : '0';
        aim.dataset.hot = pending.hot ? 'true' : 'false';
      });
    };
    const onClick = (event: MouseEvent) => {
      if (!fine.matches || reduced.matches || event.detail === 0 || event.button !== 0) return;
      const clicked = event.target instanceof Element ? event.target : null;
      const article = clicked?.closest('[data-frontier-story]');
      if (!article) return;
      const directlyHit = clicked?.closest('[data-frontier-sprite]') ?? null;
      // No aim-assist near source links, form controls, the clear-all oval,
      // summary toggles, or other deliberate editorial interactions.
      if (!directlyHit && clicked?.closest('a,button,input,textarea,select,summary,[role="button"]')) return;
      const target = closestCreature(article, event.clientX, event.clientY, directlyHit);
      if (!target) return;
      const bounds = target.getBoundingClientRect();
      const end = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      const from = {
        x: Math.max(14, Math.min(window.innerWidth - 14, event.clientX - 105)),
        y: Math.max(14, Math.min(window.innerHeight - 14, event.clientY - 84)),
      };
      const id = ++nextId.current;
      const geometry = frontierLightningGeometry(from, end, id * 37);
      target.dataset.frontierLightningReserved = 'true';
      setStrikes((current) => [...current.slice(-5), { id, geometry, hit: true }]);
      const arrival = window.setTimeout(() => {
        timers.delete(arrival);
        if (!target.isConnected) return;
        const cleared = article.querySelector('[data-frontier-clear-article][data-cleared="true"]');
        if (!cleared && target.dataset.popped !== 'true')
          target.dispatchEvent(new CustomEvent('frontier-lightning-impact'));
        delete target.dataset.frontierLightningReserved;
      }, STRIKE_TIME_MS);
      timers.add(arrival);
      const decay = window.setTimeout(() => {
        timers.delete(decay);
        setStrikes((current) => current.filter((strike) => strike.id !== id));
      }, STRIKE_LIFETIME_MS);
      timers.add(decay);
    };
    const hide = () => { aim.style.opacity = '0'; };
    const visibility = () => { if (document.visibilityState !== 'visible') hide(); };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('click', onClick, true);
    document.documentElement.addEventListener('pointerleave', hide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('click', onClick, true);
      document.documentElement.removeEventListener('pointerleave', hide);
      document.removeEventListener('visibilitychange', visibility);
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      for (const node of document.querySelectorAll<HTMLElement>('[data-frontier-lightning-reserved]'))
        delete node.dataset.frontierLightningReserved;
    };
  }, []);

  return (
    <div aria-hidden="true" className={styles.root} data-frontier-lightning-cursor="true">
      <div ref={aimRef} className={styles.aim}><span className={styles.aimRing}/><span className={styles.aimDot}/></div>
      <svg className={styles.overlay} width="100%" height="100%" focusable="false">
        {strikes.map(({ id, geometry, hit }) => (
          <g key={id} data-frontier-lightning-strike="true" data-lightning-hit={hit ? 'true' : 'false'}
            data-lightning-end-x={geometry.end.x} data-lightning-end-y={geometry.end.y}>
            <path d={geometry.main} pathLength={100} className={styles.halo}/>
            <path d={geometry.main} pathLength={100} className={styles.arc}/>
            <path d={geometry.main} pathLength={100} className={styles.core}/>
            {geometry.forks.map((path, index) =>
              <path key={index} d={path} pathLength={100} className={styles.fork}/>)}
            <circle cx={geometry.end.x} cy={geometry.end.y} r={5} className={styles.impact}/>
            <circle cx={geometry.end.x} cy={geometry.end.y} r={2.3} className={styles.flash}/>
          </g>
        ))}
      </svg>
    </div>
  );
}
