'use client';

import dynamic from 'next/dynamic';
import { forwardRef, useEffect, useState } from 'react';
import { ChevronDown, FlaskConical, LayoutGrid, Rows3, X } from 'lucide-react';
import { setFrontierClientQuery } from '@/lib/frontier/vector/clientQuery';
import type { FrontierLayoutMode, FrontierRealm, FrontierView } from '@/lib/frontier/types';
import styles from './frontier-utility-dock.module.css';

const FrontierExperimentalControls = dynamic(
  () => import('./FrontierExperimentalControls').then((module) => module.FrontierExperimentalControls),
  { ssr: false },
);

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
  className = '',
}: {
  value: string;
  options: Option[];
  label: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`${styles.selectWrap} ${className}`}>
      <span className={styles.srOnly}>{label}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={10} aria-hidden="true" />
    </label>
  );
}

/**
 * The reader dock intentionally contains only cheap controls.
 *
 * Camera/reaction inference, Sensor QC polling, and WebAudio live in the
 * dynamically loaded Lab chunk and do not enter the cold reading lifecycle.
 * The finite reader has no document scroll, so the old scroll/pointermove
 * auto-hide loop is deliberately absent as well.
 */
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
  const [labOpen, setLabOpen] = useState(false);

  useEffect(() => {
    setFrontierClientQuery(view === 'explore' ? (activeSearch ?? '') : '');
  }, [activeSearch, view]);

  useEffect(() => () => setFrontierClientQuery(''), []);

  const feedView = view === 'today' || view === 'explore';
  const layoutView = feedView || view === 'saved';

  return (
    <div
      ref={forwardedRef}
      className={styles.dock}
      aria-label="FRONTIER utility dock"
      data-frontier-dock-runtime="reader-core"
      data-frontier-lab-mounted={labOpen ? 'true' : 'false'}
    >
      <DockSelect
        value={view}
        label="View"
        options={VIEW_OPTIONS}
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
            onChange={(value) => onRealmChange(value as FrontierRealm)}
            className={styles.realmSelect}
          />
          <DockSelect
            value={category}
            label="Category"
            options={categoryOptions}
            onChange={onCategoryChange}
            className={styles.categorySelect}
          />
          <DockSelect
            value={format}
            label="Format"
            options={formatOptions}
            onChange={onFormatChange}
            className={styles.formatSelect}
          />
        </>
      ) : null}

      {activeSearch && view === 'explore' ? (
        <span className={styles.queryChip} title={activeSearch}>
          <span>{activeSearch}</span>
          {onClearSearch ? (
            <button
              type="button"
              onClick={onClearSearch}
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
              onClick={() => onLayoutChange('desk')}
              aria-label="Grid layout"
              aria-pressed={layoutMode === 'desk'}
              title="Grid"
            ><LayoutGrid size={13} /></button>
            <button
              type="button"
              className={layoutMode === 'feed' ? styles.activeLayout : ''}
              onClick={() => onLayoutChange('feed')}
              aria-label="List layout"
              aria-pressed={layoutMode === 'feed'}
              title="List"
            ><Rows3 size={13} /></button>
          </div>
        </>
      ) : null}

      <span className={styles.airGap} aria-hidden="true" />
      <button
        type="button"
        className={`${styles.labToggle} ${labOpen ? styles.labToggleActive : ''}`}
        onClick={() => setLabOpen((open) => !open)}
        aria-label={labOpen ? 'Close FRONTIER Lab' : 'Open FRONTIER Lab'}
        aria-expanded={labOpen}
        title="Experimental controls"
      >
        <FlaskConical size={12} aria-hidden="true" />
        <span>Lab</span>
      </button>

      {labOpen ? <FrontierExperimentalControls feedActive={feedView} /> : null}
    </div>
  );
});
