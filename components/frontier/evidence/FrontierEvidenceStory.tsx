'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Expand, Minimize, FileText, Images, ShieldCheck } from 'lucide-react';
import type { StoryManifest, EvidenceRecord } from '@/lib/frontier/evidence/schema';
import { sourceChapterMap } from '@/lib/frontier/evidence/sourceChapterMap';
import styles from './frontier-evidence-story.module.css';

export type StoryFigure = Extract<EvidenceRecord, { type: 'figure' }>;
type Props = {
  manifest: StoryManifest;
  title: string;
  summary?: string;
  /** Manifest-keyed URLs generated and verified server-side. Never raw publisher paths. */
  assets: Record<string, string>;
  syntheticFixture?: boolean;
};

function vettedAssetUrl(src: string | undefined): string | null {
  if (!src || !src.startsWith('/') || src.startsWith('//') || src.includes('\\')) return null;
  try {
    const url = new URL(src, 'https://frontier.local');
    return url.origin === 'https://frontier.local' && !url.pathname.split('/').includes('..')
      && !url.search && !url.hash ? url.pathname : null;
  } catch {
    return null;
  }
}

export function FrontierEvidenceStory({ manifest, title, summary, assets, syntheticFixture = false }: Props) {
  const chapters = sourceChapterMap(manifest);
  const figureScene = manifest.scenes.find((scene) => scene.type === 'original-figure');
  const indexed = new Map(manifest.evidence.map((evidence) => [evidence.id, evidence]));
  const figures: StoryFigure[] = (figureScene?.evidenceIds ?? [])
    .map((id) => indexed.get(id))
    .filter((entry): entry is StoryFigure => entry?.type === 'figure' && entry.rights.display === 'permitted');
  const firstChapter = chapters.find((chapter) =>
    chapter.sections.some((section) => section.figureIds.includes(figures[0]?.id ?? '')))
    ?.id ?? (figures.length ? '' : chapters[0]?.id ?? '');

  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedChapter, setSelectedChapter] = useState<string>(firstChapter);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);

  const index = Math.min(activeIndex, Math.max(0, figures.length - 1));
  const activeChapter = chapters.find((chapter) => chapter.id === selectedChapter);
  const chapterFigureIds = new Set(activeChapter?.sections.flatMap((section) => section.figureIds) ?? []);
  // An unillustrated source section must never inherit another section's
  // image and imply that it supports the selected chapter.
  const currentFigure = figures[index];
  const figure = currentFigure && (!selectedChapter || chapterFigureIds.has(currentFigure.id))
    ? currentFigure : undefined;
  const chooseChapter = (id: string) => {
    setSelectedChapter(id);
    setExpanded(false);
    const chapter = chapters.find((item) => item.id === id);
    const firstFigureId = chapter?.sections.flatMap((section) => section.figureIds)[0];
    if (!firstFigureId) return;
    const matched = figures.findIndex((item) => item.id === firstFigureId);
    if (matched >= 0) setActiveIndex(matched);
  };
  const imageUrl = figure ? vettedAssetUrl(assets[figure.assetKey]) : null;
  const imageAvailable = Boolean(figure && imageUrl && !failed.includes(figure.id));
  const advance = (delta: number) => {
    if (!figures.length) return;
    const nextIndex = (index + delta + figures.length) % figures.length;
    const next = figures[nextIndex];
    const relatedChapter = chapters.find((chapter) =>
      chapter.sections.some((section) => section.figureIds.includes(next.id)));
    setSelectedChapter(relatedChapter?.id ?? '');
    setExpanded(false);
    setActiveIndex(nextIndex);
  };

  return (
    <main className={styles.page} data-frontier-story="verified" data-story-state={manifest.state}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <a href="/frontier" className={styles.back}><ArrowLeft size={14} aria-hidden="true"/> FRONTIER</a>
          <span className={styles.edition}>RESEARCH / EVIDENCE-BASED EXPLANATION</span>
          <span className={styles.revision}>SOURCE REVISION {manifest.source.revision}</span>
        </header>

        <div className={styles.headlineBlock}>
          {syntheticFixture ? <span className={styles.testLabel}>SYNTHETIC VISUAL QA FIXTURE · NOT EXPERIMENTAL EVIDENCE</span> : null}
          <p className={styles.eyebrow}>Original research · {manifest.source.publisher}</p>
          <h1>{title}</h1>
          {summary ? <p className={styles.summary}>{summary}</p> : null}
          <div className={styles.provenance}>
            <span><ShieldCheck size={15} aria-hidden="true"/> Source-linked evidence</span>
            <span>{figures.length} approved display {figures.length === 1 ? 'figure' : 'figures'}</span>
            <a href={manifest.source.url} target="_blank" rel="noopener noreferrer">
              Read original paper <ArrowUpRight size={14} aria-hidden="true"/>
            </a>
          </div>
        </div>

        <div className={styles.storyGrid}>
          <section className={styles.stage} aria-label="Original scientific figures">
            <div className={styles.stageTop}>
              <div className={styles.sectionTitle}><Images size={17} aria-hidden="true"/> ORIGINAL SOURCE MATERIAL</div>
              <span>{figure ? String(index + 1).padStart(2, '0') + ' / ' + String(figures.length).padStart(2, '0') : selectedChapter ? 'NO FIGURE IN CHAPTER' : 'NO QUALIFIED FIGURES'}</span>
            </div>
            {figure && figureScene ? (
              <>
                <div className={styles.frame} data-figure-status={imageAvailable ? 'ready' : 'unavailable'}>
                  {imageAvailable ? (
                    <Image key={figure.assetKey} src={imageUrl!} alt={figure.alt} fill unoptimized
                      priority={index === 0} sizes="(max-width: 860px) 100vw, 60vw"
                      className={expanded ? styles.figureExpanded : styles.figureImage}
                      onError={() => setFailed((current) => [...new Set([...current, figure.id])])}/>
                  ) : (
                    <div className={styles.frameEmpty} role="status">
                      <FileText size={29} strokeWidth={1.2} aria-hidden="true"/>
                      <strong>Original figure unavailable</strong>
                      <span>The source and caption remain accessible. No replacement graphic is generated.</span>
                    </div>
                  )}
                  {imageAvailable ? (
                    <button className={styles.zoom} type="button" aria-pressed={expanded}
                      aria-label={expanded ? 'Fit original figure to stage' : 'Magnify original figure'}
                      onClick={() => setExpanded((value) => !value)}>
                      {expanded ? <Minimize size={15} aria-hidden="true"/> : <Expand size={15} aria-hidden="true"/>}
                      {expanded ? 'Fit image' : 'Inspect image'}
                    </button>
                  ) : null}
                </div>
                <div className={styles.figureControls}>
                  <div className={styles.figureNumber}>FIGURE {String(index + 1).padStart(2, '0')}</div>
                  {figures.length > 1 ? (
                    <div className={styles.arrows}>
                      <button type="button" onClick={() => advance(-1)} aria-label="Previous original figure">
                        <ChevronLeft size={18} aria-hidden="true"/>
                      </button>
                      <button type="button" onClick={() => advance(1)} aria-label="Next original figure">
                        <ChevronRight size={18} aria-hidden="true"/>
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className={styles.caption} aria-live="polite">
                  <p>{figure.caption}</p>
                  <span className={styles.sourceRecord}>Source-reported figure · {figure.rights.attribution || manifest.source.publisher}</span>
                  <a href={figure.locator.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Inspect at publisher <ArrowUpRight size={15} aria-hidden="true"/>
                  </a>
                </div>
              </>
            ) : (
              <div className={styles.emptyStage}>
                <FileText size={30} strokeWidth={1.2} aria-hidden="true"/>
                <h2>{selectedChapter ? 'No figure linked to this chapter' : 'Start with the original source'}</h2>
                <p>{selectedChapter
                  ? 'This section has no approved original figure associated with it. Follow the source heading to inspect its actual material.'
                  : 'This story has no rights-cleared, source-verified figure available for display. Read the original publisher document instead.'}</p>
                <a href={activeChapter?.sections[0]?.sourceUrl ?? manifest.source.url}
                  target="_blank" rel="noopener noreferrer">Open original section <ArrowUpRight size={14} aria-hidden="true"/></a>
              </div>
            )}
          </section>

          <aside className={styles.narrative} aria-label="Guided research explanation">
            <span className={styles.narrativeOverline}>YOUR READING GUIDE</span>
            <h2>From source to understanding</h2>
            {chapters.length ? (
              <section className={styles.sourceMap} aria-label="Original publication outline">
                <p className={styles.outlineExplain}>Explore the published section headings. These links are source navigation, not inferred study conclusions.</p>
                <div className={styles.chapterTabs} role="group" aria-label="Research chapters">
                  {chapters.map((chapter, chapterIndex) => (
                    <button type="button" key={chapter.id} className={styles.chapterTab}
                      aria-pressed={selectedChapter === chapter.id}
                      onClick={() => chooseChapter(chapter.id)}>
                      <span>{String(chapterIndex + 1).padStart(2, '0')}</span>{chapter.shortLabel}
                    </button>
                  ))}
                </div>
                {chapters.filter((chapter) => chapter.id === selectedChapter).map((chapter) => (
                  <div className={styles.chapterDetail} key={chapter.id}
                    data-selected-source-chapter={chapter.id}>
                    <h3>{chapter.label}</h3>
                    <ul className={styles.sourceSections}>
                      {chapter.sections.map((section) => (
                        <li key={section.id}>
                          <a href={section.sourceUrl} target="_blank" rel="noopener noreferrer">
                            {section.title}<ArrowUpRight size={13} aria-hidden="true"/>
                          </a>
                          {section.figureIds.length > 0 ? (
                            <span>{section.figureIds.length} linked original {section.figureIds.length === 1 ? 'figure' : 'figures'}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ) : (
              <div className={styles.step}>
                <span>01</span><div><strong>Understand the question</strong>
                  <p>{summary || 'Open the original paper for the research question and reported findings. No summary has been inferred.'}</p>
                </div>
              </div>
            )}
            {!chapters.length ? (
              <>
                <div className={styles.step}>
                  <span>02</span><div><strong>Inspect the evidence</strong>
                    <p>{figure ? 'Examine the original publisher figure and caption. Source claims are not independently reproduced measurements.' : 'No figure has passed the rights and provenance gates for this source yet.'}</p>
                  </div>
                </div>
                <div className={styles.step}>
                  <span>03</span><div><strong>Verify the original</strong>
                    <p>Follow the citation to see its scientific context, methods, and limitations at the publisher.</p>
                  </div>
                </div>
              </>
            ) : null}
            <a href={manifest.source.url} target="_blank" rel="noopener noreferrer" className={styles.primaryLink}>
              Read the original document <ArrowUpRight size={16} aria-hidden="true"/>
            </a>
            <div className={styles.evidenceNote}>
              <strong>Evidence status</strong>
              <p>Publisher-reported material. Every displayed image must have explicit reuse permission and an immutable asset hash.</p>
            </div>
          </aside>
        </div>
        <footer className={styles.footer}>
          <span>FRONTIER / A PERSONAL ATLAS OF IDEAS</span>
          <span>Source revision {manifest.source.revision} · Extractor {manifest.extractorVersion}</span>
        </footer>
      </div>
    </main>
  );
}
