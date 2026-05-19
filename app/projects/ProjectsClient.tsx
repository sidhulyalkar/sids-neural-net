'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Grid, List, X } from 'lucide-react';
import { NeuralNode } from '@/lib/data/schemas';
import { ProjectCard } from '@/components/projects';
import { useMode } from '@/lib/contexts/ModeContext';
import { filterByMode, sortByImportance } from '@/lib/graph/ranking';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { NodeDetailPanel } from '@/components/neural-atlas/NodeDetailPanel';

interface ProjectsClientProps {
  projects: NeuralNode[];
  availableDomains: string[];
  availableTags: string[];
}

type SortOption = 'importance' | 'recent' | 'alphabetical';
type ViewMode = 'grid' | 'list';

export function ProjectsClient({
  projects,
  availableDomains,
  availableTags,
}: ProjectsClientProps) {
  const { mode } = useMode();
  const [search, setSearch] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('importance');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const filteredProjects = useMemo(() => {
    let filtered = filterByMode(projects, mode);

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          p.summary?.toLowerCase().includes(searchLower) ||
          p.tags.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    // Domain filter
    if (selectedDomains.length > 0) {
      filtered = filtered.filter((p) =>
        p.domains.some((d) => selectedDomains.includes(d))
      );
    }

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((p) =>
        p.tags.some((t) => selectedTags.includes(t))
      );
    }

    // Sort
    switch (sortBy) {
      case 'importance':
        filtered = sortByImportance(filtered);
        break;
      case 'recent':
        filtered = [...filtered].sort((a, b) => {
          const aDate = a.updatedAt || a.startDate || '';
          const bDate = b.updatedAt || b.startDate || '';
          return bDate.localeCompare(aDate);
        });
        break;
      case 'alphabetical':
        filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return filtered;
  }, [projects, mode, search, selectedDomains, selectedTags, sortBy]);

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedDomains([]);
    setSelectedTags([]);
  };

  const hasActiveFilters = search || selectedDomains.length > 0 || selectedTags.length > 0;

  return (
    <ComicSectionLayout
      eyebrow="builds"
      title="builds"
    >
      <div className="builds-circuit-field">

        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search builds..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-white/10 bg-bg-panel/70 py-3 pl-10 pr-4 text-text-primary placeholder:text-text-muted focus:border-cyan/50 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-md"
                aria-label="Clear project search"
              >
                <X className="w-4 h-4 text-text-muted hover:text-text-secondary" />
              </button>
            )}
          </div>

          {/* View controls */}
          <div className="flex items-center gap-2">
            {/* Filter toggle */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`min-h-11 min-w-11 p-2.5 rounded-lg border transition-colors ${
                showFilters
                  ? 'bg-cyan/10 border-cyan/30 text-cyan'
                  : 'bg-bg-panel/70 border-white/10 text-text-muted hover:text-text-secondary'
              }`}
              aria-label={showFilters ? 'Hide project filters' : 'Show project filters'}
              aria-expanded={showFilters}
            >
              <Filter className="w-5 h-5" />
            </button>

            {/* Sort control */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="border border-white/10 bg-bg-panel/70 p-2.5 text-sm text-text-secondary focus:border-cyan/50 focus:outline-none"
            >
              <option value="importance">Sort by Importance</option>
              <option value="recent">Sort by Recent</option>
              <option value="alphabetical">Sort A-Z</option>
            </select>

            {/* View toggle */}
            <div className="flex items-center overflow-hidden border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`min-h-11 min-w-11 p-2.5 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-cyan/10 text-cyan'
                  : 'bg-bg-panel/70 text-text-muted hover:text-text-secondary'
                }`}
                aria-label="Show builds as grid"
                aria-pressed={viewMode === 'grid'}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`min-h-11 min-w-11 p-2.5 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-cyan/10 text-cyan'
                  : 'bg-bg-panel/70 text-text-muted hover:text-text-secondary'
                }`}
                aria-label="Show builds as list"
                aria-pressed={viewMode === 'list'}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="comic-panel mb-6 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary">Filters</h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-text-muted hover:text-cyan"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Domains */}
            <div className="mb-4">
              <h4 className="text-xs text-text-muted uppercase tracking-wider mb-2">Domains</h4>
              <div className="flex flex-wrap gap-1">
                {availableDomains.map((domain) => (
                  <button
                    type="button"
                    key={domain}
                    onClick={() => toggleDomain(domain)}
                    className={`min-h-8 px-2 py-1 text-xs rounded-full border transition-colors ${
                      selectedDomains.includes(domain)
                        ? 'bg-violet/20 text-violet border-violet/30'
                        : 'bg-bg-deep text-text-muted border-white/10 hover:border-text-muted/50'
                    }`}
                    aria-pressed={selectedDomains.includes(domain)}
                  >
                    {domain}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <h4 className="text-xs text-text-muted uppercase tracking-wider mb-2">Popular Tags</h4>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`min-h-8 px-2 py-1 text-xs rounded-full border transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-cyan/20 text-cyan border-cyan/30'
                        : 'bg-bg-deep text-text-muted border-white/10 hover:border-text-muted/50'
                    }`}
                    aria-pressed={selectedTags.includes(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted">Active filters:</span>
            {selectedDomains.map((domain) => (
              <button
                type="button"
                key={domain}
                onClick={() => toggleDomain(domain)}
                className="inline-flex min-h-8 items-center gap-1 px-2 py-0.5 text-xs bg-violet/20 text-violet rounded-full"
                aria-label={`Remove ${domain} filter`}
              >
                {domain}
                <X className="w-3 h-3" />
              </button>
            ))}
            {selectedTags.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                className="inline-flex min-h-8 items-center gap-1 px-2 py-0.5 text-xs bg-cyan/20 text-cyan rounded-full"
                aria-label={`Remove ${tag} filter`}
              >
                {tag}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {/* Builds Grid/List */}
        {filteredProjects.length > 0 ? (
          <div
            className={
              viewMode === 'grid'
                ? 'comic-grid'
                : 'space-y-4'
            }
          >
            {filteredProjects.map((project, index) => (
              <div
                key={project.id}
                className={viewMode === 'grid' ? (index % 5 === 0 ? 'comic-span-8 comic-tilt-left' : index % 5 === 1 ? 'comic-span-4 comic-tilt-right md:mt-8' : 'comic-span-6') : ''}
              >
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        ) : (
          <NodeDetailPanel label="No Match" title="No builds match those filters." tone="amber">
            <div className="text-center">
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 text-sm text-cyan hover:underline"
              >
                Clear filters
              </button>
            </div>
          </NodeDetailPanel>
        )}
      </div>
    </ComicSectionLayout>
  );
}
