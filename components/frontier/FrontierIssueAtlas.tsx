import { ArrowUpRight } from 'lucide-react';
import { JOURNAL_SECTIONS, type JournalSectionId } from '@/lib/frontier/journalSections';
import styles from './frontier-journal.module.css';

type Props = {
  counts: Record<JournalSectionId, number>;
  activeSection: JournalSectionId;
  onSelect: (section: JournalSectionId) => void;
};

/**
 * Navigable atlas of the actual available-source inventory. Multiple
 * disciplinary lenses may contain the same story: bar widths are local
 * coverage indicators, never segments of a fabricated 100% pie.
 * No network, browser graphics, image bytes, or additional feed copies.
 */
export function FrontierIssueAtlas({ counts, activeSection, onSelect }: Props) {
  const lenses = JOURNAL_SECTIONS.filter((section) => section.id !== 'for-you');
  const maxCount = Math.max(1, ...lenses.map((section) => counts[section.id]));

  return (
    <section className={styles.issueAtlas} aria-label="Explore current stories by subject">
      <div className={styles.issueAtlasIntro}>
        <span className={styles.issueAtlasEyebrow}>DISCOVER / FOLLOW A THREAD</span>
        <h3>Five windows<br/>on what’s next.</h3>
        <p>Browse the disciplines or follow the threads between them.
          Coverage reflects real available sources, and one story can belong to several lenses.</p>
      </div>
      <div className={styles.issueAtlasLenses}>
        {lenses.map((section, index) => {
          const count = counts[section.id];
          return (
            <button key={section.id} type="button" data-issue-lens={section.id}
              className={styles.issueAtlasLens} aria-pressed={section.id === activeSection}
              aria-label={`${section.label}: ${count} available stories`}
              disabled={count === 0} onClick={() => onSelect(section.id)}>
              <span className={styles.issueAtlasLabel}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{section.label}</span>
              </span>
              <strong className={styles.issueAtlasCount}>{count}</strong>
              <span className={styles.issueAtlasMeter} aria-hidden="true">
                <span style={{ width: `${Math.round(100 * count / maxCount)}%` }}/>
              </span>
              <span className={styles.issueAtlasOpen}>
                {count ? 'Open this lens' : 'No current stories'}
                {count ? <ArrowUpRight size={13} aria-hidden="true"/> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
