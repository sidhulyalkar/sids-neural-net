'use client';

import type { CSSProperties } from 'react';
import { FRONTIER_PINNED_TOPICS } from '@/lib/frontier/interests';
import type { FrontierProfile } from '@/lib/frontier/types';
import { FrontierLatentCanvas } from './FrontierLatentCanvas';
import { launchFrontierTopicSearch } from './frontierSearchBridge';
import styles from './frontier-interest-constellation.module.css';

type ConstellationNode = {
  key: string;
  label: string;
  strength: number;
};

function labelTopic(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function constellationNodes(profile: FrontierProfile): ConstellationNode[] {
  const learned = Object.entries(profile.topicAffinity)
    .filter(([, score]) => Number.isFinite(score) && score > 0.04)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([topic, score]) => ({
      key: topic,
      label: labelTopic(topic),
      strength: Math.max(0.3, Math.min(1, 0.36 + score * 0.62)),
    }));

  if (learned.length >= 4) return learned;

  const seen = new Set(learned.map((node) => node.label.toLowerCase()));
  const fallback = FRONTIER_PINNED_TOPICS
    .filter((topic) => !seen.has(topic.label.toLowerCase()))
    .slice(0, 6 - learned.length)
    .map((topic, index) => ({
      key: topic.id,
      label: topic.label,
      strength: 0.42 + index * 0.045,
    }));

  return [...learned, ...fallback];
}

export function InterestConstellation({ profile }: { profile: FrontierProfile }) {
  const nodes = constellationNodes(profile);

  return (
    <section className={styles.shell} data-frontier-interest-constellation>
      <div className={styles.heading}>
        <div>
          <span>taste topology</span>
          <strong>Your reading graph, projected locally</strong>
        </div>
        <p>Orbit the latent map. Tap a signal to fall directly into that rabbit hole.</p>
      </div>

      <div className={styles.field}>
        <FrontierLatentCanvas />
        <div className={styles.orbit} aria-label="Strong and pinned interest signals">
          {nodes.map((node) => (
            <button
              key={node.key}
              type="button"
              className={styles.node}
              style={{ '--signal-strength': node.strength } as CSSProperties}
              onClick={() => launchFrontierTopicSearch(node.label)}
              title={`Explore ${node.label}`}
              aria-label={`Explore ${node.label} from the interest constellation`}
            >
              <i aria-hidden="true" />
              <span>{node.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
