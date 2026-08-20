import { FRONTIER_LANES } from '@/lib/frontier/config';
import type { FrontierProfile } from '@/lib/frontier/types';
import styles from './frontier.module.css';

const ACCENTS = ['#76edff', '#93ffb3', '#b7a6ff', '#ffabda', '#ffd47a'];

export function InterestConstellation({ profile }: { profile: FrontierProfile }) {
  const nodes = FRONTIER_LANES.filter((lane) => lane.id !== 'must_know').map((lane, index) => {
    const angle = index * 2.399963229728653;
    const ring = 132 + (index % 4) * 48;
    const affinity = profile.laneAffinity[lane.id] ?? 0;
    const strength = Math.max(0.15, Math.min(1, 0.44 + affinity * 0.7));
    return {
      lane,
      x: 500 + Math.cos(angle) * ring,
      y: 300 + Math.sin(angle) * ring * 0.72,
      radius: 8 + strength * 10,
      strength,
      color: ACCENTS[index % ACCENTS.length],
    };
  });

  return (
    <div className={styles.mapPanel}>
      <svg className={styles.mapSvg} viewBox="0 0 1000 600" role="img" aria-label="Your evolving FRONTIER interest constellation">
        <defs>
          <radialGradient id="frontier-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#bdf8ff" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#76edff" stopOpacity="0.02" />
          </radialGradient>
          <filter id="frontier-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {nodes.map((node) => (
          <line
            key={`line-${node.lane.id}`}
            x1="500" y1="300" x2={node.x} y2={node.y}
            stroke={node.color}
            strokeOpacity={0.05 + node.strength * 0.13}
            strokeWidth={0.8 + node.strength}
          />
        ))}

        <circle cx="500" cy="300" r="74" fill="url(#frontier-center)" opacity="0.32" />
        <circle cx="500" cy="300" r="9" fill="#eafbf7" filter="url(#frontier-glow)" />
        <text x="500" y="330" textAnchor="middle" className={`${styles.mapLabel} ${styles.mapCenter}`}>YOU</text>
        <text x="500" y="348" textAnchor="middle" className={styles.mapLabel}>live preference state</text>

        {nodes.map((node) => (
          <g key={node.lane.id}>
            <circle cx={node.x} cy={node.y} r={node.radius * 2.2} fill={node.color} opacity={0.025 + node.strength * 0.035} />
            <circle cx={node.x} cy={node.y} r={node.radius} fill="#071015" stroke={node.color} strokeOpacity={0.42 + node.strength * 0.42} strokeWidth="1.2" />
            <circle cx={node.x} cy={node.y} r={Math.max(2.5, node.radius * 0.28)} fill={node.color} opacity={0.45 + node.strength * 0.45} />
            <text x={node.x} y={node.y + node.radius + 18} textAnchor="middle" className={styles.mapLabel}>
              {node.lane.shortLabel}
            </text>
          </g>
        ))}
      </svg>
      <p className={styles.mapHint}>
        Nodes expand as your meaningful interactions strengthen a lane. “Already knew” moves the knowledge boundary without shrinking interest. Surprise feedback raises the exploration budget, so this map is allowed to grow new branches rather than collapse into an echo chamber.
      </p>
    </div>
  );
}
