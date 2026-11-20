'use client';

import { useEffect, useRef } from 'react';
import styles from './frontier-whip-cursor.module.css';

/**
 * A lightweight, route-scoped adaptation of Unicorn Stampede's Rainbow Whip.
 * Its offset origin and rainbow quadratic sweep visually target beside the
 * pointer; only real button clicks affect engagement. Native pointer semantics
 * are untouched. Pointer tracking writes to a DOM transform, never React state.
 */
export function FrontierWhipCursor() {
  const aimRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduced.matches) return;

    const aim = aimRef.current;
    const flash = flashRef.current;
    if (!aim || !flash) return;
    let frame = 0;
    let pending: { x: number; y: number; hot: boolean; visible: boolean } | null = null;
    let hideTimer = 0;

    const showAim = () => {
      frame = 0;
      if (!pending) return;
      const { x, y, hot, visible } = pending;
      // An offset ring keeps the genuine click point unobstructed.
      aim.style.transform = `translate3d(${Math.round(x + 7)}px,${Math.round(y - 28)}px,0)`;
      aim.style.opacity = visible ? '1' : '0';
      aim.dataset.hot = hot ? 'true' : 'false';
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const target = event.target instanceof Element ? event.target : null;
      const within = Boolean(target?.closest('[data-frontier-edition="multi-article"]'));
      pending = {
        x: event.clientX,
        y: event.clientY,
        visible: within,
        hot: Boolean(target?.closest('[data-frontier-sprite],[data-frontier-clear-article]')),
      };
      if (!frame) frame = window.requestAnimationFrame(showAim);
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[data-frontier-edition="multi-article"]')) return;
      // Only article interactions crack the whip; navigation and search remain
      // unaffected by this optional visual layer.
      if (!target.closest('[data-frontier-story]')) return;
      window.clearTimeout(hideTimer);
      const x = event.clientX;
      const y = event.clientY;
      flash.style.left = `${Math.round(x - 118)}px`;
      flash.style.top = `${Math.round(y - 80)}px`;
      // Restart the 260ms transform-only animation without creating a new
      // listener, timer loop, particle engine, canvas or HTTP request.
      flash.classList.remove(styles.active);
      void flash.offsetWidth;
      flash.classList.add(styles.active);
      flash.dataset.active = 'true';
      hideTimer = window.setTimeout(() => {
        flash.classList.remove(styles.active);
        flash.dataset.active = 'false';
      }, 280);
    };

    const hide = () => {
      aim.style.opacity = '0';
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') hide();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true, capture: true });
    document.documentElement.addEventListener('pointerleave', hide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, true);
      document.documentElement.removeEventListener('pointerleave', hide);
      document.removeEventListener('visibilitychange', visibility);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div aria-hidden="true" className={styles.root} data-frontier-whip-cursor="true">
      <div ref={aimRef} className={styles.aim}>
        <span className={styles.aimRing}/>
        <span className={styles.aimDot}/>
      </div>
      <div ref={flashRef} className={styles.flash} data-active="false">
        <svg width="240" height="180" viewBox="0 0 240 180" focusable="false">
          <path className={styles.shadow} d="M 37 135 Q 83 5 128 74"/>
          <path className={styles.strand1} d="M 37 135 Q 83 5 128 74"/>
          <path className={styles.strand2} d="M 37 135 Q 83 5 128 74"/>
          <path className={styles.strand3} d="M 37 135 Q 83 5 128 74"/>
          <circle className={styles.impact} cx="128" cy="74" r="11"/>
          <circle className={styles.spark} cx="128" cy="74" r="3"/>
        </svg>
      </div>
    </div>
  );
}
