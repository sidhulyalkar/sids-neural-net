'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Atom, Code2, Gamepad2, Leaf, Music2, Snowflake } from 'lucide-react';
import type { FrontierMotif, FrontierSwarmSprite } from '@/lib/frontier/ambientSprites';
import styles from './frontier-ambient-sprite.module.css';

type Props = {
  motif: FrontierMotif;
  articleTitle: string;
  spec: FrontierSwarmSprite;
  clear: boolean;
  onPop: () => void;
  onExit: (id: number) => void;
};

function SoccerBall() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinejoin="round" strokeLinecap="round">
    <circle cx="24" cy="24" r="19"/>
    <path d="m24 14 9 6-3.4 10H18.4L15 20l9-6ZM24 14l-2-8m11 14 8-3m-11 13 6 9m-17-9-6 9m2-19-8-3"/>
    <path d="m18.4 30-7 7m18.2-7 7 7m-21.6-17 1-8m18 8-1-8"/>
  </svg>;
}

function NewspaperBug() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 16c-3-4-4-7-4-11m8 11c3-4 4-7 4-11"/>
    <path d="M17 16c-6 5-9 14-7 22 5 5 11 4 14 1V17Zm14 0c6 5 9 14 7 22-5 5-11 4-14 1V17Z" fill="currentColor" fillOpacity=".11"/>
    <path d="M24 17v22M14 25h6m-5 6h5m8-6h6m-6 6h5"/>
    <path d="m11 21-5-3m4 12-6 1m33-10 5-3m-4 12 6 1"/>
    <circle cx="24" cy="14" r="4" fill="currentColor" fillOpacity=".2"/>
    <path d="m17 39 4 5m10-5-4 5"/>
  </svg>;
}

function MotifGlyph({ motif }: { motif: FrontierMotif }) {
  switch (motif) {
    case 'soccer': return <SoccerBall/>;
    case 'snow': return <Snowflake strokeWidth={1.6}/>;
    case 'neuron': return <Atom strokeWidth={1.6}/>;
    case 'code': return <Code2 strokeWidth={1.65}/>;
    case 'game': return <Gamepad2 strokeWidth={1.65}/>;
    case 'music': return <Music2 strokeWidth={1.65}/>;
    case 'leaf': return <Leaf strokeWidth={1.6}/>;
    default: return <NewspaperBug/>;
  }
}

const MOTIF_LABEL: Record<FrontierMotif, string> = {
  newsprint: 'newspaper bug', soccer: 'soccer ball', snow: 'snowflake',
  neuron: 'orbit', code: 'code sprite', game: 'game sprite',
  music: 'music note', leaf: 'leaf',
};

export function FrontierAmbientSprite({ motif, articleTitle, spec, clear, onPop, onExit }: Props) {
  const [popped, setPopped] = useState(false);
  const poppedRef = useRef(false);
  const style = {
    '--x': `${spec.x}%`,
    '--y': `${spec.y}%`,
    '--speed': `${spec.duration}s`,
    '--phase': `${spec.delay}s`,
    '--size': `${spec.size}px`,
  } as CSSProperties;

  useEffect(() => {
    if (!clear || poppedRef.current) return;
    // A clear-all gesture produces a little cascading constellation of pops.
    const timeout = window.setTimeout(() => {
      if (poppedRef.current) return;
      poppedRef.current = true;
      setPopped(true);
    }, spec.id * 42);
    return () => window.clearTimeout(timeout);
  }, [clear, spec.id]);

  return (
    <button type="button" data-frontier-sprite={motif} data-flight-pattern={spec.pattern}
      data-popped={popped ? 'true' : 'false'} data-color-step={spec.colorStep}
      className={`${styles.sprite} ${styles[spec.pattern]} ${popped ? styles.popped : ''}`}
      style={style}
      aria-label={`Pop ${MOTIF_LABEL[motif]} near ${articleTitle}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (poppedRef.current) return;
        poppedRef.current = true;
        setPopped(true);
        onPop();
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && poppedRef.current && event.animationName.includes('popOut'))
          onExit(spec.id);
      }}>
      <span className={styles.body}><MotifGlyph motif={motif}/></span>
      <span className={styles.burst} aria-hidden="true"><i/><i/><i/><i/><i/><i/></span>
    </button>
  );
}
