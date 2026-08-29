'use client';

import { ExternalLink, X } from 'lucide-react';
import { deriveEditorialClip } from '@/lib/frontier/editorialClip';
import { frontierFocalTakeaways } from '@/lib/frontier/synthesis/artifactExtractor';
import type { FrontierItem } from '@/lib/frontier/types';
import { FrontierScientificArtifactPlanes } from './artifactRenderer';
import { LocalConvergenceSynthesis } from './LocalConvergenceSynthesis';
import styles from './frontier-inline-focal.module.css';

type Props = {
  item: FrontierItem;
  onCollapse: () => void;
};

function sameText(left: string | undefined, right: string | undefined): boolean {
  const normalize = (value: string | undefined) => (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

export function FrontierInlineFocal({ item, onCollapse }: Props) {
  const clip = deriveEditorialClip(item);
  const takeaways = frontierFocalTakeaways(item, 3);
  const evidenceExcerpts = item.convergence?.members
    .filter((member) => member.excerpt?.trim())
    .slice(0, 3) ?? [];
  const showFullSummary = Boolean(item.summary?.trim()) && !sameText(item.summary, clip.highlight);

  return (
    <section className={styles.inline} aria-label={`Expanded view: ${item.title}`} data-frontier-expanded-reading="true">
      <header className={styles.readingHeader}>
        <div>
          <span className={styles.sectionLabel}>Source-backed reading</span>
          <span className={styles.sourceMeta}>{item.sourceLabel}</span>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className={styles.closeButton}
          data-frontier-fluid-native="true"
          aria-label={`Collapse ${item.title}`}
        >
          <X size={13} /> Close
        </button>
      </header>

      <div className={styles.copy}>
        <section className={styles.highlight} data-frontier-source-highlight={clip.kind}>
          <div className={styles.highlightLabel}>{clip.label}</div>
          <p>{clip.highlight}</p>
          {clip.byline ? <small>{clip.byline}</small> : null}
        </section>

        {showFullSummary ? (
          <section className={styles.summaryBlock} aria-label="Source summary">
            <div className={styles.sectionLabel}>Source summary</div>
            <p className={styles.summary}>{item.summary}</p>
          </section>
        ) : null}

        <FrontierScientificArtifactPlanes text={item.summary} />

        {takeaways.length ? (
          <div className={styles.takeaways} aria-label="Key content highlights">
            <div className={styles.sectionLabel}>Content highlights</div>
            {takeaways.map((takeaway) => <p key={takeaway}>{takeaway}</p>)}
          </div>
        ) : null}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          data-frontier-fluid-native="true"
          className={styles.sourceLink}
        >
          Open full source <ExternalLink size={11} />
        </a>
      </div>

      <div className={styles.evidence}>
        {evidenceExcerpts.length ? (
          <section className={styles.excerpts} aria-label="Corroborating source excerpts">
            <div className={styles.sectionLabel}>Corroborating excerpts</div>
            {evidenceExcerpts.map((member, index) => (
              <a
                href={member.url}
                target="_blank"
                rel="noopener noreferrer"
                data-frontier-fluid-native="true"
                key={`${member.id}-${member.url}`}
              >
                <span>[S{index + 1}] · {member.sourceLabel}</span>
                <strong>{member.title}</strong>
                <p>{member.excerpt}</p>
              </a>
            ))}
          </section>
        ) : null}

        {item.convergence?.members.length ? <LocalConvergenceSynthesis item={item} /> : null}

        {item.artifacts?.length ? (
          <div className={styles.artifacts} aria-label="Extracted artifacts">
            {item.artifacts.slice(0, 6).map((artifact, index) => artifact.url ? (
              <a
                key={`${artifact.kind}-${index}`}
                href={artifact.url}
                target="_blank"
                rel="noopener noreferrer"
                data-frontier-fluid-native="true"
              >
                <span>{artifact.label}</span>{artifact.value ? <strong>{artifact.value}</strong> : null}
              </a>
            ) : (
              <span key={`${artifact.kind}-${index}`}>
                <small>{artifact.label}</small>{artifact.value ? <strong>{artifact.value}</strong> : null}
              </span>
            ))}
          </div>
        ) : null}

        {item.convergence?.members.length ? (
          <div className={styles.sources} aria-label="Converging sources">
            <div className={styles.sectionLabel}>Converging sources</div>
            {item.convergence.members.slice(0, 8).map((member, index) => (
              <a
                href={member.url}
                target="_blank"
                rel="noopener noreferrer"
                data-frontier-fluid-native="true"
                key={`${member.id}-${member.url}`}
              >
                <span>[S{index + 1}] · {member.sourceLabel}</span>
                <strong>{member.title}</strong>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
