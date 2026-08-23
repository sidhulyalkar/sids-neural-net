'use client';

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import type { ForwardedRef } from 'react';
import { ChevronDown, LayoutGrid, Rows3, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { FRONTIER_PINNED_TOPICS } from '@/lib/frontier/interests';
import { setFrontierClientQuery } from '@/lib/frontier/vector/clientQuery';
import type { FrontierLayoutMode, FrontierRealm, FrontierView } from '@/lib/frontier/types';
import { useUIFrequencies } from './audio/useUIFrequencies';
import { launchFrontierTopicSearch } from './frontierSearchBridge';
import styles from './frontier-utility-dock.module.css';

type Option = { value: string; label: string };

type Props = {
  view: FrontierView;
  realm: FrontierRealm;
  layoutMode: FrontierLayoutMode;
  category: string;
  format: string;
  categoryOptions: Option[];
  formatOptions: Option[];
  activeSearch?: string;
  onViewChange: (view: FrontierView) => void;
  onRealmChange: (realm: FrontierRealm) => void;
  onLayoutChange: (mode: FrontierLayoutMode) => void;
  onCategoryChange: (category: string) => void;
  onFormatChange: (format: string) => void;
  onClearSearch?: () => void;
};

const VIEW_OPTIONS: Array<{ value: FrontierView; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'explore', label: 'Browse' },
  { value: 'saved', label: 'Saved' },
  { value: 'history', label: 'Seen' },
  { value: 'map', label: 'Radar' },
];

const REALM_OPTIONS: Array<{ value: FrontierRealm; label: string }> = [
  { value: 'all', label: 'For You' },
  { value: 'learn', label: 'Brainfood' },
  { value: 'play', label: 'After Hours' },
];

function DockSelect({
  value,
  options,
  label,
  onChange,
  onInteraction,
  className = '',
}: {
  value: string;
  options: Option[];
  label: string;
  onChange: (value: string) => void;
  onInteraction?: () => void;
  className?: string;
}) {
  return (
    <label className={`${styles.selectWrap} ${className}`}>
      <span className={styles.srOnly}>{label}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(event) => {
          onInteraction?.();
          onChange(event.target.value);
        }}
      >
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={10} aria-hidden="true" />
    </label>
  );
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export const FrontierUtilityDock = forwardRef<HTMLDivElement, Props>(function FrontierUtilityDock({
  view,
  realm,
  layoutMode,
  category,
  format,
  categoryOptions,
  formatOptions,
  activeSearch,
  onViewChange,
  onRealmChange,
  onLayoutChange,
  onCategoryChange,
  onFormatChange,
  onClearSearch,
}, forwardedRef) {
  const dockRef = useRef<HTMLDivElement | null>(null);
  const interactingRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const driftIndexRef = useRef(0);
  const [hidden, setHidden] = useState(false);
  const { muted, toggleMuted, playDockClick } = useUIFrequencies();

  const setDockRef = useCallback((node: HTMLDivElement | null) => {
    dockRef.current = node;
    assignRef(forwardedRef, node);
  }, [forwardedRef]);

  useEffect(() => {
    setFrontierClientQuery(view === 'explore' ? (activeSearch ?? '') : '');
  }, [activeSearch, view]);

  useEffect(() => () => setFrontierClientQuery(''), []);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const revealNearEdge = (event: PointerEvent) => {
      if (event.clientY >= window.innerHeight - 96) setHidden(false);
    };

    const onScroll = () => {
      if (rafRef.current !== undefined) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = undefined;
        const nextY = window.scrollY;
        const delta = nextY - lastScrollYRef.current;
        lastScrollYRef.current = nextY;

        if (nextY < 100) {
          setHidden(false);
          return;
        }
        if (interactingRef.current) return;
        if (delta > 7) setHidden(true);
        else if (delta < -5) setHidden(false);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', revealNearEdge, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', revealNearEdge);
      if (rafRef.current !== undefined) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const feedView = view === 'today' || view === 'explore';
  const layoutView = feedView || view === 'saved';

  const toggleAudio = () => {
    if (muted) {
      toggleMuted();
      playDockClick();
    } else {
      playDockClick();
      toggleMuted();
    }
  };

  const drift = () => {
    playDockClick();
    if (!FRONTIER_PINNED_TOPICS.length) return;

    const current = (activeSearch ?? '').toLowerCase();
    for (let attempt = 0; attempt < FRONTIER_PINNED_TOPICS.length; attempt += 1) {
      const index = driftIndexRef.current % FRONTIER_PINNED_TOPICS.length;
      driftIndexRef.current = (driftIndexRef.current + 7) % FRONTIER_PINNED_TOPICS.length;
      const candidate = FRONTIER_PINNED_TOPICS[index];
      if (candidate.label.toLowerCase() === current) continue;
      launchFrontierTopicSearch(candidate.label);
      return;
    }
  };

  return (
    <div
      ref={setDockRef}
      className={`${styles.dock} ${hidden ? styles.dockHidden : ''}`}
      aria-label="FRONTIER utility dock"
      onPointerEnter={() => {
        interactingRef.current = true;
        setHidden(false);
      }}
      onPointerLeave={() => { interactingRef.current = false; }}
      onFocusCapture={() => {
        interactingRef.current = true;
        setHidden(false);
      }}
      onBlurCapture={(event) => {
        if (!dockRef.current?.contains(event.relatedTarget as Node | null)) interactingRef.current = false;
      }}
    >
      <DockSelect
        value={view}
        label="View"
        options={VIEW_OPTIONS}
        onInteraction={playDockClick}
        onChange={(value) => onViewChange(value as FrontierView)}
        className={styles.viewSelect}
      />

      {feedView ? (
        <>
          <span className={styles.airGap} aria-hidden="true" />
          <DockSelect
            value={realm}
            label="Perspective"
            options={REALM_OPTIONS}
            onInteraction={playDockClick}
            onChange={(value) => onRealmChange(value as FrontierRealm)}
            className={styles.realmSelect}
          />
          <DockSelect
            value={category}
            label="Category"
            options={categoryOptions}
            onInteraction={playDockClick}
            onChange={onCategoryChange}
            className={styles.categorySelect}
          />
          <DockSelect
            value={format}
            label="Format"
            options={formatOptions}
            onInteraction={playDockClick}
            onChange={onFormatChange}
            className={styles.formatSelect}
          />
          <div className={styles.layoutToggle} aria-label="Serendipity controls">
            <button
              type="button"
              className={styles.activeLayout}
              onClick={drift}
              aria-label="Signal Drift into a different interest"
              title="Signal Drift · jump somewhere else in your interest graph"
              data-frontier-signal-drift
            ><Sparkles size={13} /></button>
          </div>
        </>
      ) : null}

      {activeSearch && view === 'explore' ? (
        <span className={styles.queryChip} title={activeSearch} data-frontier-query-chip>
          <span>{activeSearch}</span>
          {onClearSearch ? (
            <button
              type="button"
              onClick={() => {
                playDockClick();
                onClearSearch();
              }}
              aria-label={`Clear search ${activeSearch}`}
            ><X size={10} /></button>
          ) : null}
        </span>
      ) : null}

      {layoutView ? (
        <>
          <span className={styles.airGap} aria-hidden="true" />
          <div className={styles.layoutToggle} aria-label="Content layout">
            <button
              type="button"
              className={layoutMode === 'desk' ? styles.activeLayout : ''}
              onClick={() => {
                playDockClick();
                onLayoutChange('desk');
              }}
              aria-label="Grid layout"
              aria-pressed={layoutMode === 'desk'}
              title="Grid"
            ><LayoutGrid size={13} /></button>
            <button
              type="button"
              className={layoutMode === 'feed' ? styles.activeLayout : ''}
              onClick={() => {
                playDockClick();
                onLayoutChange('feed');
              }}
              aria-label="List layout"
              aria-pressed={layoutMode === 'feed'}
              title="List"
            ><Rows3 size={13} /></button>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className={styles.audioToggle}
        onClick={toggleAudio}
        aria-label={muted ? 'Enable FRONTIER interface audio' : 'Mute FRONTIER interface audio'}
        aria-pressed={muted}
        title={muted ? 'Audio off' : 'Audio on'}
      >
        {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
      </button>
    </div>
  );
});
