import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialBehaviorModel } from '../lib/frontier/behavior';
import { createInitialProfile, DEFAULT_COLLECTIONS } from '../lib/frontier/config';
import {
  applyPreferenceImportToProfile,
  deriveGooglePreferenceImport,
} from '../lib/frontier/googlePreferences';
import {
  compactFrontierCloudMemory,
  mergeFrontierMemory,
  parseFrontierPersistedState,
} from '../lib/frontier/memoryMerge';
import type { FrontierItem, FrontierPersistedState } from '../lib/frontier/types';

function item(id: string, title: string): FrontierItem {
  return {
    id,
    title,
    summary: title,
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-21T12:00:00.000Z',
    lane: 'ml_data',
    tags: ['machine learning'],
    baseScore: 0.7,
    importance: 0.6,
    novelty: 0.6,
    quality: 0.8,
    momentum: 0.5,
  };
}

function state(): FrontierPersistedState {
  return {
    version: 4,
    profile: createInitialProfile(),
    behavior: createInitialBehaviorModel(),
    saved: {},
    collections: DEFAULT_COLLECTIONS.map((collection) => ({ ...collection, itemIds: [] })),
    history: {},
    game: { xp: 0, streak: 0, completedQuestDays: {} },
  };
}

test('Google taste import learns subscriptions and likes without retaining raw watch rows', () => {
  const imported = deriveGooglePreferenceImport(
    [
      { channelId: 'a', title: 'IFSC Climbing' },
      { channelId: 'b', title: 'Virtual Riot' },
      { channelId: 'c', title: 'Manchester City' },
    ],
    [
      { videoId: 'v1', title: 'World Cup bouldering final highlights', channelTitle: 'IFSC Climbing' },
      { videoId: 'v2', title: 'New dubstep mix and bass production', channelTitle: 'Virtual Riot' },
    ],
    new Date('2026-08-21T12:00:00Z')
  );

  assert.equal(imported.provider, 'google-youtube');
  assert.equal(imported.summary.subscriptions, 3);
  assert.equal(imported.summary.likedVideos, 2);
  assert.ok(imported.topics.some((topic) => topic.key === 'manchester city'));
  assert.ok(imported.topics.some((topic) => topic.key.includes('climbing')));
  assert.ok(!JSON.stringify(imported).includes('v1'));
  assert.ok(!JSON.stringify(imported).includes('World Cup bouldering final highlights'));
});

test('Google taste import strengthens profile topics and YouTube source affinity', () => {
  const profile = createInitialProfile();
  const before = profile.topicAffinity['mountain biking'] ?? 0;
  const preferenceImport = {
    provider: 'google-youtube' as const,
    importedAt: '2026-08-21T12:00:00.000Z',
    topics: [{ key: 'mountain biking', weight: 0.2 }],
    sourceAffinity: { youtube: 0.18 },
    summary: { subscriptions: 1, likedVideos: 3, learnedTopics: 1 },
  };
  const next = applyPreferenceImportToProfile(profile, preferenceImport);
  const repeated = applyPreferenceImportToProfile(next, preferenceImport);

  assert.ok(next.topicAffinity['mountain biking'] > before);
  assert.equal(next.sourceAffinity.youtube, 0.18);
  assert.equal(repeated.topicAffinity['mountain biking'], next.topicAffinity['mountain biking']);
  assert.equal(repeated.sourceAffinity.youtube, next.sourceAffinity.youtube);
  assert.equal(profile.sourceAffinity.youtube, undefined);
});

test('Google account seeds never override explicit negative preference evidence', () => {
  const profile = createInitialProfile();
  profile.topicAffinity['reaction videos'] = -0.45;
  profile.sourceAffinity.youtube = -0.2;
  const next = applyPreferenceImportToProfile(profile, {
    provider: 'google-youtube',
    importedAt: '2026-08-21T12:00:00.000Z',
    topics: [{ key: 'reaction videos', weight: 0.34 }],
    sourceAffinity: { youtube: 0.18 },
    summary: { subscriptions: 4, likedVideos: 8, learnedTopics: 1 },
  });
  assert.equal(next.topicAffinity['reaction videos'], -0.45);
  assert.equal(next.sourceAffinity.youtube, -0.2);
});

test('cloud-memory merge preserves useful state and co-interest memory from both devices', () => {
  const left = state();
  const right = state();
  const a = item('a', 'A');
  const b = item('b', 'B');
  left.saved[a.id] = a;
  right.saved[b.id] = b;
  left.profile.topicAffinity.neuroai = 0.8;
  right.profile.topicAffinity['mountain biking'] = 0.9;
  left.profile.interestPairs['nfl × sports analytics'] = 0.32;
  right.profile.interestPairs['neuroglancer × scientific visualization'] = 0.41;
  left.history[a.id] = {
    item: a,
    firstSeenAt: '2026-08-20T10:00:00.000Z',
    lastSeenAt: '2026-08-20T11:00:00.000Z',
    impressions: 2,
    dwellMs: 12_000,
    resurfacedCount: 0,
    rewarded: false,
  };
  right.history[a.id] = {
    item: a,
    firstSeenAt: '2026-08-20T10:00:00.000Z',
    lastSeenAt: '2026-08-21T11:00:00.000Z',
    impressions: 3,
    dwellMs: 24_000,
    reaction: 'up',
    reactedAt: '2026-08-21T11:00:00.000Z',
    resurfacedCount: 1,
    rewarded: true,
  };

  const merged = mergeFrontierMemory(left, right);
  assert.deepEqual(Object.keys(merged.saved).sort(), ['a', 'b']);
  assert.equal(merged.version, 4);
  assert.equal(merged.profile.topicAffinity.neuroai, 0.8);
  assert.equal(merged.profile.topicAffinity['mountain biking'], 0.9);
  assert.equal(merged.profile.interestPairs['nfl × sports analytics'], 0.32);
  assert.equal(merged.profile.interestPairs['neuroglancer × scientific visualization'], 0.41);
  assert.equal(merged.history.a.dwellMs, 24_000);
  assert.equal(merged.history.a.reaction, 'up');
  assert.equal(merged.history.a.resurfacedCount, 1);
});

test('cloud-memory merge gives reaction authority to the newest reactedAt rather than newest impression', () => {
  const left = state();
  const right = state();
  const signal = item('reaction-race', 'Reaction race');
  left.history[signal.id] = {
    item: signal,
    firstSeenAt: '2026-08-20T10:00:00.000Z',
    lastSeenAt: '2026-08-29T19:00:00.000Z',
    impressions: 5,
    reaction: 'up',
    reactedAt: '2026-08-24T12:00:00.000Z',
    resurfacedCount: 0,
    rewarded: false,
  };
  right.history[signal.id] = {
    item: signal,
    firstSeenAt: '2026-08-20T10:00:00.000Z',
    lastSeenAt: '2026-08-28T19:00:00.000Z',
    impressions: 3,
    reaction: 'down',
    reactedAt: '2026-08-27T12:00:00.000Z',
    resurfacedCount: 0,
    rewarded: false,
  };

  const merged = mergeFrontierMemory(left, right);
  assert.equal(merged.history[signal.id].lastSeenAt, '2026-08-29T19:00:00.000Z');
  assert.equal(merged.history[signal.id].reaction, 'down');
  assert.equal(merged.history[signal.id].reactedAt, '2026-08-27T12:00:00.000Z');
});

test('cloud compaction bounds raw history but prioritizes meaningful rows', () => {
  const memory = state();
  for (let index = 0; index < 6; index += 1) {
    const signal = item(`i${index}`, `Item ${index}`);
    memory.history[signal.id] = {
      item: signal,
      firstSeenAt: `2026-08-2${index}T10:00:00.000Z`,
      lastSeenAt: `2026-08-2${index}T11:00:00.000Z`,
      impressions: 1,
      resurfacedCount: 0,
      rewarded: false,
    };
  }
  memory.saved.i0 = memory.history.i0.item;
  memory.history.i1.reaction = 'love';
  memory.history.i1.rewarded = true;

  const compacted = compactFrontierCloudMemory(memory, 3);
  assert.equal(Object.keys(compacted.history).length, 3);
  assert.ok(compacted.history.i0);
  assert.ok(compacted.history.i1);
  assert.ok(compacted.history.i5);
  assert.equal(Object.keys(compacted.saved).length, 1);
  assert.equal(compacted.profile.topicAffinity.neuroai, memory.profile.topicAffinity.neuroai);
});

test('remote-memory parser rejects unrelated payloads', () => {
  assert.equal(parseFrontierPersistedState({ hello: 'world' }), null);
  assert.ok(parseFrontierPersistedState(state()));
});
