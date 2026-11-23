'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { frontierMotifForItem, frontierSwarmSprites } from '@/lib/frontier/ambientSprites';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierItem } from '@/lib/frontier/types';
import { FrontierAmbientSprite } from './FrontierAmbientSprite';
import styles from './frontier-ambient-sprite.module.css';

export function FrontierArticleSwarm({ item, active, compact }: {
  item: FrontierItem; active: boolean; compact: boolean;
}) {
  const hydrated = useFrontierStore((state) => state.hydrated);
  const cleared = useFrontierStore((state) => Boolean(state.history[item.id]?.ambientClearedAt));
  const [removed, setRemoved] = useState<number[]>([]);
  const [settling, setSettling] = useState(false);
  const appeared = useRef(false);
  const specs = useMemo(() => frontierSwarmSprites(item.id, compact), [item.id, compact]);
  const motif = frontierMotifForItem(item);

  useEffect(() => {
    if (!active || !hydrated || cleared || appeared.current) return;
    appeared.current = true;
    useFrontierStore.getState().recordAmbientAppearances(item, specs.length);
  }, [active, hydrated, cleared, item, specs.length]);

  useEffect(() => {
    if (!settling) return;
    const timeout = window.setTimeout(() => setSettling(false), 850);
    return () => window.clearTimeout(timeout);
  }, [settling]);

  const clearAll = () => {
    if (!hydrated || cleared) return;
    setSettling(true);
    useFrontierStore.getState().recordAmbientClear(item);
  };
  const remove = (id: number) => setRemoved((previous) =>
    previous.includes(id) ? previous : [...previous, id]);

  return (
    <>
      {active && (!cleared || settling) ? (
        <div className={styles.scene} data-frontier-ambient-layer="swarm">
          {specs.filter((sprite) => !removed.includes(sprite.id)).map((sprite) => (
            <FrontierAmbientSprite key={sprite.id} motif={motif} articleTitle={item.title.slice(0, 86)}
              spec={sprite} clear={cleared} onPop={() => useFrontierStore.getState().recordAmbientPop(item)}
              onExit={remove}/>
          ))}
        </div>
      ) : null}
      <button className={styles.clearAll} type="button" data-frontier-clear-article="true"
        data-cleared={cleared ? 'true' : 'false'}
        disabled={!hydrated || cleared}
        aria-label={`Clear all creatures and strongly prioritize ${item.title}`}
        aria-pressed={cleared} onClick={clearAll}>
        <span aria-hidden="true"/>
      </button>
    </>
  );
}
