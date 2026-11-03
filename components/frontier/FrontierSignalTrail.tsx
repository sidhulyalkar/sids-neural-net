'use client';

import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, FocusEvent, ChangeEvent } from 'react';
import { SIGNAL_TRAIL_PATH, SIGNAL_TRAIL_POINTS, signalScoreLabel, validSignalScore } from '@/lib/frontier/signalTrail';
import styles from './frontier-signal-trail.module.css';

type Props = {
  /** A keyed instance is mounted for each focused article, never for hidden cards. */
  itemId: string;
  rating?: number;
  onRate: (score: number) => void;
  notice: string;
};

const COMMIT_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

/** A tiny signal constellation with a full native, 1–10 accessible range.
 * Press/tap or drag to select, release to commit; keyboard changes commit on
 * key-up. No duration-derived rating or extra precision dialog. */
export function FrontierSignalTrail({ itemId, rating, onRate, notice }: Props) {
  const instructionId = useId();
  const [draft, setDraft] = useState<number | null>(null);
  const lastCommitRef = useRef<{ score: number; at: number } | null>(null);
  const selected = draft ?? rating ?? null;
  const numericValue = selected ?? 5;
  const points = selected ? SIGNAL_TRAIL_POINTS.slice(0, selected) : [];
  const state = draft !== null && draft !== rating ? 'editing' : rating ? 'rated' : 'idle';

  const commit = (score: number) => {
    if (!validSignalScore(score)) return;
    const last = lastCommitRef.current;
    // A pointer release can also synthesize click and blur; save just once.
    if (last && last.score === score && performance.now() - last.at < 250) return;
    lastCommitRef.current = { score, at: performance.now() };
    setDraft(score);
    onRate(score);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(Number(event.currentTarget.value));
  };
  const onPointerUp = (event: PointerEvent<HTMLInputElement>) => {
    commit(Number(event.currentTarget.value));
  };
  const onKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    if (COMMIT_KEYS.has(event.key)) commit(Number(event.currentTarget.value));
  };
  const onBlur = (event: FocusEvent<HTMLInputElement>) => {
    // Screen readers and voice controls may change a native range without
    // producing pointerup/keyup. Preserve that edit when focus leaves.
    if (draft !== null && draft !== rating) commit(Number(event.currentTarget.value));
  };

  return (
    <div className={styles.signal} data-frontier-signal={state} data-frontier-rating={rating ?? 'unrated'} data-frontier-article={itemId}>
      <div className={styles.heading}>
        <label className={styles.label} htmlFor={instructionId}>How interesting?</label>
        <div className={styles.score} aria-hidden="true">
          {selected ?? '·'}<span>/10</span>
        </div>
      </div>
      <div className={styles.trail}>
        <svg className={styles.graphic} viewBox="0 0 360 78" preserveAspectRatio="none"
          aria-hidden="true" focusable="false">
          <polyline className={styles.baseLine} points={SIGNAL_TRAIL_PATH} fill="none" />
          {points.length > 1 ? <polyline className={styles.activeLine}
            points={points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" /> : null}
          {SIGNAL_TRAIL_POINTS.map(([x, y], index) => (
            <g key={index} data-active={selected !== null && index < selected ? 'true' : 'false'}>
              <circle className={styles.halo} cx={x} cy={y} r={index < (selected ?? 0) ? 9 : 6} />
              <circle className={styles.point} cx={x} cy={y} r={index < (selected ?? 0) ? 4.7 : 3.3} />
            </g>
          ))}
        </svg>
        <input id={instructionId} className={styles.input}
          type="range" min={1} max={10} step={1} value={numericValue}
          aria-label="Rate how interesting this story is"
          aria-describedby={instructionId + '-hint'}
          aria-valuetext={selected === null
            ? 'Not rated. Select a score from one to ten.'
            : `${selected} of 10: ${signalScoreLabel(selected)}`}
          onChange={onChange}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDraft(null)}
          onKeyUp={onKeyUp}
          onBlur={onBlur}
          onClick={(event) => {
            // Screen-reader activation can synthesize a click without pointer.
            if (event.detail === 0) commit(Number(event.currentTarget.value));
          }}
        />
      </div>
      <div className={styles.bottom}>
        <span id={instructionId + '-hint'} className={styles.hint}>
          {selected === null ? 'Tap a point or drag · ← → to adjust'
            : draft !== null && draft !== rating ? 'Release to save'
              : signalScoreLabel(selected)}
        </span>
        <span className={styles.saved} aria-hidden="true">{rating ? 'Rated' : 'Not rated'}</span>
      </div>
      <span className={styles.notice} role="status" aria-live="polite">{notice}</span>
    </div>
  );
}
