import YAML from 'yaml';

export type ParsedFrontmatter = {
  data: Record<string, unknown>;
  content: string;
};

/** Minimal deterministic frontmatter parser for content we control. */
export function parseFrontmatter(source: string): ParsedFrontmatter {
  if (!source.startsWith('---')) return { data: {}, content: source };
  const firstLineEnd = source.indexOf('\n');
  if (firstLineEnd < 0) return { data: {}, content: source };
  const closing = source.indexOf('\n---', firstLineEnd);
  if (closing < 0) throw new Error('Unclosed YAML frontmatter block');
  const yaml = source.slice(firstLineEnd + 1, closing);
  const parsed = YAML.parse(yaml);
  if (parsed != null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
    throw new Error('Frontmatter must parse to a mapping');
  }
  const bodyStart = source.indexOf('\n', closing + 4);
  const content = bodyStart < 0 ? '' : source.slice(bodyStart + 1);
  return { data: (parsed ?? {}) as Record<string, unknown>, content };
}
