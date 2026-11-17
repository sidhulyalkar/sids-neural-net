'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { boundInterestScore, nextWheelInterestScore, interestScoreLabel } from '@/lib/frontier/wheelRating';
import type { KeyboardEvent } from 'react';
import styles from './frontier-wheel-rating.module.css';

type Props = {
  title: string;
  savedScore?: number;
  onSave: (score: number, method: 'wheel' | 'slider') => void;
};

export function FrontierWheelRating({ title, savedScore, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(savedScore ?? 5);
  const [viaWheel, setViaWheel] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const accumulation = useRef(0);
  const lastStepAt = useRef(0);

  useEffect(() => {
    if (!open) return;
    const node = wheelRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      // Only an explicitly opened knob owns its wheel events. Every other
      // pixel of the article and page retains native scrolling.
      event.preventDefault();
      if (event.ctrlKey) return; // Browser/trackpad pinch gesture.
      const units = event.deltaY * (event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? 450 : 1);
      if (!Number.isFinite(units)) return;
      accumulation.current += units;
      if (Math.abs(accumulation.current) < 44) return;
      const now = performance.now();
      if (now - lastStepAt.current < 72) return;
      lastStepAt.current = now;
      const direction = accumulation.current;
      accumulation.current = 0;
      setViaWheel(true);
      setDraft((value) => nextWheelInterestScore(value, direction));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [open]);

  const arm = () => {
    setDraft(savedScore ?? 5);
    setViaWheel(false);
    accumulation.current = 0;
    lastStepAt.current = 0;
    setOpen(true);
  };
  const dismiss = () => setOpen(false);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
    if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setViaWheel(false);
      setDraft((value) => {
        if (event.key === 'Home') return 1;
        if (event.key === 'End') return 10;
        return boundInterestScore(value + (event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1));
      });
    }
  };

  return (
    <div className={styles.rating} data-frontier-wheel-rating="true">
      <button type="button" className={styles.toggle} aria-expanded={open}
        aria-label={`Rate interest in ${title}`}
        onClick={() => open ? dismiss() : arm()}>
        <span className={styles.ratingGlyph} aria-hidden="true">◌</span>
        <span>{savedScore ? `${savedScore}/10 interest` : 'Rate interest'}</span>
      </button>
      {open ? (
        <div className={styles.panel} aria-label="Interest rating controls">
          <div ref={wheelRef} className={styles.wheel}
            role="slider" tabIndex={0} aria-label={`Interest level for ${title}`}
            aria-valuemin={1} aria-valuemax={10} aria-valuenow={draft}
            aria-valuetext={`${draft} of 10: ${interestScoreLabel(draft)}`}
            onKeyDown={onKeyDown}
            style={{ '--rating-arc': (draft * 10) + '%' } as CSSProperties}>
            <strong aria-hidden="true">{String(draft).padStart(2, '0')}</strong>
            <span aria-hidden="true">/10</span>
          </div>
          <div className={styles.controls}>
            <p><strong>{interestScoreLabel(draft)}.</strong> Turn the wheel over the dial, use arrow keys, or drag the slider. Normal scrolling is unchanged.</p>
            <input type="range" min={1} max={10} step={1} value={draft}
              aria-label={`Set interest level for ${title}`}
              onChange={(event) => { setDraft(Number(event.target.value)); setViaWheel(false); }}/>
            <div className={styles.actions}>
              <button type="button" onClick={dismiss}>Cancel</button>
              <button type="button" className={styles.commit} onClick={() => {
                onSave(draft, viaWheel ? 'wheel' : 'slider');
                dismiss();
              }}>Save {draft}/10</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
