'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Expand, Minimize, FileText, Images, ShieldCheck } from 'lucide-react';
import type { StoryManifest, EvidenceRecord } from '@/lib/frontier/evidence/schema';
import type { SourceEditorial } from '@/lib/frontier/evidence/editorial';
import { sourceChapterMap } from '@/lib/frontier/evidence/sourceChapterMap';
import { sourcePreview } from '@/lib/frontier/evidence/sourcePreview';
import styles from './frontier-evidence-story.module.css';

export type StoryFigure = Extract<EvidenceRecord, { type: 'figure' }>;
type Props = {
  manifest: StoryManifest;
  title: string;
  summary?: string;
  /** Manifest-keyed URLs generated and verified server-side. Never raw publisher paths. */
  assets: Record<string, string>;
  editorial?: SourceEditorial | null;
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

export function FrontierEvidenceStory({ manifest, title, summary, assets, editorial, syntheticFixture = false }: Props) {
  const chapters = sourceChapterMap(manifest);
  const lead = sourcePreview(summary);
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
  const [mechanismFocus, setMechanismFocus] = useState<'discovery' | 'selection'>('discovery');
  const mechanism = editorial?.mechanisms.find((entry) => entry.id === mechanismFocus);

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
          <span className={styles.edition}>{figures.length ? 'RESEARCH / ORIGINAL FIGURE READER' : 'RESEARCH / ORIGINAL SOURCE READER'}</span>
          <span className={styles.revision}>SOURCE REVISION {manifest.source.revision}</span>
        </header>

        <div className={styles.headlineBlock}>
          {syntheticFixture ? <span className={styles.testLabel}>SYNTHETIC VISUAL QA FIXTURE · NOT EXPERIMENTAL EVIDENCE</span> : null}
          <p className={styles.eyebrow}>Original research · {manifest.source.publisher}</p>
          <h1>{title}</h1>
          {lead ? <p className={styles.summary}>{lead}</p> : null}
          <div className={styles.provenance}>
            <span><ShieldCheck size={15} aria-hidden="true"/> Source-linked evidence</span>
            <span>{figures.length} approved display {figures.length === 1 ? 'figure' : 'figures'}</span>
            <a href={manifest.source.url} target="_blank" rel="noopener noreferrer">
              Read original paper <ArrowUpRight size={14} aria-hidden="true"/>
            </a>
          </div>
        </div>

        {editorial ? (
          <section className={styles.editorialDigest} aria-label="Publisher-reported research highlights"
            data-frontier-editorial-source={editorial.source.id}>
            <div className={styles.digestHead}>
              <div>
                <span className={styles.digestOverline}>THE RESEARCH RECORD / PUBLISHER REPORTED</span>
                <h2>{editorial.question}</h2>
              </div>
              <p>Four source-linked signals. Each number opens its original paper section, and none is an independently replicated result.</p>
            </div>
            <div className={styles.digestGrid}>
              {editorial.signals.map((signal, index) => (
                <article key={signal.id} className={styles.digestSignal}>
                  <span className={styles.digestOrdinal}>{String(index + 1).padStart(2, '0')} / REPORTED</span>
                  <strong className={styles.digestValue}>{signal.value}</strong>
                  <h3>{signal.label}</h3>
                  <p>{signal.detail}</p>
                  <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Check source <ArrowUpRight size={13} aria-hidden="true"/>
                  </a>
                </article>
              ))}
            </div>
            <div className={styles.digestInsight}>
              <div>
                <span className={styles.digestOverline}>{editorial.insight.label}</span>
                <h3>{editorial.insight.title}</h3>
              </div>
              <div>
                <p>{editorial.insight.detail}</p>
                <a href={editorial.insight.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Read the authors’ discussion <ArrowUpRight size={14} aria-hidden="true"/>
                </a>
              </div>
            </div>
          </section>
        ) : null}

        {editorial && mechanism ? (
          <section className={styles.mechanismSection} aria-label="Source-cited AgentSSL mechanism"
            data-frontier-explanation="editorial">
            <div className={styles.mechanismHeading}>
              <div>
                <span className={styles.mechanismKicker}>FIELD GUIDE / THE UNDERLYING MECHANISM</span>
                <h2>Two decisions.<br/>Two very different problems.</h2>
              </div>
              <p>An editorial schematic based on the authors’ problem formulation.
                Not an original paper figure, a measured performance chart, or a simulation.</p>
            </div>
            <div className={styles.mechanismFrame}>
              <div className={styles.mechanismControl} role="group" aria-label="Research process phase">
                {editorial.mechanisms.map((entry) => (
                  <button type="button" key={entry.id}
                    aria-pressed={mechanismFocus === entry.id}
                    className={styles.mechanismTab} onClick={() => setMechanismFocus(entry.id)}>
                    <span>{entry.label}</span>
                    <strong>{entry.title}</strong>
                  </button>
                ))}
              </div>
              <div className={styles.mechanismContent} data-mechanism-phase={mechanism.id}
                aria-live="polite">
                <div className={styles.mechanismIntro}>
                  <span>THE {mechanism.id.toUpperCase()} PROBLEM</span>
                  <p>{mechanism.explanation}</p>
                </div>
                <ol className={styles.mechanismSteps}>
                  {mechanism.stages.map((step, index) => (
                    <li key={step.label} className={styles.mechanismStep}>
                      <span className={styles.mechanismStepNumber}>{String(index + 1).padStart(2, '0')}</span>
                      <h3>{step.label}</h3>
                      <p>{step.detail}</p>
                      <a href={step.sourceUrl} target="_blank" rel="noopener noreferrer">
                        Source section <ArrowUpRight size={13} aria-hidden="true"/>
                      </a>
                    </li>
                  ))}
                </ol>
                <div className={styles.mechanismTakeaway}>
                  <span>WHY THIS DISTINCTION MATTERS</span>
                  <p>{mechanism.takeaway}</p>
                  <a href={mechanism.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Inspect the authors’ formulation <ArrowUpRight size={14} aria-hidden="true"/>
                  </a>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className={`${styles.storyGrid} ${figures.length === 0 ? styles.storyGridSourceOnly : ''}`}>
          <section className={`${styles.stage} ${figures.length === 0 ? styles.stageSourceOnly : ''}`} aria-label="Original scientific figures">
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
                <h2>{figures.length === 0 ? 'No approved figures yet' : selectedChapter ? 'No figure linked to this chapter' : 'Start with the original source'}</h2>
                <p>{figures.length === 0
                  ? 'Figures remain pending individual rights and asset review. The original publication and source chapters are available.'
                  : selectedChapter
                  ? 'This section has no approved original figure associated with it. Follow the source heading to inspect its actual material.'
                  : 'This story has no rights-cleared, source-verified figure available for display. Read the original publisher document instead.'}</p>
                <a href={activeChapter?.sections[0]?.sourceUrl ?? manifest.source.url}
                  target="_blank" rel="noopener noreferrer">Open original section <ArrowUpRight size={14} aria-hidden="true"/></a>
              </div>
            )}
          </section>

          <aside className={styles.narrative} aria-label={figures.length ? 'Guided research explanation' : 'Original publication navigation'}>
            <span className={styles.narrativeOverline}>YOUR READING GUIDE</span>
            <h2>{figures.length ? 'From source to understanding' : 'Follow the paper, section by section'}</h2>
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
                  <p>{lead || 'Open the original paper for the research question and reported findings. No summary has been inferred.'}</p>
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
