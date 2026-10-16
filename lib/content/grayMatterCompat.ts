import { parseFrontmatter } from './frontmatter';

/**
 * Tiny compatibility adapter for the historical `matter(source)` call shape
 * used by the offline neural-graph builder. It intentionally replaces the
 * third-party gray-matter parser with the same modern YAML frontmatter parser
 * used by production case-study loading.
 */
export default function matter(source: string) {
  return parseFrontmatter(source);
}
