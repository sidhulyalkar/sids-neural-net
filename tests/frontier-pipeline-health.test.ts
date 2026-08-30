import assert from 'node:assert/strict';
import test from 'node:test';
import type { FrontierClientPipelineSnapshot } from '../lib/frontier/clientPipelineDiagnostics';
import { auditFrontierExposure } from '../lib/frontier/exposureAudit';
import { auditFrontierPipelineHealth } from '../lib/frontier/pipelineHealth';
import { buildFrontierPipelineDiagnostics } from '../lib/frontier/pipelineDiagnostics';

function clientSnapshot(overrides: Partial<FrontierClientPipelineSnapshot> = {}): FrontierClientPipelineSnapshot {
  return {
    schema: 'frontier-client-pipeline-v1',
    at: 1,
    received: 80,
    unseen: 64,
    rotationReady: 60,
    ranked: 60,
    realmEligible: 54,
    selected: 40,
    boardInput: 40,
    server: buildFrontierPipelineDiagnostics({
      mode: 'focused-live',
      sourceAcquisition: 'observed',
      adapters: { attempted: 14, fulfilled: 13, failed: 1 },
      stages: {
        sourceAcquired: 180,
        candidateInput: 180,
        plausible: 172,
        rightsSafe: 170,
        recent: null,
        deduped: 150,
        sourceAdmitted: 126,
        candidateRetained: 80,
        englishReady: 80,
        responseReady: 80,
      },
    }),
    ...overrides,
  };
}

test('unified health keeps latest request and longitudinal evidence as separate cohorts', () => {
  const health = auditFrontierPipelineHealth(clientSnapshot(), auditFrontierExposure([]));
  assert.equal(health.status, 'stable');
  assert.ok(health.latest.some((stage) => stage.id === 'provenance-admission'));
  assert.ok(health.latest.some((stage) => stage.id === 'slate-selection'));
  assert.equal(health.longitudinal.length, 0);
  assert.equal(health.observedLatestBoundaries, 8);
});

test('missing server stages remain absent rather than becoming zero-survival boundaries', () => {
  const client = clientSnapshot({ server: undefined });
  const health = auditFrontierPipelineHealth(client, auditFrontierExposure([]));
  assert.equal(health.latest.some((stage) => stage.id === 'provenance-admission'), false);
  assert.equal(health.latest.some((stage) => stage.id === 'seen-filter'), true);
  assert.equal(health.warnings.includes('provenance-pressure'), false);
});

test('health detects concrete supply and client collapses without inventing causality', () => {
  const server = buildFrontierPipelineDiagnostics({
    mode: 'fresh-live',
    sourceAcquisition: 'observed',
    adapters: { attempted: 10, fulfilled: 5, failed: 5 },
    stages: {
      sourceAcquired: 200,
      candidateInput: 200,
      plausible: 190,
      rightsSafe: 188,
      recent: null,
      deduped: 160,
      sourceAdmitted: 60,
      candidateRetained: 60,
      englishReady: 55,
      responseReady: 55,
    },
  });
  const health = auditFrontierPipelineHealth(clientSnapshot({
    server,
    received: 55,
    unseen: 4,
    rotationReady: 4,
    ranked: 0,
    realmEligible: 0,
    selected: 0,
    boardInput: 0,
  }), auditFrontierExposure([]));

  assert.equal(health.status, 'watch');
  assert.ok(health.warnings.includes('adapter-degradation'));
  assert.ok(health.warnings.includes('provenance-pressure'));
  assert.ok(health.warnings.includes('repeated-inventory-pressure'));
  assert.equal(health.warnings.includes('rank-collapse'), false, 'rank collapse needs at least eight rotation-ready candidates');
});

test('candidate cap pressure is reported only when the observed retention boundary is actually saturated', () => {
  const server = buildFrontierPipelineDiagnostics({
    mode: 'focused-live',
    sourceAcquisition: 'observed',
    stages: {
      sourceAcquired: 420,
      candidateInput: 420,
      plausible: 410,
      rightsSafe: 408,
      recent: null,
      deduped: 390,
      sourceAdmitted: 350,
      candidateRetained: 320,
      englishReady: 318,
      responseReady: 318,
    },
  });
  const health = auditFrontierPipelineHealth(clientSnapshot({ server }), auditFrontierExposure([]));
  assert.ok(health.warnings.includes('candidate-cap-pressure'));
});
