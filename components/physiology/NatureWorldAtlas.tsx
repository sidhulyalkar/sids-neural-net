'use client';

import { useMemo, useState } from 'react';
import { Check, Heart, Map, Search, Sparkles } from 'lucide-react';
import {
  NATURE_WORLDS,
  NATURE_WORLD_PALETTES,
  NATURE_WORLD_THEMES,
  type NatureAtlasProgress,
  type NatureWorldTheme,
} from '@/lib/physiology/natureWorlds';

type AtlasProps = {
  currentWorldId: string;
  progress: NatureAtlasProgress;
  onChooseWorld: (worldId: string) => void;
  onToggleFavorite: (worldId: string) => void;
};

type ThemeFilter = NatureWorldTheme | 'all';

export function NatureWorldAtlas({ currentWorldId, progress, onChooseWorld, onToggleFavorite }: AtlasProps) {
  const [theme, setTheme] = useState<ThemeFilter>('all');
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return NATURE_WORLDS.filter((world) => {
      if (theme !== 'all' && world.theme !== theme) return false;
      if (favoritesOnly && !progress.favorites.includes(world.id)) return false;
      if (!needle) return true;
      return [world.name, world.description, world.theme, world.terrain, ...world.features, ...world.wildlife]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [favoritesOnly, progress.favorites, query, theme]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-cyan/70" />
            <h2 className="font-mono text-sm text-text-primary">100-world nature atlas</h2>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-text-secondary/60">
            Every card is a deterministic procedural diorama recipe, not a screenshot. Visit anything immediately, then let the local persona learn which tiny corners of nature you keep returning to.
          </p>
        </div>
        <div className="flex gap-2 font-mono text-[0.62rem] text-text-secondary/55">
          <span className="rounded-full border border-white/10 px-2.5 py-1">{progress.discovered.length}/100 discovered</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">♥ {progress.favorites.length}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-black/10 px-3 text-xs text-text-secondary focus-within:border-cyan/30">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="search mushrooms, aurora, otter, snow, river..."
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

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setTheme('all')}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.68rem] transition ${theme === 'all' ? 'border-cyan/35 bg-cyan/[0.08] text-cyan' : 'border-white/10 text-text-secondary hover:border-white/20'}`}
        >
          ✨ all 100
        </button>
        {NATURE_WORLD_THEMES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTheme(item.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.68rem] transition ${theme === item.id ? 'border-cyan/35 bg-cyan/[0.08] text-cyan' : 'border-white/10 text-text-secondary hover:border-white/20'}`}
          >
            {item.icon} {item.label} · 20
          </button>
        ))}
      </div>

      <div className="mt-5 max-h-[620px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-text-secondary/50">
            No tiny world matches that search. The creature has checked under several rocks.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((world) => {
              const selected = world.id === currentWorldId;
              const discovered = progress.discovered.includes(world.id);
              const favorite = progress.favorites.includes(world.id);
              const palette = NATURE_WORLD_PALETTES[world.palette];
              return (
                <article
                  key={world.id}
                  className={`group relative overflow-hidden rounded-xl border transition ${selected ? 'border-cyan/45 bg-cyan/[0.06]' : 'border-white/10 bg-black/10 hover:border-white/20 hover:bg-white/[0.025]'}`}
                >
                  <button type="button" onClick={() => onChooseWorld(world.id)} className="w-full p-3.5 text-left">
                    <div className="mb-3 flex h-12 items-end overflow-hidden rounded-lg border border-white/10" style={{ backgroundColor: palette.sky }}>
                      <div className="h-5 w-full opacity-90" style={{ backgroundColor: palette.ground }} />
                      <div className="absolute ml-2 mb-1.5 h-2 w-7 rounded-full opacity-80" style={{ backgroundColor: palette.accent }} />
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base" aria-hidden>{world.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs leading-4 text-text-primary">{String(world.index).padStart(3, '0')} · {world.name}</p>
                        <p className="mt-1 line-clamp-2 text-[0.61rem] leading-4 text-text-secondary/48">{world.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[0.56rem] uppercase tracking-[0.08em] text-text-secondary/38">
                      <span>{world.theme}</span>
                      <span>{progress.visits[world.id] ?? 0} visits</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleFavorite(world.id)}
                    aria-label={`${favorite ? 'Remove' : 'Add'} ${world.name} ${favorite ? 'from' : 'to'} favorites`}
                    className={`absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition ${favorite ? 'border-rose-200/30 bg-rose-300/15 text-rose-200' : 'border-white/10 bg-black/20 text-white/45 opacity-60 hover:opacity-100'}`}
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
        Discovery is intentionally soft progression. Nothing is locked. Visiting a world adds it to the local passport, while favorites are explicit and can influence future wandering recommendations.
      </div>
    </section>
  );
}
