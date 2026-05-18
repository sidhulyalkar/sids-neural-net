'use client';

import { Search, Filter, X } from 'lucide-react';
import { useMode } from '@/lib/contexts/ModeContext';

interface GraphFiltersProps {
  filters: {
    types: string[];
    domains: string[];
    search: string;
  };
  onFiltersChange: (filters: { types: string[]; domains: string[]; search: string }) => void;
  availableTypes: string[];
  availableDomains: string[];
}

const TYPE_LABELS: Record<string, string> = {
  project: 'Projects',
  publication: 'Publications',
  role: 'Roles',
  organization: 'Organizations',
  skill: 'Skills',
  technology: 'Technologies',
  concept: 'Concepts',
  'case-study': 'Project Briefs',
  'field-note': 'Field Notes',
  'learning-trail': 'Learning Trails',
  'personal-interest': 'Personal',
  milestone: 'Milestones',
};

const TYPE_COLORS: Record<string, string> = {
  project: 'bg-cyan/20 text-cyan border-cyan/30',
  publication: 'bg-violet/20 text-violet border-violet/30',
  role: 'bg-amber/20 text-amber border-amber/30',
  organization: 'bg-green/20 text-green border-green/30',
  skill: 'bg-rose/20 text-rose border-rose/30',
  technology: 'bg-cyan/20 text-cyan border-cyan/30',
  concept: 'bg-violet/20 text-violet border-violet/30',
  'case-study': 'bg-amber/20 text-amber border-amber/30',
  'field-note': 'bg-green/20 text-green border-green/30',
  'learning-trail': 'bg-rose/20 text-rose border-rose/30',
  'personal-interest': 'bg-rose/20 text-rose border-rose/30',
  milestone: 'bg-amber/20 text-amber border-amber/30',
};

export function GraphFilters({
  filters,
  onFiltersChange,
  availableTypes,
  availableDomains,
}: GraphFiltersProps) {
  const { mode, setMode } = useMode();

  const toggleType = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    onFiltersChange({ ...filters, types: newTypes });
  };

  const toggleDomain = (domain: string) => {
    const newDomains = filters.domains.includes(domain)
      ? filters.domains.filter((d) => d !== domain)
      : [...filters.domains, domain];
    onFiltersChange({ ...filters, domains: newDomains });
  };

  const clearFilters = () => {
    onFiltersChange({ types: [], domains: [], search: '' });
  };

  const hasActiveFilters =
    filters.types.length > 0 || filters.domains.length > 0 || filters.search.length > 0;

  return (
    <div className="space-y-4" role="search" aria-label="Graph filters">
      {/* Search */}
      <div className="relative">
        <label htmlFor="graph-search" className="sr-only">Search nodes</label>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" aria-hidden="true" />
        <input
          id="graph-search"
          type="search"
          placeholder="Search nodes..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="w-full pl-10 pr-4 py-2 bg-bg-deep border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan/50"
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: '' })}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-4 h-4 text-text-muted hover:text-text-secondary" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Mode Toggle */}
      <fieldset>
        <legend className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-text-muted" aria-hidden="true" />
          <span className="text-xs text-text-muted uppercase tracking-wider">View Mode</span>
        </legend>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Select view mode">
          {(['recruiter', 'researcher', 'builder', 'full-brain', 'personal'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                mode === m
                  ? 'bg-cyan/20 text-cyan border-cyan/30'
                  : 'bg-bg-deep text-text-muted border-border-subtle hover:border-cyan/30'
              }`}
            >
              {m === 'full-brain' ? 'Full Brain' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Type Filters */}
      <fieldset>
        <legend className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted uppercase tracking-wider">Node Types</span>
          {filters.types.length > 0 && (
            <button
              onClick={() => onFiltersChange({ ...filters, types: [] })}
              aria-label="Clear node type filters"
              className="text-xs text-text-muted hover:text-text-secondary"
            >
              Clear
            </button>
          )}
        </legend>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by node type">
          {availableTypes.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              aria-pressed={filters.types.includes(type)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                filters.types.includes(type)
                  ? TYPE_COLORS[type] || 'bg-cyan/20 text-cyan border-cyan/30'
                  : 'bg-bg-deep text-text-muted border-border-subtle hover:border-text-muted/50'
              }`}
            >
              {TYPE_LABELS[type] || type}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Domain Filters */}
      <fieldset>
        <legend className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted uppercase tracking-wider">Domains</span>
          {filters.domains.length > 0 && (
            <button
              onClick={() => onFiltersChange({ ...filters, domains: [] })}
              aria-label="Clear domain filters"
              className="text-xs text-text-muted hover:text-text-secondary"
            >
              Clear
            </button>
          )}
        </legend>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by domain">
          {availableDomains.slice(0, 12).map((domain) => (
            <button
              key={domain}
              onClick={() => toggleDomain(domain)}
              aria-pressed={filters.domains.includes(domain)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                filters.domains.includes(domain)
                  ? 'bg-violet/20 text-violet border-violet/30'
                  : 'bg-bg-deep text-text-muted border-border-subtle hover:border-text-muted/50'
              }`}
            >
              {domain}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Clear All */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          aria-label="Clear all active filters"
          className="w-full py-2 text-xs text-text-muted hover:text-text-secondary border border-border-subtle rounded-lg hover:border-text-muted/50 transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}
