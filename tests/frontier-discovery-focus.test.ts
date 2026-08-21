import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialBehaviorModel } from '../lib/frontier/behavior';
import { createInitialProfile } from '../lib/frontier/config';
import { buildDiscoveryFocus, decodeDiscoveryFocus, encodeDiscoveryFocus } from '../lib/frontier/discoveryFocus';

test('adaptive focus is seeded by strong explicit interests without duplicate aliases', () => {
  const profile = createInitialProfile();
  profile.topicAffinity['mountain biking'] = 0.9;
  profile.topicAffinity.mtb = 0.8;
  profile.topicAffinity.neuroai = 0.75;
  const focus = buildDiscoveryFocus(profile, createInitialBehaviorModel(), 6);

  assert.ok(focus.includes('mountain biking'));
  assert.ok(focus.includes('neuroai neuroscience'));
  assert.equal(focus.filter((topic) => topic.includes('mountain biking')).length, 1);
});

test('negative interests do not become live search queries', () => {
  const profile = createInitialProfile();
  profile.topicAffinity.skateboarding = -0.7;
  profile.topicAffinity['mountain biking'] = 0.8;
  const focus = buildDiscoveryFocus(profile, undefined, 8);

  assert.ok(focus.includes('mountain biking'));
  assert.ok(!focus.includes('skateboarding'));
});

test('focus encoding round trips through the bounded query-string contract', () => {
  const encoded = encodeDiscoveryFocus(['Mountain Biking', 'NeuroAI neuroscience', 'Chelsea FC']);
  assert.deepEqual(decodeDiscoveryFocus(encoded), ['mountain biking', 'neuroai neuroscience', 'chelsea fc']);
});
