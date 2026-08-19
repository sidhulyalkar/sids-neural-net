'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Heart, Map, Search, Sparkles } from 'lucide-react';
import { NatureWorldThumbnail2D } from '@/components/physiology/nature2d/NatureWorldThumbnail2D';
import {
  NATURE_COLLECTIONS,
  NATURE_WORLDS,
  atlasSummary,
  type NatureAtlasProgress,
  type NatureCollectionId,
} from '@/lib/physiology/natureWorldsExpanded';

type AtlasProps = {
  currentWorldId: string;
  progress: NatureAtlasProgress;
  onChooseWorld: (worldId: string) => void;
  onToggleFavorite: (worldId: string) => void;
};

type CollectionFilter = NatureCollectionId | 'all';
const PAGE_SIZE = 48;

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function NatureWorldAtlas({ currentWorldId, progress, onChooseWorld, onToggleFavorite }: AtlasProps) {
  const [collection, setCollection] = useState<CollectionFilter>('all');
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(0);
  const summary = atlasSummary(progress);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return NATURE_WORLDS.filter((world) => {
      if (collection !== 'all' && world.collection !== collection) return false;
      if (favoritesOnly && !progress.favorites.includes(world.id)) return false;
      if (!needle) return true;
      return [
        world.name,
        world.description,
        world.theme,
        world.terrain,
        world.collection,
        world.scene.collectionLabel,
        world.scene.atmosphere,
        world.scene.depth,
        world.scene.visualThesis,
        ...world.scene.renderCues,
        ...world.features,
        ...world.wildlife,
      ].join(' ').toLowerCase().includes(needle);
    });
  }, [collection, favoritesOnly, progress.favorites, query]);

  useEffect(() => setPage(0), [collection, favoritesOnly, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-cyan/70" />
            <h2 className="font-mono text-sm text-text-primary">900-world illustrated field guide</h2>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-text-secondary/60">
            Every card uses a tiny SVG interpretation of the same scene blueprint as the full viewport, so forests, coasts, flowers, mountains, deserts, glow worlds, and celestial scenes already read differently before you enter them. Nothing is locked.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-[0.62rem] text-text-secondary/55 sm:flex">
          <span className="rounded-full border border-white/10 px-2.5 py-1">{summary.discovered}/900 discovered</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">{percent(summary.completion)} atlas</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">{summary.collectionsVisited}/17 collections</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">♥ {summary.favorites}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-black/10 px-3 text-xs text-text-secondary focus-within:border-cyan/30">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="search aurora, sloth, rain, lavender, crystal, river, shell..."
            className="w-full bg-transparent text-text-primary outline-none placeholder:text-text-secondary/35"
          />
        </label>
        <button
          type="button"
          onClick={() => setFavoritesOnly((value) => !value)}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs transition ${favoritesOnly ? 'border-rose-300/30 bg-rose-300/[0.07] text-rose-200' : 'border-white/10 text-text-secondary hover:border-white/20 hover:text-text-primary'}`}
        >
          <Heart className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-current' : ''}`} /> favorites
        </button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {NATURE_COLLECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCollection(item.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.68rem] transition ${collection === item.id ? 'border-cyan/35 bg-cyan/[0.08] text-cyan' : 'border-white/10 text-text-secondary hover:border-white/20'}`}
          >
            {item.icon} {item.label} · {item.range}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.64rem] text-text-secondary/45">
        <span>{filtered.length} worlds match · showing {visible.length} at a time for a lighter DOM</span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous atlas page" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <span className="font-mono">{safePage + 1}/{pageCount}</span>
            <button type="button" aria-label="Next atlas page" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      <div className="mt-4">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-text-secondary/50">
            No tiny world matches that search. The creature has checked under several extremely legitimate rocks.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((world) => {
              const selected = world.id === currentWorldId;
              const discovered = progress.discovered.includes(world.id);
              const favorite = progress.favorites.includes(world.id);
              return (
                <article
                  key={world.id}
                  className={`group relative overflow-hidden rounded-xl border transition ${selected ? 'border-cyan/45 bg-cyan/[0.06]' : 'border-white/10 bg-black/10 hover:border-white/20 hover:bg-white/[0.025]'}`}
                >
                  <button type="button" onClick={() => onChooseWorld(world.id)} className="w-full p-3.5 text-left">
                    <NatureWorldThumbnail2D world={world} />
                    <div className="flex items-start gap-2">
                      <span className="text-base" aria-hidden>{world.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs leading-4 text-text-primary">{String(world.index).padStart(3, '0')} · {world.name}</p>
                        <p className="mt-1 line-clamp-2 text-[0.61rem] leading-4 text-text-secondary/48">{world.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[0.54rem] uppercase tracking-[0.07em] text-text-secondary/38">
                      <span>{world.scene.depth}</span><span>·</span><span>{world.scene.atmosphere}</span><span>·</span><span>{progress.visits[world.id] ?? 0} visits</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleFavorite(world.id)}
                    aria-label={`${favorite ? 'Remove' : 'Add'} ${world.name} ${favorite ? 'from' : 'to'} favorites`}
                    className={`absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition ${favorite ? 'border-rose-200/30 bg-rose-300/15 text-rose-200' : 'border-white/10 bg-black/20 text-white/45 opacity-70 hover:opacity-100'}`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${favorite ? 'fill-current' : ''}`} />
                  </button>

                  {discovered && (
                    <div className="pointer-events-none absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200/20 bg-emerald-300/10 text-emerald-200" title="discovered">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/10 bg-black/10 p-3 text-[0.64rem] leading-5 text-text-secondary/50">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan/60" />
        The atlas is intentionally soft progression. Visiting records discovery, favoriting is an explicit preference signal, and recommendation-selected wandering never trains itself. Search and collection filters are presentation only.
      </div>
    </section>
  );
}
