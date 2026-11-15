/**
 * Show only complete, source-authored sentences in a compact editorial lead.
 * Snapshot summaries can be truncated in the middle of a sentence; never
 * display that fragment as if it were a complete abstract or original claim.
 */
export function sourcePreview(summary: string | undefined, maxChars = 430): string | null {
  const text = summary?.replace(/\s+/g, ' ').trim();
  if (!text || maxChars < 80) return null;
  const results: string[] = [];
  let from = 0;
  const boundary = /[.!?](?=\s+(?:[A-Z“"‘])|$)/g;
  for (const match of text.matchAll(boundary)) {
    if (match.index === undefined) continue;
    const end = match.index + match[0].length;
    const sentence = text.slice(from, end).trim();
    from = end;
    if (!sentence) continue;
    const candidate = [...results, sentence].join(' ');
    if (candidate.length > maxChars) break;
    results.push(sentence);
    if (results.length >= 2) break;
  }
  // A story whose source does not contain even one full sentence has no
  // trustworthy preview. The original publication remains linked.
  return results.length ? results.join(' ') : null;
}
