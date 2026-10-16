import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialBehaviorModel } from '../lib/frontier/behavior';
import { createInitialProfile } from '../lib/frontier/config';
import { parsePrivateFrontierState } from '../lib/frontier/frontierArchiveStateValidation';
import type { FrontierItem, FrontierPersistedState } from '../lib/frontier/types';

const ISO = '2026-08-31T12:00:00.000Z';

function item(id = 'item-1'): FrontierItem {
  return {
    id,
    title: 'A valid archived signal',
    summary: 'Strict v19 archive fixture.',
    url: `https://github.com/example/${id}`,
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: ISO,
    lane: 'creative_tech',
    tags: ['graphics', 'visual computing'],
    baseScore: 0.6,
    importance: 0.7,
    novelty: 0.8,
    quality: 0.9,
    momentum: 0.5,
  };
}

function validState(): FrontierPersistedState {
  const signal = item();
  return {
    version: 4,
    profile: createInitialProfile(),
    behavior: createInitialBehaviorModel(),
    saved: { [signal.id]: signal },
    collections: [{ id: 'inbox', name: 'Inbox', itemIds: [signal.id], createdAt: ISO }],
    history: {
      [signal.id]: {
        item: signal,
        firstSeenAt: ISO,
        lastSeenAt: ISO,
        impressions: 1,
        dwellMs: 0,
        resurfacedCount: 0,
        rewarded: false,
      },
    },
    game: { xp: 0, streak: 0, completedQuestDays: {} },
  };
}

test('strict v19 state parser deep-copies the complete current state schema', () => {
  const input = validState();
  input.profile.interestPairs['graphics × visual computing'] = 0.4;
  const parsed = parsePrivateFrontierState(input);
  assert.ok(parsed);
  assert.deepEqual(parsed, input);
  assert.notEqual(parsed, input);
  assert.notEqual(parsed.profile, input.profile);
  assert.notEqual(parsed.saved['item-1'], input.saved['item-1']);
});

test('strict parser accepts bounded ambient aggregate extensions without widening explicit behavior events', () => {
  const input = validState() as unknown as Record<string, unknown>;
  const behavior = input.behavior as Record<string, unknown>;
  behavior.topicStats = {
    graphics: {
      shown: 4, dwelled: 1, expanded: 0, opened: 1, saved: 0, positive: 0, negative: 0, dwellMs: 12_000,
      ambientAffinity: 0.7, ambientInterest: 0.2, ambientSurprise: 0.1, ambientFriction: 2.4, ambientEvidence: 1,
      lastAt: ISO,
    },
  };
  assert.ok(parsePrivateFrontierState(input));

  ((behavior.topicStats as Record<string, Record<string, unknown>>).graphics).ambientEvidence = Number.POSITIVE_INFINITY;
  assert.equal(parsePrivateFrontierState(input), null);
});

test('strict parser rejects unsafe rendered URLs and malformed media streams', () => {
  const unsafe = structuredClone(validState()) as unknown as Record<string, unknown>;
  ((unsafe.saved as Record<string, Record<string, unknown>>)['item-1']).url = 'javascript:alert(1)';
  assert.equal(parsePrivateFrontierState(unsafe), null);

  const badStream = structuredClone(validState()) as unknown as Record<string, unknown>;
  ((badStream.saved as Record<string, Record<string, unknown>>)['item-1']).media = {
    type: 'video',
    streams: [{ kind: 'progressive', url: 'javascript:alert(1)' }],
  };
  assert.equal(parsePrivateFrontierState(badStream), null);
});

test('strict parser understands current sports_state items', () => {
  const input = validState();
  const sports = item('sports-item');
  sports.sourceKind = 'sports_state';
  sports.lane = 'sports';
  sports.sportsState = {
    kind: 'standings',
    league: 'nfl',
    leagueLabel: 'NFL',
    standings: [{ rank: 1, team: 'Example', abbreviation: 'EX', record: '1-0', favorite: true }],
  };
  input.saved = { [sports.id]: sports };
  input.collections = [{ id: 'inbox', name: 'Inbox', itemIds: [sports.id], createdAt: ISO }];
  input.history = {};
  assert.ok(parsePrivateFrontierState(input));
});

test('strict parser rejects identity drift, dangling collection references, and dangerous profile numbers', () => {
  const mismatch = structuredClone(validState()) as unknown as Record<string, unknown>;
  const saved = mismatch.saved as Record<string, unknown>;
  saved['wrong-key'] = saved['item-1'];
  delete saved['item-1'];
  assert.equal(parsePrivateFrontierState(mismatch), null);

  const dangling = structuredClone(validState());
  dangling.collections[0].itemIds.push('missing-item');
  assert.equal(parsePrivateFrontierState(dangling), null);

  const badProfile = structuredClone(validState());
  badProfile.profile.interestPairs['bad pair'] = Number.NaN;
  assert.equal(parsePrivateFrontierState(badProfile), null);
});
