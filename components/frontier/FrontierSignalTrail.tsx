'use client';

import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, FocusEvent, ChangeEvent } from 'react';
import { SIGNAL_TRAIL_PATH, SIGNAL_TRAIL_POINTS, signalScoreAtX, signalScoreLabel, validSignalScore } from '@/lib/frontier/signalTrail';
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
  const pointerActiveRef = useRef(false);
  const keyboardActiveRef = useRef(false);
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

  const fromPointer = (event: PointerEvent<HTMLInputElement>) => {
    const trail = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!trail) return null;
    return signalScoreAtX(event.clientX, trail.left, trail.width);
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    // The native input retains its accessible value. Pointer coordinates
    // determine the graphic's exact node, not browser thumb geometry.
    if (pointerActiveRef.current) return;
    const value = Number(event.currentTarget.value);
    setDraft(value);
    // Some screen-reader/voice commands emit input/change without a matching
    // keyup or pointerup. In that case a score must still be saved.
    if (!keyboardActiveRef.current) commit(value);
  };
  const onPointerDown = (event: PointerEvent<HTMLInputElement>) => {
    if (event.button !== 0) return;
    pointerActiveRef.current = true;
    const score = fromPointer(event);
    if (score !== null) setDraft(score);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* native pointer release still works */ }
  };
  const onPointerMove = (event: PointerEvent<HTMLInputElement>) => {
    if (!pointerActiveRef.current) return;
    const score = fromPointer(event);
    if (score !== null) setDraft((prior) => prior === score ? prior : score);
  };
  const onPointerUp = (event: PointerEvent<HTMLInputElement>) => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    const score = fromPointer(event);
    if (score !== null) commit(score);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no capture to release */ }
  };
  const onPointerCancel = () => {
    pointerActiveRef.current = false;
    setDraft(rating ?? null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (COMMIT_KEYS.has(event.key)) keyboardActiveRef.current = true;
  };
  const onKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!COMMIT_KEYS.has(event.key)) return;
    keyboardActiveRef.current = false;
    commit(Number(event.currentTarget.value));
  };
  const onBlur = (event: FocusEvent<HTMLInputElement>) => {
    keyboardActiveRef.current = false;
    if (!pointerActiveRef.current && draft !== null && draft !== rating) {
      commit(Number(event.currentTarget.value));
    }
  };

  return (
    <div className={styles.signal} data-frontier-signal={state} data-frontier-rating={rating ?? 'unrated'} data-frontier-article={itemId}>
      <div className={styles.heading}>
        <label className={styles.label} htmlFor={instructionId}>How interesting?</label>
        <div className={styles.scoreGroup} aria-hidden="true">
          <span className={styles.interpretation}>{selected === null ? 'Choose your signal' : signalScoreLabel(selected)}</span>
          <span className={styles.score}>{selected ?? '–'}<span>/10</span></span>
        </div>
      </div>
      <div className={styles.trail}>
        <svg className={styles.graphic} viewBox="0 0 360 78" preserveAspectRatio="none"
          aria-hidden="true" focusable="false">
          <polyline className={styles.baseLine} points={SIGNAL_TRAIL_PATH} fill="none" />
          {points.length > 1 ? <polyline className={styles.activeLine}
            points={points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" /> : null}
          {SIGNAL_TRAIL_POINTS.map(([x, y], index) => (
            <g key={index}
              data-active={selected !== null && index < selected ? 'true' : 'false'}
              data-frontier-active-tip={selected !== null && index + 1 === selected ? 'true' : 'false'}>
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onPointerCancel}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={onBlur}
          onClick={(event) => {
            // Screen-reader activation can synthesize a click without pointer.
            if (event.detail === 0) commit(Number(event.currentTarget.value));
          }}
        />
      </div>
      <div className={styles.bottom} id={instructionId + '-hint'}>
        <span className={styles.hint}>1 · Not for me</span>
        <span className={styles.saved}>10 · Fascinating</span>
      </div>
      <span className={styles.notice} role="status" aria-live="polite">{notice}</span>
    </div>
  );
}
