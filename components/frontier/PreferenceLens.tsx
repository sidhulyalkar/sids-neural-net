'use client';

import { useEffect, useState } from 'react';
import { Brain, RotateCcw } from 'lucide-react';
import { aggregatePreference, summarizeHabits } from '@/lib/frontier/behavior';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import { readFrontierDecisionLedger } from '@/lib/frontier/decisionLedger';
import { auditFrontierExposure, type FrontierExposureAudit } from '@/lib/frontier/exposureAudit';
import { useFrontierStore } from '@/lib/frontier/store';
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

function pairLabel(pair: string): string {
  return pair.split(' × ').map((part) => part.trim()).filter(Boolean).join(' + ');
}

function maturityLabel(audit: FrontierExposureAudit): string {
  switch (audit.maturity) {
    case 'cold': return 'Cold start';
    case 'warming': return 'Warming up';
    case 'grounded': return 'Grounded';
    case 'rich': return 'Well learned';
  }
}

export function PreferenceLens({ behavior, onToggleLearning, onResetBehavior }: Props) {
  const profile = useFrontierStore((state) => state.profile);
  const [exposureAudit, setExposureAudit] = useState<FrontierExposureAudit>();
  const insights = summarizeHabits(behavior).slice(0, 6);
  const lanes = Object.entries(behavior.laneStats)
    .map(([lane, stats]) => ({ lane: lane as FrontierLaneId, pref: aggregatePreference(stats) }))
    .filter((entry) => entry.pref.confidence >= 0.12)
    .sort((a, b) => (b.pref.score * b.pref.confidence) - (a.pref.score * a.pref.confidence))
    .slice(0, 7);
  const pairings = Object.entries(profile.interestPairs)
    .filter(([, score]) => score > 0.012)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);
  const evidence = engagementEvidence(behavior);

  useEffect(() => {
    setExposureAudit(auditFrontierExposure(readFrontierDecisionLedger()));
  }, [behavior]);

  const forgetHabits = () => {
    // Pair memory is inferred from implicit/explicit co-interest evidence and is
    // deliberately separable from direct topic likes/dislikes. Forgetting
    // habits clears this derived layer without erasing explicit preferences.
    useFrontierStore.setState((state) => ({
      profile: { ...state.profile, interestPairs: {} },
    }));
    onResetBehavior();
  };

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
        {pairings.length ? <span>{pairings.length} combinations</span> : null}
        {exposureAudit?.decisions ? <span>{maturityLabel(exposureAudit)}</span> : null}
      </div>

      {exposureAudit?.decisions ? (
        <div className={styles.habitGrid} aria-label="Personalization evidence health">
          <div className={styles.habitCard}>
            <span>Learning health</span>
            <strong>{maturityLabel(exposureAudit)} · {exposureAudit.overall.visible} actually seen</strong>
            <div
              className={styles.confidenceTrack}
              title={`${Math.round(exposureAudit.evidenceScore * 100)}% evidence maturity · ${exposureAudit.sessions} decision sessions`}
            >
              <div style={{ width: `${Math.round(exposureAudit.evidenceScore * 100)}%` }} />
            </div>
          </div>
          <div className={styles.habitCard}>
            <span>After seeing it</span>
            <strong>{Math.round(exposureAudit.overall.engagementGivenVisible.value * 100)}% meaningful engagement</strong>
            <div
              className={styles.confidenceTrack}
              title={`${exposureAudit.overall.engagementGivenVisible.successes} engaged of ${exposureAudit.overall.engagementGivenVisible.total} seen recommendations`}
            >
              <div style={{ width: `${Math.round(exposureAudit.overall.engagementGivenVisible.value * 100)}%` }} />
            </div>
          </div>
        </div>
      ) : null}

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

      {pairings.length ? (
        <div className={styles.habitGrid} aria-label="Learned interest combinations">
          {pairings.map(([pair, score]) => {
            const strength = Math.min(100, Math.round((score / 0.3) * 100));
            return (
              <div className={styles.habitCard} key={pair}>
                <span>Combination</span>
                <strong>{pairLabel(pair)}</strong>
                <div className={styles.confidenceTrack} title={`${strength}% co-interest signal`}>
                  <div style={{ width: `${strength}%` }} />
                </div>
              </div>
            );
          })}
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
        <button type="button" className={styles.utilityButton} onClick={forgetHabits}><RotateCcw size={11} /> Forget habits</button>
      </div>
    </div>
  );
}
