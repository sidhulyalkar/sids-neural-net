'use client';

import { useState } from 'react';
import type { JournalChapter } from '@/lib/frontier/journalChapters';
import styles from './frontier-journal.module.css';

type Props = { chapters: JournalChapter[] };

/** A lightweight story outline inspired by explanatory scrollytelling:
 * reveals the source's real evidence structure without scroll-jacking,
 * mounting offscreen scenes or inventing data. */
export function FrontierJournalChapters({ chapters }: Props) {
  const [activeId, setActiveId] = useState<string>(chapters[0]?.id ?? 'frontier-story-summary');
  const navigate = (chapter: JournalChapter) => {
    const target = document.getElementById(chapter.id);
    if (!target) return;
    setActiveId(chapter.id);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' });
  };
  return (
    <nav className={styles.chapterMap} aria-label="Story chapters">
      <span className={styles.chapterMapCaption}>In this story</span>
      <div className={styles.chapterSteps}>
        {chapters.map((chapter, index) => (
          <button type="button" key={chapter.id} aria-label={chapter.label}
            aria-current={activeId === chapter.id ? 'step' : undefined}
            onClick={() => navigate(chapter)}>
            <span className={styles.chapterIndex}>{String(index + 1).padStart(2, '0')}</span>
            {chapter.shortLabel}
          </button>
        ))}
      </div>
    </nav>
  );
}
