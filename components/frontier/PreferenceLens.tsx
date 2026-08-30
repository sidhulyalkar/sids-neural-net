'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { Brain, RotateCcw } from 'lucide-react';
import { aggregatePreference, summarizeHabits } from '@/lib/frontier/behavior';
import {
  readFrontierClientPipeline,
  readFrontierClientPipelineServer,
  subscribeFrontierClientPipeline,
} from '@/lib/frontier/clientPipelineDiagnostics';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import {
  readFrontierDecisionLedger,
  readFrontierDecisionLedgerServer,
  subscribeFrontierDecisionLedger,
} from '@/lib/frontier/decisionLedger';
import { auditFrontierExposure, type FrontierExposureAudit } from '@/lib/frontier/exposureAudit';
import { auditFrontierPipelineHealth } from '@/lib/frontier/pipelineHealth';
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

function pipelineStatusLabel(status: ReturnType<typeof auditFrontierPipelineHealth>['status']): string {
  switch (status) {
    case 'stable': return 'Stable';
    case 'watch': return 'Needs attention';
    case 'unobserved': return 'Awaiting evidence';
  }
}

function countLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? '?' : String(value);
}

export function PreferenceLens({ behavior, onToggleLearning, onResetBehavior }: Props) {
  const profile = useFrontierStore((state) => state.profile);
  const decisionLedger = useSyncExternalStore(
    subscribeFrontierDecisionLedger,
    readFrontierDecisionLedger,
    readFrontierDecisionLedgerServer,
  );
  const clientPipeline = useSyncExternalStore(
    subscribeFrontierClientPipeline,
    readFrontierClientPipeline,
    readFrontierClientPipelineServer,
  );
  const exposureAudit = useMemo(() => auditFrontierExposure(decisionLedger), [decisionLedger]);
  const pipelineHealth = useMemo(
    () => auditFrontierPipelineHealth(clientPipeline, exposureAudit),
    [clientPipeline, exposureAudit],
  );
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
        {exposureAudit.decisions ? <span>{maturityLabel(exposureAudit)}</span> : null}
      </div>

      {pipelineHealth.status !== 'unobserved' ? (
        <div className={styles.habitGrid} aria-label="Recommendation pipeline health">
          <div className={styles.habitCard}>
            <span>Pipeline health</span>
            <strong>{pipelineStatusLabel(pipelineHealth.status)} · {pipelineHealth.observedLatestBoundaries} latest boundaries</strong>
            <div
              className={styles.confidenceTrack}
              title={pipelineHealth.warnings.length
                ? pipelineHealth.warnings.join(' · ')
                : 'No structural warning fired on the currently observed boundaries.'}
            >
              <div style={{ width: `${Math.min(100, Math.round((pipelineHealth.observedLatestBoundaries / 8) * 100))}%` }} />
            </div>
          </div>
          <div className={styles.habitCard}>
            <span>Latest supply</span>
            <strong>
              {clientPipeline.server?.stages.sourceAcquired !== null && clientPipeline.server?.stages.sourceAcquired !== undefined
                ? `${countLabel(clientPipeline.server?.stages.sourceAcquired)} acquired → ${countLabel(clientPipeline.server?.stages.responseReady)} response-ready`
                : `${countLabel(clientPipeline.server?.stages.candidateInput)} archive candidates → ${countLabel(clientPipeline.server?.stages.responseReady)} response-ready`}
            </strong>
            <div
              className={styles.confidenceTrack}
              title={clientPipeline.server?.coverage.sourceAcquisition === 'observed'
                ? 'Live source acquisition was observed for this request.'
                : 'Original Internet acquisition is unavailable for this offline snapshot.'}
            >
              <div style={{ width: clientPipeline.server ? '100%' : '0%' }} />
            </div>
          </div>
          <div className={styles.habitCard}>
            <span>Latest local policy</span>
            <strong>{countLabel(clientPipeline.received)} received → {countLabel(clientPipeline.unseen)} unseen → {countLabel(clientPipeline.selected)} selected</strong>
            <div
              className={styles.confidenceTrack}
              title="Selected means slate-selected; actual display and visibility remain owned by the decision ledger."
            >
              <div style={{ width: clientPipeline.selected === null ? '0%' : '100%' }} />
            </div>
          </div>
          {exposureAudit.decisions ? (
            <div className={styles.habitCard}>
              <span>Longitudinal exposure</span>
              <strong>{exposureAudit.overall.offered} offered → {exposureAudit.overall.visible} actually seen</strong>
              <div
                className={styles.confidenceTrack}
                title="This is historical decision-ledger evidence, not the same cohort as the latest request above."
              >
                <div style={{ width: `${Math.round(exposureAudit.overall.visibility.value * 100)}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {exposureAudit.decisions ? (
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
