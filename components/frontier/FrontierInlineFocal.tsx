'use client';

import { ExternalLink } from 'lucide-react';
import { frontierFocalTakeaways } from '@/lib/frontier/synthesis/artifactExtractor';
import type { FrontierItem } from '@/lib/frontier/types';
import { FrontierScientificArtifactPlanes } from './artifactRenderer';
import { LocalConvergenceSynthesis } from './LocalConvergenceSynthesis';
import styles from './frontier-inline-focal.module.css';

type Props = {
  item: FrontierItem;
};

export function FrontierInlineFocal({ item }: Props) {
  const takeaways = frontierFocalTakeaways(item, 3);
  return (
    <section className={styles.inline} aria-label={`Expanded view: ${item.title}`}>
      <div className={styles.copy}>
        {item.summary ? <p className={styles.summary}>{item.summary}</p> : null}
        <FrontierScientificArtifactPlanes text={item.summary} />
        {takeaways.length ? (
          <div className={styles.takeaways} aria-label="Key takeaways">
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
          Open source <ExternalLink size={11} />
        </a>
      </div>

      <div className={styles.evidence}>
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
