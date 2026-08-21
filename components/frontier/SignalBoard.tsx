'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Grip, LayoutGrid, Rows3 } from 'lucide-react';
import type { FrontierItem } from '@/lib/frontier/types';
import styles from './frontier-minimal.module.css';

export type SignalLayoutMode = 'desk' | 'feed';

type Position = { x: number; y: number; z: number; rotate: number };
type DragState = { id: string; pointerId: number; startX: number; startY: number; originX: number; originY: number };

type Props = {
  items: FrontierItem[];
  renderCard: (item: FrontierItem, mode: SignalLayoutMode) => ReactNode;
  empty?: ReactNode;
  compact?: boolean;
};

function hash(value: string): number {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function defaultPosition(item: FrontierItem, index: number): Position {
  const seed = hash(item.id);
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: 18 + column * 252 + ((seed % 43) - 21),
    y: 26 + row * 178 + (((seed >>> 5) % 31) - 15),
    z: index + 1,
    rotate: ((seed % 9) - 4) * 0.22,
  };
}

function tidyPositions(items: FrontierItem[]): Record<string, Position> {
  return Object.fromEntries(items.map((item, index) => [item.id, defaultPosition(item, index)]));
}

export function SignalBoard({ items, renderCard, empty, compact = false }: Props) {
  const [mode, setMode] = useState<SignalLayoutMode>('desk');
  const [positions, setPositions] = useState<Record<string, Position>>(() => tidyPositions(items));
  const [drag, setDrag] = useState<DragState | null>(null);
  const topZ = useRef(items.length + 5);

  useEffect(() => {
    const saved = window.localStorage.getItem('frontier-layout-mode');
    const preferred = saved === 'feed' || saved === 'desk' ? saved : 'desk';
    setMode(window.innerWidth < 720 ? 'feed' : preferred);
  }, []);

  useEffect(() => {
    setPositions((current) => {
      const next = { ...current };
      items.forEach((item, index) => {
        if (!next[item.id]) next[item.id] = defaultPosition(item, index);
      });
      return next;
    });
  }, [items]);

  const deskHeight = useMemo(() => {
    const rows = Math.max(1, Math.ceil(items.length / 4));
    return Math.max(compact ? 520 : 650, rows * 190 + 190);
  }, [compact, items.length]);

  const switchMode = (next: SignalLayoutMode) => {
    setMode(next);
    window.localStorage.setItem('frontier-layout-mode', next);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, item: FrontierItem) => {
    if (mode !== 'desk') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = positions[item.id] ?? defaultPosition(item, 0);
    const z = ++topZ.current;
    setPositions((current) => ({ ...current, [item.id]: { ...position, z } }));
    setDrag({
      id: item.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const x = Math.max(-80, drag.originX + event.clientX - drag.startX);
    const y = Math.max(0, drag.originY + event.clientY - drag.startY);
    setPositions((current) => {
      const position = current[drag.id];
      if (!position) return current;
      return { ...current, [drag.id]: { ...position, x, y } };
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag && event.pointerId === drag.pointerId) setDrag(null);
  };

  return (
    <div className={styles.boardShell}>
      <div className={styles.layoutBar} aria-label="Signal layout">
        <button
          type="button"
          className={`${styles.layoutButton} ${mode === 'desk' ? styles.layoutActive : ''}`}
          onClick={() => switchMode('desk')}
          title="Move and overlap signal tiles"
        >
          <LayoutGrid size={13} /> Desk
        </button>
        <button
          type="button"
          className={`${styles.layoutButton} ${mode === 'feed' ? styles.layoutActive : ''}`}
          onClick={() => switchMode('feed')}
          title="Arrange signals into a clean reading feed"
        >
          <Rows3 size={13} /> Feed
        </button>
        {mode === 'desk' ? (
          <button
            type="button"
            className={styles.layoutButton}
            onClick={() => setPositions(tidyPositions(items))}
            title="Return tiles to their starting arrangement"
          >
            Tidy
          </button>
        ) : null}
      </div>

      {!items.length ? empty : mode === 'feed' ? (
        <div className={styles.readingFeed}>
          {items.map((item) => <div key={item.id} className={styles.feedItem}>{renderCard(item, 'feed')}</div>)}
        </div>
      ) : (
        <div className={styles.signalDesk} style={{ height: deskHeight }}>
          {items.map((item, index) => {
            const position = positions[item.id] ?? defaultPosition(item, index);
            return (
              <div
                key={item.id}
                className={styles.floatingTile}
                style={{
                  transform: `translate3d(${position.x}px, ${position.y}px, 0) rotate(${position.rotate}deg)`,
                  zIndex: position.z,
                }}
              >
                <button
                  type="button"
                  className={styles.dragHandle}
                  aria-label={`Move ${item.title}`}
                  title="Drag tile"
                  onPointerDown={(event) => onPointerDown(event, item)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <Grip size={14} />
                </button>
                {renderCard(item, 'desk')}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
