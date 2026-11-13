import { BookOpenText, GitFork, MessageCircle, Play, Trophy, Gamepad2, Headphones, Leaf, Newspaper } from 'lucide-react';
import type { FrontierItem } from '@/lib/frontier/types';
import { journalSourceLens } from '@/lib/frontier/journalSourceLens';
import styles from './frontier-journal.module.css';

type Props = { item: FrontierItem; figureCount: number; publishedLabel: string };

const SourceIcons = {
  paper: BookOpenText,
  repository: GitFork,
  discussion: MessageCircle,
  watch: Play,
  match: Trophy,
  game: Gamepad2,
  music: Headphones,
  field: Leaf,
  report: Newspaper,
};

/** A small contextual source imprint, not an AI-generated explanation of the
 * work and not a quantitative quality score. */
export function FrontierJournalSourceLens({ item, figureCount, publishedLabel }: Props) {
  const lens = journalSourceLens(item, figureCount);
  const Icon = SourceIcons[lens.kind];
  return (
    <div className={styles.sourceImprint} data-source-kind={lens.kind} aria-label="Source identity">
      <div className={styles.imprintTop}>
        <span className={styles.imprintGlyph} aria-hidden="true"><Icon size={17} strokeWidth={1.6}/></span>
        <span className={styles.imprintEyebrow}>{lens.kicker}</span>
      </div>
      <strong className={styles.imprintIdentity}>{lens.identity}</strong>
      <div className={styles.imprintProvenance}>
        {lens.provenance !== lens.identity ? <span>{lens.provenance}</span> : null}
        <span>{publishedLabel}</span>
      </div>
      {lens.facts.length ? (
        <dl className={styles.imprintFacts}>
          {lens.facts.map((fact, index) => (
            <div key={fact.label + index}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
