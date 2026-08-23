'use client';

const FRONTIER_SEARCH_SELECTOR = 'input[aria-label="Search FRONTIER topics"]';

/**
 * Route local discovery affordances through FRONTIER's canonical search form.
 * Using the native value setter lets React observe the input event without
 * duplicating search/ranking state outside FrontierExperience.
 */
export function launchFrontierTopicSearch(query: string): boolean {
  const normalized = query.replace(/\s+/g, ' ').trim().slice(0, 96);
  if (!normalized || typeof document === 'undefined') return false;

  const input = document.querySelector<HTMLInputElement>(FRONTIER_SEARCH_SELECTOR);
  const form = input?.closest('form');
  if (!input || !form) return false;

  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) return false;

  setter.call(input, normalized);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  window.requestAnimationFrame(() => {
    if (form.isConnected) form.requestSubmit();
  });
  return true;
}

export function frontierRabbitHoleQuery(tags: readonly string[], fallback: string): string {
  const generic = new Set([
    'news', 'latest', 'recommended', 'second-chance', 'fresh', 'live', 'article', 'video',
  ]);
  const useful = Array.from(new Set(
    tags
      .map((tag) => tag.replace(/[-_]+/g, ' ').trim())
      .filter((tag) => tag.length >= 2 && !generic.has(tag.toLowerCase()))
  )).slice(0, 3);

  if (useful.length) return useful.join(' ');
  return fallback.replace(/[^a-zA-Z0-9+#. -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 72);
}
