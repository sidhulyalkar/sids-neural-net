'use client';

import { useEffect, useRef, useState } from 'react';
import { frontierLightningFarTip, frontierLightningGeometry } from '@/lib/frontier/lightningGeometry';
import type { LightningGeometry, LightningPoint } from '@/lib/frontier/lightningGeometry';
import { lightningTipTouchesBubble } from '@/lib/frontier/lightningImpact';
import { useFrontierStore } from '@/lib/frontier/store';
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

function creatureAtTip(point: LightningPoint): HTMLButtonElement | null {
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
  return target;
}

function strikeImpact(point: LightningPoint): boolean {
  const target = creatureAtTip(point);
  if (!target) return false;
  // Only an actually accepted impact produces a hit.
  const impact = new CustomEvent('frontier-lightning-impact', { cancelable: true });
  target.dispatchEvent(impact);
  return impact.defaultPrevented;
}

/** Lightning launches FROM the click position. A strong, branching curved
 * discharge extends toward a normally hidden offset endpoint. Only its FAR tip can
 * pop a creature at 165ms impact, never the cursor or an intermediate fork.
 * Misses do not change article interest. Native clicks and scroll are intact.
 */
export function FrontierLightningCursor({ showAimReticle = false }: { showAimReticle?: boolean }) {
  const aimRef = useRef<HTMLDivElement>(null);
  const aimEnabledRef = useRef(showAimReticle);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    aimEnabledRef.current = showAimReticle;
    if (!showAimReticle && aimRef.current) aimRef.current.style.opacity = '0';
  }, [showAimReticle]);

  useEffect(() => {
    const aim = aimRef.current;
    if (!aim) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let pending: { x: number; y: number; visible: boolean } | null = null;
    const timers = new Set<number>();
    const onMove = (event: PointerEvent) => {
      if (!aimEnabledRef.current || !fine.matches || reduced.matches || event.pointerType === 'touch') return;
      const endpoint = frontierLightningFarTip(
        { x: event.clientX, y: event.clientY },
        { width: window.innerWidth, height: window.innerHeight },
      );
      pending = {
        x: endpoint.x, y: endpoint.y,
        visible: Boolean(document.querySelector('[data-frontier-edition="multi-article"]')),
      };
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!pending) return;
        aim.style.transform = `translate3d(${Math.round(pending.x - 17)}px,${Math.round(pending.y - 17)}px,0)`;
        aim.style.opacity = pending.visible ? '1' : '0';
        // Only inspect sprite geometry once per animation frame, not once
        // per high-frequency pointer event, while the swarm is in motion.
        aim.dataset.hot = creatureAtTip({ x: pending.x, y: pending.y }) ? 'true' : 'false';
      });
    };
    const onClick = (event: MouseEvent) => {
      // Pointer-driven clicks fire everywhere on Frontier, including nav,
      // empty card space, margins and search. Never prevent their native action.
      if (reduced.matches || event.detail === 0 || event.button !== 0) return;
      if (!document.querySelector('[data-frontier-edition="multi-article"]')) return;
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      const from = { x: event.clientX, y: event.clientY };
      // The far tip, not the click, is the collision point. No auto-targeting.
      const endpoint = frontierLightningFarTip(from, {
        width: window.innerWidth, height: window.innerHeight,
      });
      const id = ++nextId.current;
      const geometry = frontierLightningGeometry(from, endpoint, id * 37);

      // A real tip overlap temporarily freezes its target so the user sees
      // the electricity visibly reach the bubble. It does not magnetize the
      // bolt toward nearby creatures: the fixed far endpoint never moves.
      const reserved = creatureAtTip(geometry.end);
      if (reserved) reserved.dataset.frontierLightningReserved = 'true';

      // Distinguish voluntary play from source navigation and UI controls:
      // all clicks still produce the visual bolt, but only a blank-surface
      // shot toward a visible article swarm enters private gameplay counts.
      const clicked = event.target instanceof Element ? event.target : null;
      const guided = aimEnabledRef.current;
      const isGameplayClick = !clicked?.closest(
        'a,button,input,textarea,select,summary,[role="button"],[role="link"]'
      );
      const hitSurface = document.elementFromPoint(geometry.end.x,geometry.end.y);
      const article = hitSurface?.closest<HTMLElement>('[data-frontier-story]');
      const articleId = article?.querySelector('[data-frontier-ambient-layer="swarm"]')
        ? article.dataset.frontierStory : undefined;

      setStrikes((current) => [...current.slice(-5), { id, geometry, hit: false }]);
      const arrival = window.setTimeout(() => {
        timers.delete(arrival);
        if (document.visibilityState !== 'visible') {
          if (reserved) delete reserved.dataset.frontierLightningReserved;
          return;
        }
        const hit = strikeImpact(geometry.end);
        if (isGameplayClick && articleId) {
          const state=useFrontierStore.getState();
          const item=state.history[articleId]?.item;
          if (item) state.recordLightningShot(item,hit,guided);
        }
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
    <div aria-hidden="true" className={styles.root} data-frontier-lightning-cursor="true"
      data-aim-enabled={showAimReticle ? 'true' : 'false'}>
      <div ref={aimRef} className={styles.aim} data-frontier-lightning-reticle="true"><span className={styles.aimRing}/><span className={styles.aimDot}/></div>
      <svg className={styles.overlay} width="100%" height="100%" focusable="false">
        {strikes.map(({ id, geometry, hit }) => (
          <g key={id} data-frontier-lightning-strike="true" data-lightning-hit={hit ? 'true' : 'false'}
            data-lightning-start-x={geometry.start.x} data-lightning-start-y={geometry.start.y}
            data-lightning-end-x={geometry.end.x} data-lightning-end-y={geometry.end.y}>
            <path d={geometry.main} pathLength={100} className={styles.halo}/>
            <path d={geometry.main} pathLength={100} className={styles.arc}/>
            <path d={geometry.main} pathLength={100} className={styles.core}/>
            {geometry.filaments.map((path, index) =>
              <path key={`filament-${index}`} d={path} pathLength={100} className={styles.filament}/>)}
            {geometry.forks.map((path, index) =>
              <path key={`fork-${index}`} d={path} pathLength={100} className={styles.fork}/>)}
            {geometry.dendrites.map((path, index) =>
              <path key={`dendrite-${index}`} d={path} pathLength={100} className={styles.dendrite}/>)}
            {geometry.microDendrites.map((path, index) =>
              <path key={`micro-${index}`} d={path} pathLength={100} className={styles.microDendrite}/>)}
            <circle cx={geometry.start.x} cy={geometry.start.y} r={3.4} className={styles.emitter}/>
            <circle cx={geometry.end.x} cy={geometry.end.y} r={5} className={styles.impact}/>
            <circle cx={geometry.end.x} cy={geometry.end.y} r={2.3} className={styles.flash}/>
          </g>
        ))}
      </svg>
    </div>
  );
}
