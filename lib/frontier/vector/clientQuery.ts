export const FRONTIER_CLIENT_QUERY_EVENT = 'frontier:client-query';

let currentQuery = '';

export function getFrontierClientQuery(): string {
  return currentQuery;
}

export function setFrontierClientQuery(value: string): void {
  const next = value.trim().slice(0, 160);
  if (next === currentQuery) return;
  currentQuery = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<string>(FRONTIER_CLIENT_QUERY_EVENT, { detail: next }));
  }
}
