'use client';

import { useEffect, useRef, useState } from 'react';
import { frontierLightningGeometry } from '@/lib/frontier/lightningGeometry';
import type { LightningGeometry, LightningPoint } from '@/lib/frontier/lightningGeometry';
import { lightningTipTouchesBubble } from '@/lib/frontier/lightningImpact';
import styles from './frontier-lightning-cursor.module.css';

type Strike = {
  id: number;
  geometry: LightningGeometry;
  hit: boolean;
};

const STRIKE_TIME_MS = 165;
const STRIKE_LIFETIME_MS = 470;
function bubbleBody(button: HTMLButtonElement): Element | null {
  return button.querySelector('[data-frontier-sprite-body]');
}

function strikeImpact(point: LightningPoint): boolean {
  let target: HTMLButtonElement | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  // A shot can land on any visible article. The closest overlapping glyph
  // receives it, not every bubble whose button rectangle happens to overlap.
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '[data-frontier-ambient-layer="swarm"] [data-frontier-sprite]'
  )) {
    if (button.dataset.popped === 'true' || !button.isConnected) continue;
    if (button.closest('article')?.querySelector('[data-frontier-clear-article][data-cleared="true"]'))
      continue;
    const glyph = bubbleBody(button);
    const scene = button.closest('[data-frontier-ambient-layer="swarm"]');
    if (!glyph || !scene) continue;
    const clip = scene.getBoundingClientRect();
    // Offscreen and clipped creatures are not tangible. In particular, a
    // CSS animation may place a button just outside its overflow:hidden tile.
    if (point.x < clip.left || point.x > clip.right ||
        point.y < clip.top || point.y > clip.bottom) continue;
    const rect = glyph.getBoundingClientRect();
    if (!lightningTipTouchesBubble(point, rect)) continue;
    const distance = Math.hypot(point.x - rect.left - rect.width / 2, point.y - rect.top - rect.height / 2);
    if (distance < bestDistance) { bestDistance = distance; target = button; }
  }
  if (!target) return false;
  // A cancelable handshake tells the animation whether a live creature
  // actually accepted the impact, preventing duplicate-shot false positives.
  const impact = new CustomEvent('frontier-lightning-impact', { cancelable: true });
  target.dispatchEvent(impact);
  return impact.defaultPrevented;
}

/** Shoot at the *actual click coordinate*, anywhere on this Frontier route.
 * A creature pops only when the fixed endpoint intersects its visible body
 * at the end of the 165ms lightning travel. Misses still get electric effects.
 * Native navigation, touch scrolling and keyboard actions are undisturbed.
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
      pending = {
        x: event.clientX, y: event.clientY,
        visible: Boolean(document.querySelector('[data-frontier-edition="multi-article"]')),
        hot: Boolean(target?.closest('[data-frontier-sprite]')),
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
      // Pointer-driven clicks fire everywhere on Frontier, including nav,
      // empty card space, margins and search. Never prevent their native action.
      if (reduced.matches || event.detail === 0 || event.button !== 0) return;
      if (!document.querySelector('[data-frontier-edition="multi-article"]')) return;
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      const endpoint = { x: event.clientX, y: event.clientY };
      const from = {
        x: Math.max(14, Math.min(window.innerWidth - 14, endpoint.x - 105)),
        y: Math.max(14, Math.min(window.innerHeight - 14, endpoint.y - 84)),
      };
      const id = ++nextId.current;
      const geometry = frontierLightningGeometry(from, endpoint, id * 37);

      // Pause the directly clicked bubble at its REAL glyph position, not a
      // 44px square, while lightning travels. A click on empty button padding
      // is therefore a true miss. Other bubbles keep flying and may wander
      // into or out of the endpoint before impact.
      const clicked = event.target instanceof Element ? event.target : null;
      const direct = clicked?.closest<HTMLButtonElement>('[data-frontier-sprite]');
      const glyph = direct && direct.dataset.popped !== 'true' ? bubbleBody(direct) : null;
      const reserved = glyph && lightningTipTouchesBubble(geometry.end, glyph.getBoundingClientRect())
        ? direct : null;
      if (reserved) reserved.dataset.frontierLightningReserved = 'true';

      setStrikes((current) => [...current.slice(-5), { id, geometry, hit: false }]);
      const arrival = window.setTimeout(() => {
        timers.delete(arrival);
        if (document.visibilityState !== 'visible') {
          if (reserved) delete reserved.dataset.frontierLightningReserved;
          return;
        }
        const hit = strikeImpact(geometry.end);
        setStrikes((current) => current.map((strike) =>
          strike.id === id ? { ...strike, hit } : strike));
        if (reserved) delete reserved.dataset.frontierLightningReserved;
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
