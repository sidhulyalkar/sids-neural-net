import type { FrontierItem } from '@/lib/frontier/types';
import styles from './frontier-intelligence-badges.module.css';

function compactValue(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/\s+/g, ' ').trim().slice(0, 54);
}

export function FrontierIntelligenceBadges({ item }: { item: FrontierItem }) {
  const artifacts = item.artifacts?.slice(0, 3) ?? [];
  if (!item.convergence && !item.velocitySignal && !artifacts.length) return null;

  return (
    <div className={styles.badges} aria-label="FRONTIER extracted intelligence">
      {item.convergence ? (
        <span title={`${item.convergence.members.length} real sources converge on this development`}>
          <small>convergence</small>
          <strong>{item.convergence.members.length} sources</strong>
        </span>
      ) : null}
      {item.velocitySignal ? (
        <span title={`${item.velocitySignal.recentCount} semantically related items across ${item.velocitySignal.sourceCount} sources`}>
          <small>velocity</small>
          <strong>{Math.round(item.velocitySignal.score * 100)}%</strong>
        </span>
      ) : null}
      {artifacts.map((artifact, index) => artifact.url ? (
        <a
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          key={`${artifact.kind}-${artifact.label}-${index}`}
          title={`${artifact.label}${artifact.value ? `: ${artifact.value}` : ''}`}
        >
          <small>{artifact.label}</small>
          {compactValue(artifact.value) ? <strong>{compactValue(artifact.value)}</strong> : null}
        </a>
      ) : (
        <span key={`${artifact.kind}-${artifact.label}-${index}`} title={`${artifact.label}${artifact.value ? `: ${artifact.value}` : ''}`}>
          <small>{artifact.label}</small>
          {compactValue(artifact.value) ? <strong>{compactValue(artifact.value)}</strong> : null}
        </span>
      ))}
    </div>
  );
}
