'use client';

import { Brain, RotateCcw } from 'lucide-react';
import { aggregatePreference, summarizeHabits } from '@/lib/frontier/behavior';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import type { FrontierBehaviorModel, FrontierLaneId } from '@/lib/frontier/types';
import styles from './frontier-minimal.module.css';

type Props = {
  behavior: FrontierBehaviorModel;
  onToggleLearning: (enabled: boolean) => void;
  onResetBehavior: () => void;
};

function engagementEvidence(behavior: FrontierBehaviorModel): number {
  return Object.values(behavior.laneStats).reduce((sum, stats) => sum + stats.shown + stats.opened * 2 + stats.saved * 3 + stats.positive * 3, 0);
}

export function PreferenceLens({ behavior, onToggleLearning, onResetBehavior }: Props) {
  const insights = summarizeHabits(behavior).slice(0, 6);
  const lanes = Object.entries(behavior.laneStats)
    .map(([lane, stats]) => ({ lane: lane as FrontierLaneId, pref: aggregatePreference(stats) }))
    .filter((entry) => entry.pref.confidence >= 0.12)
    .sort((a, b) => (b.pref.score * b.pref.confidence) - (a.pref.score * a.pref.confidence))
    .slice(0, 7);
  const evidence = engagementEvidence(behavior);

  return (
    <div className={styles.learningLens}>
      <div className={styles.learningHead}>
        <div>
          <span className={styles.micro}><Brain size={12} /> Taste</span>
          <h2>What&apos;s sticking</h2>
        </div>
        <label className={styles.learningToggle}>
          <input
            type="checkbox"
            checked={behavior.implicitLearning}
            onChange={(event) => onToggleLearning(event.target.checked)}
          />
          <span>{behavior.implicitLearning ? 'Learning' : 'Paused'}</span>
        </label>
      </div>

      <div className={styles.learningSummary}>
        <span>{behavior.sessions} sessions</span>
        <span>{evidence} signals</span>
      </div>

      {insights.length ? (
        <div className={styles.habitGrid}>
          {insights.map((insight) => (
            <div className={styles.habitCard} key={`${insight.label}-${insight.detail}`}>
              <span>{insight.label}</span>
              <strong>{insight.detail}</strong>
              <div className={styles.confidenceTrack} title={`${Math.round(insight.confidence * 100)}% confidence`}>
                <div style={{ width: `${Math.round(insight.confidence * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {lanes.length ? (
        <div className={styles.learnedLanes}>
          {lanes.map(({ lane, pref }) => (
            <div key={lane} className={styles.learnedLane}>
              <span>{FRONTIER_LANE_MAP[lane]?.shortLabel ?? lane}</span>
              <div><i style={{ width: `${Math.round(Math.max(0, pref.score) * pref.confidence * 100)}%` }} /></div>
              <small>{Math.round(pref.confidence * 100)}%</small>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.learningFoot}>
        <button type="button" className={styles.utilityButton} onClick={onResetBehavior}><RotateCcw size={11} /> Forget habits</button>
      </div>
    </div>
  );
}
