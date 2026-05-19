'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink, Briefcase, GraduationCap, Microscope, FileText, Heart, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TimelineEvent } from '@/lib/data/schemas';
import { useMode } from '@/lib/contexts/ModeContext';

interface SignalTimelineProps {
  events: TimelineEvent[];
}

const CATEGORY_CONFIG: Record<TimelineEvent['category'], { icon: LucideIcon; color: string; label: string }> = {
  career: { icon: Briefcase, color: 'cyan', label: 'Career' },
  research: { icon: Microscope, color: 'violet', label: 'Research' },
  project: { icon: Star, color: 'green', label: 'Build' },
  publication: { icon: FileText, color: 'amber', label: 'Publication' },
  milestone: { icon: GraduationCap, color: 'cyan', label: 'Milestone' },
  learning: { icon: GraduationCap, color: 'violet', label: 'Learning' },
  life: { icon: Heart, color: 'rose', label: 'Life' },
};

export function SignalTimeline({ events }: SignalTimelineProps) {
  const { mode } = useMode();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Filter events by mode and category
  const filteredEvents = useMemo(() => {
    let filtered = events.filter((event) =>
      event.modeVisibility.includes(mode) || event.modeVisibility.includes('full-brain')
    );

    if (selectedCategories.length > 0) {
      filtered = filtered.filter((e) => selectedCategories.includes(e.category));
    }

    // Sort by date descending
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, mode, selectedCategories]);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Get unique categories from events
  const categories = Array.from(new Set(events.map((e) => e.category))) as TimelineEvent['category'][];

  // Group events by year
  const eventsByYear = useMemo(() => {
    const grouped = new Map<string, TimelineEvent[]>();
    filteredEvents.forEach((event) => {
      const year = new Date(event.date).getFullYear().toString();
      if (!grouped.has(year)) {
        grouped.set(year, []);
      }
      grouped.get(year)!.push(event);
    });
    return Array.from(grouped.entries()).sort((a, b) => parseInt(b[0]) - parseInt(a[0]));
  }, [filteredEvents]);

  return (
    <div>
      {/* Category filters */}
      <div className="mb-8 flex flex-wrap gap-2">
        {categories.map((category) => {
          const config = CATEGORY_CONFIG[category];
          const Icon = config.icon;
          const isSelected = selectedCategories.includes(category);
          return (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              className={`inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] transition-colors ${
                isSelected
                  ? `bg-${config.color}/20 text-${config.color} border-${config.color}/30`
                  : 'bg-bg-panel/70 text-text-muted border-white/10 hover:border-text-muted/50'
              }`}
              style={
                isSelected
                  ? {
                      backgroundColor: `rgba(var(--${config.color}-rgb, 102, 227, 255), 0.2)`,
                      borderColor: `rgba(var(--${config.color}-rgb, 102, 227, 255), 0.3)`,
                      color: `var(--${config.color})`,
                    }
                  : undefined
              }
            >
              <Icon className="w-4 h-4" />
              {config.label}
            </button>
          );
        })}
        {selectedCategories.length > 0 && (
          <button
            onClick={() => setSelectedCategories([])}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Clear
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-cyan/50 via-violet/30 to-transparent" />
        <div className="signal-trace absolute left-8 top-0 h-full w-20 opacity-40" />

        {eventsByYear.map(([year, yearEvents]) => (
          <div key={year} className="mb-12">
            {/* Year marker */}
            <div className="flex items-center gap-4 mb-6">
              <div className="z-10 flex h-16 w-16 items-center justify-center border border-cyan/20 bg-bg-panel shadow-glow-cyan">
                <span className="text-lg font-bold text-text-primary">{year}</span>
              </div>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>

            {/* Events for this year */}
            <div className="ml-8 space-y-6 border-l border-white/10 pl-8">
              {yearEvents.map((event) => {
                const config = CATEGORY_CONFIG[event.category];
                const Icon = config.icon;
                return (
                  <div
                    key={event.id}
                    className="node-shell relative p-5 transition-colors hover:border-cyan/25"
                  >
                    {/* Connection dot */}
                    <div
                      className="absolute -left-[37px] top-6 h-3 w-3 rounded-full shadow-glow-cyan"
                      style={{ backgroundColor: `var(--${config.color})` }}
                    />

                    {/* Event header */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="border border-white/10 p-2"
                          style={{ backgroundColor: `rgba(var(--${config.color}-rgb, 102, 227, 255), 0.1)` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: `var(--${config.color})` }} />
                        </div>
                        <div>
                          <h3 className="font-bold text-text-primary">{event.title}</h3>
                          <p className="text-sm text-text-muted">
                            {new Date(event.date).toLocaleDateString('en-US', {
                              month: 'short',
                              year: 'numeric',
                            })}
                            {event.endDate && event.endDate !== event.date && (
                              <>
                                {' - '}
                                {new Date(event.endDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Importance indicator */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.ceil(event.importance / 20) }).map((_, i) => (
                          <div
                            key={i}
                            className="h-2 w-2"
                            style={{
                              backgroundColor: `var(--${config.color})`,
                              opacity: 0.3 + i * 0.15,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-sm text-text-secondary mb-3">{event.summary}</p>

                    {/* Links */}
                    {event.links.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {event.links.map((link, i) => {
                          const isExternal = link.href.startsWith('http');
                          const className = 'inline-flex min-h-8 items-center gap-1 text-xs text-cyan hover:underline';

                          if (isExternal) {
                            return (
                              <a
                                key={i}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={className}
                              >
                                {link.label}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            );
                          }

                          return (
                            <Link key={i} href={link.href} className={className}>
                              {link.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredEvents.length === 0 && (
        <div className="node-shell flex min-h-[200px] items-center justify-center">
          <p className="text-text-muted">No events match the current filters.</p>
        </div>
      )}
    </div>
  );
}
