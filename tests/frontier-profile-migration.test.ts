import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import { migrateFrontierProfile } from '../lib/frontier/profileMigration';
import type { FrontierProfile } from '../lib/frontier/types';

test('profile migration backfills new explicit taste topics into old sparse profiles', () => {
  const old = createInitialProfile();
  delete old.topicAffinity['fantasy football'];
  delete old.topicAffinity.neuroglancer;
  delete old.topicAffinity['sports analytics'];
  old.meaningfulInteractions = 4;

  const migrated = migrateFrontierProfile(old);
  assert.ok((migrated.topicAffinity['fantasy football'] ?? 0) > 0.3);
  assert.ok((migrated.topicAffinity.neuroglancer ?? 0) > 0.3);
  assert.ok((migrated.topicAffinity['sports analytics'] ?? 0) > 0.3);
});

test('profile migration never overwrites an explicit learned negative topic preference', () => {
  const old = createInitialProfile();
  old.topicAffinity['fantasy football'] = -0.55;
  old.topicAffinity.neuroglancer = -0.4;
  old.meaningfulInteractions = 38;

  const migrated = migrateFrontierProfile(old);
  assert.equal(migrated.topicAffinity['fantasy football'], -0.55);
  assert.equal(migrated.topicAffinity.neuroglancer, -0.4);
});

test('mature profiles keep learned lane affinities while still receiving missing topic vocabulary', () => {
  const old = createInitialProfile();
  old.laneAffinity.sports = -0.32;
  old.laneAffinity.neuro_frontier = -0.21;
  old.meaningfulInteractions = 52;
  delete old.topicAffinity['space imaging'];

  const migrated = migrateFrontierProfile(old);
  assert.equal(migrated.laneAffinity.sports, -0.32);
  assert.equal(migrated.laneAffinity.neuro_frontier, -0.21);
  assert.ok((migrated.topicAffinity['space imaging'] ?? 0) > 0.2);
});

test('legacy profiles without pair memory receive an empty v4 pair map without losing learned evidence', () => {
  const current = createInitialProfile();
  current.topicAffinity.nfl = 0.73;
  const { interestPairs: _v4PairMemory, ...legacyShape } = current;
  const migrated = migrateFrontierProfile(legacyShape as unknown as FrontierProfile);
  assert.deepEqual(migrated.interestPairs, {});
  assert.equal(migrated.topicAffinity.nfl, 0.73);
});
