'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react';
import { photoMapUrl } from '@/src/data/photoPlaces';
import type { VisualArchiveEntry } from '@/src/data/visualArchive';

type VisualArchiveGalleryProps = {
  entries: VisualArchiveEntry[];
};

type ArchiveCardStyle = CSSProperties & {
  '--archive-rotate': string;
  '--archive-y': string;
  '--archive-x': string;
  '--archive-width': string;
};

const layoutPattern = [
  { rotate: '-0.8deg', y: '0.15rem', x: '0rem', width: '100%' },
  { rotate: '0.7deg', y: '0.65rem', x: '0.2rem', width: '98%' },
  { rotate: '-0.45deg', y: '0rem', x: '-0.15rem', width: '100%' },
  { rotate: '0.95deg', y: '0.45rem', x: '0rem', width: '96%' },
  { rotate: '-0.65deg', y: '0.85rem', x: '0.25rem', width: '99%' },
  { rotate: '0.35deg', y: '0.1rem', x: '-0.15rem', width: '100%' },
  { rotate: '-1deg', y: '0.55rem', x: '0.1rem', width: '97%' },
  { rotate: '0.8deg', y: '0.25rem', x: '0.2rem', width: '100%' },
  { rotate: '-0.25deg', y: '0.7rem', x: '-0.2rem', width: '98%' },
  { rotate: '0.55deg', y: '0rem', x: '0.1rem', width: '100%' },
] as const;

type BalancedArchiveEntry = {
  entry: VisualArchiveEntry;
  index: number;
};

function cardStyle(index: number): ArchiveCardStyle {
  const layout = layoutPattern[index % layoutPattern.length];
  return {
    '--archive-rotate': layout.rotate,
    '--archive-y': layout.y,
    '--archive-x': layout.x,
    '--archive-width': layout.width,
  };
}

function getResponsiveColumnCount() {
  if (typeof window === 'undefined') return 1;
  if (window.matchMedia('(min-width: 1536px)').matches) return 5;
  if (window.matchMedia('(min-width: 1280px)').matches) return 4;
  if (window.matchMedia('(min-width: 1024px)').matches) return 3;
  if (window.matchMedia('(min-width: 640px)').matches) return 2;
  return 1;
}

function distributeEntries(entries: VisualArchiveEntry[], columnCount: number): BalancedArchiveEntry[][] {
  const columns = Array.from({ length: columnCount }, () => [] as BalancedArchiveEntry[]);
  const columnHeights = Array.from({ length: columnCount }, () => 0);

  entries.forEach((entry, index) => {
    const layout = layoutPattern[index % layoutPattern.length];
    const widthScale = Number.parseFloat(layout.width) / 100 || 1;
    const estimatedHeight = (entry.height / entry.width) * widthScale + 0.08;
    const targetColumn = columnHeights.indexOf(Math.min(...columnHeights));

    columns[targetColumn].push({ entry, index });
    columnHeights[targetColumn] += estimatedHeight;
  });

  return columns;
}

export function VisualArchiveGallery({ entries }: VisualArchiveGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [columnCount, setColumnCount] = useState(1);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const activeEntry = activeIndex === null ? null : entries[activeIndex];
  const activeDisplayIndex = activeIndex === null ? 0 : activeIndex + 1;
  const columns = useMemo(() => distributeEntries(entries, columnCount), [columnCount, entries]);

  const close = useCallback(() => setActiveIndex(null), []);
  const showPrevious = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null) return current;
      return (current - 1 + entries.length) % entries.length;
    });
  }, [entries.length]);
  const showNext = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null) return current;
      return (current + 1) % entries.length;
    });
  }, [entries.length]);

  useEffect(() => {
    if (activeIndex === null) return;

    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') showPrevious();
      if (event.key === 'ArrowRight') showNext();
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        document.querySelectorAll<HTMLElement>('[data-visual-archive-modal] button, [data-visual-archive-modal] a[href]')
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [activeIndex, close, showNext, showPrevious]);

  useEffect(() => {
    const updateColumnCount = () => setColumnCount(getResponsiveColumnCount());

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);

  if (!entries.length) return null;

  return (
    <>
      <section className="visual-archive-shell" aria-label="Selected personal photography">
        <div
          className="visual-archive-masonry"
          style={{ '--archive-columns': columnCount } as CSSProperties}
        >
          {columns.map((column, columnIndex) => (
            <div className="visual-archive-column" key={`visual-archive-column-${columnIndex}`}>
              {column.map(({ entry, index }) => (
                <div key={entry.id} className="min-w-0">
                  <button
                    type="button"
                    className="visual-archive-card group"
                    style={cardStyle(index)}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Open image ${index + 1} of ${entries.length}`}
                  >
                    <span
                      className="relative block overflow-hidden border border-white/10 bg-black/40"
                      style={{ aspectRatio: entry.aspectRatio }}
                    >
                      <Image
                        src={entry.thumbSrc}
                        alt={entry.alt}
                        fill
                        sizes="(min-width: 1536px) 18vw, (min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw"
                        loading="lazy"
                        decoding="async"
                        className="object-cover transition duration-500 group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      />
                    </span>
                    {entry.title && <span className="sr-only">{entry.title}</span>}
                  </button>
                  <a
                    href={photoMapUrl(entry.place)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${entry.location} on Google Maps`}
                    className="mt-2 flex min-h-8 items-center gap-1.5 px-1 text-[10px] leading-4 text-white/55 transition-colors hover:text-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan"
                  >
                    <MapPin size={13} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{entry.location}</span>
                    {entry.place.verification === 'approximate' && <span className="sr-only">(approximate)</span>}
                  </a>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {activeEntry && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/82 px-4 py-5 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Visual Cortex image viewer"
          data-visual-archive-modal
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="relative flex h-full w-full max-w-6xl items-center justify-center">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center border border-white/15 bg-black/60 text-white/75 transition-colors hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:border-cyan"
              aria-label="Close image viewer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={showPrevious}
              className="absolute left-0 z-10 flex h-12 w-12 items-center justify-center border border-white/15 bg-black/55 text-white/70 transition-colors hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:border-cyan sm:left-2"
              aria-label="Show previous image"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>

            <figure className="flex max-h-full w-full flex-col items-center justify-center gap-4 px-12">
              <div className="relative max-h-[70vh] w-full">
                <Image
                  key={activeEntry.id}
                  src={activeEntry.src}
                  alt={activeEntry.alt}
                  width={activeEntry.width}
                  height={activeEntry.height}
                  sizes="96vw"
                  priority
                  decoding="async"
                  className="mx-auto max-h-[70vh] w-auto max-w-full border border-white/12 object-contain shadow-[0_0_70px_rgba(102,227,255,0.12)]"
                />
              </div>
              <figcaption className="flex max-w-full flex-col items-center gap-2 text-center font-mono">
                <a
                  href={photoMapUrl(activeEntry.place)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-2 rounded-sm px-3 py-2 text-xs text-cyan/85 underline-offset-4 transition hover:text-cyan hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan"
                  aria-label={`Open ${activeEntry.location} on Google Maps`}
                >
                  <MapPin size={15} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{activeEntry.location}</span>
                  <span aria-hidden="true">↗</span>
                </a>
                {activeEntry.place.verification === 'approximate' && (
                  <span className="text-[9px] tracking-wide text-white/40">Approximate location · awaiting confirmation</span>
                )}
                <span className="text-[0.68rem] uppercase tracking-[0.18em] text-white/45">
                  {String(activeDisplayIndex).padStart(2, '0')} / {String(entries.length).padStart(2, '0')}
                </span>
              </figcaption>
            </figure>

            <button
              type="button"
              onClick={showNext}
              className="absolute right-0 z-10 flex h-12 w-12 items-center justify-center border border-white/15 bg-black/55 text-white/70 transition-colors hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:border-cyan sm:right-2"
              aria-label="Show next image"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
