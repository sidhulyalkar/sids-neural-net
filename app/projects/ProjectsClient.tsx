'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Grid, List, SortDesc, X } from 'lucide-react';
import { NeuralNode } from '@/lib/data/schemas';
import { ProjectCard } from '@/components/projects';
import { useMode } from '@/lib/contexts/ModeContext';
import { filterByMode, sortByImportance } from '@/lib/graph/ranking';

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
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary">Projects</h1>
          <p className="mt-2 text-lg text-text-secondary">
            {filteredProjects.length} projects across neuroscience infrastructure, ML research, and creative experiments.
          </p>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-bg-panel border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-text-muted hover:text-text-secondary" />
              </button>
            )}
          </div>

          {/* View controls */}
          <div className="flex items-center gap-2">
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-lg border transition-colors ${
                showFilters
                  ? 'bg-cyan/10 border-cyan/30 text-cyan'
                  : 'bg-bg-panel border-border-subtle text-text-muted hover:text-text-secondary'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="p-2.5 bg-bg-panel border border-border-subtle rounded-lg text-sm text-text-secondary focus:outline-none focus:border-cyan/50"
            >
              <option value="importance">Sort by Importance</option>
              <option value="recent">Sort by Recent</option>
              <option value="alphabetical">Sort A-Z</option>
            </select>

            {/* View toggle */}
            <div className="flex items-center border border-border-subtle rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-cyan/10 text-cyan'
                    : 'bg-bg-panel text-text-muted hover:text-text-secondary'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-cyan/10 text-cyan'
                    : 'bg-bg-panel text-text-muted hover:text-text-secondary'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-bg-panel border border-border-subtle rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary">Filters</h3>
              {hasActiveFilters && (
                <button
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
                    key={domain}
                    onClick={() => toggleDomain(domain)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      selectedDomains.includes(domain)
                        ? 'bg-violet/20 text-violet border-violet/30'
                        : 'bg-bg-deep text-text-muted border-border-subtle hover:border-text-muted/50'
                    }`}
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
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-cyan/20 text-cyan border-cyan/30'
                        : 'bg-bg-deep text-text-muted border-border-subtle hover:border-text-muted/50'
                    }`}
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
                key={domain}
                onClick={() => toggleDomain(domain)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-violet/20 text-violet rounded-full"
              >
                {domain}
                <X className="w-3 h-3" />
              </button>
            ))}
            {selectedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-cyan/20 text-cyan rounded-full"
              >
                {tag}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {/* Projects Grid/List */}
        {filteredProjects.length > 0 ? (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-4'
            }
          >
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="glass-card min-h-[300px] flex items-center justify-center">
            <div className="text-center">
              <p className="text-text-muted">No projects match your filters.</p>
              <button
                onClick={clearFilters}
                className="mt-2 text-sm text-cyan hover:underline"
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
