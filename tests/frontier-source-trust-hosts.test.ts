import assert from 'node:assert/strict';
import test from 'node:test';
import { assessFrontierHost, isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import type { FrontierItem } from '../lib/frontier/types';

test('ordinary fd-prefixed government hostnames are not mistaken for private IPv6', () => {
  const fda = assessFrontierHost('https://fda.gov/drugs');
  assert.equal(fda.tier, 'institutional');
  assert.ok(fda.score >= 0.9);
});

test('private and loopback IPv6 literals remain blocked', () => {
  assert.equal(assessFrontierHost('http://[fd00::1]/').tier, 'blocked');
  assert.equal(assessFrontierHost('http://[::1]/').tier, 'blocked');
  assert.equal(assessFrontierHost('http://[fe80::1]/').tier, 'blocked');
});

test('IPv4-mapped loopback destinations remain blocked', () => {
  assert.equal(assessFrontierHost('http://[::ffff:127.0.0.1]/').tier, 'blocked');
});

test('vetted sports-data and visualization destinations are admitted as known provenance', () => {
  assert.notEqual(assessFrontierHost('https://www.pro-football-reference.com/').tier, 'unknown');
  assert.notEqual(assessFrontierHost('https://nflverse.nflverse.com/').tier, 'unknown');
  assert.notEqual(assessFrontierHost('https://napari.org/').tier, 'unknown');
  assert.notEqual(assessFrontierHost('https://observablehq.com/').tier, 'unknown');
});

test('Screen Orbit first-party and established entertainment sources have explicit provenance', () => {
  assert.equal(assessFrontierHost('https://www.crunchyroll.com/news/latest').tier, 'primary');
  assert.equal(assessFrontierHost('https://about.netflix.com/en/news/example').tier, 'primary');
  assert.equal(assessFrontierHost('https://www.animenewsnetwork.com/news/example').tier, 'established');
  assert.equal(assessFrontierHost('https://variety.com/tv/news/example').tier, 'established');
});

test('vetted bass and electronic music publications are explicit editorial sources', () => {
  assert.equal(assessFrontierHost('https://edm.com/music-releases/example').tier, 'established');
  assert.equal(assessFrontierHost('https://dancingastronaut.com/2026/08/example').tier, 'established');
  assert.ok(assessFrontierHost('https://edm.com/music-releases/example').score >= 0.75);
});

test('requested sports clip hosts have explicit bounded trust tiers', () => {
  assert.equal(assessFrontierHost('https://bleacherreport.com/articles/example').tier, 'established');
  assert.equal(assessFrontierHost('https://sleeper.com/news/example').tier, 'platform');
  assert.equal(assessFrontierHost('https://x.com/NFL/status/1').tier, 'community');
  assert.equal(assessFrontierHost('https://www.threads.net/@sports/post/example').tier, 'community');
  assert.equal(assessFrontierHost('https://www.tiktok.com/@sports/video/1').tier, 'community');
});

test('structured live sports state is admitted as established utility evidence', () => {
  const item: FrontierItem = {
    id: 'scoreboard',
    title: 'NFL · scores + schedule',
    summary: 'Current games.',
    url: 'https://www.espn.com/nfl/scoreboard',
    source: 'espn.com',
    sourceLabel: 'ESPN · NFL',
    sourceKind: 'sports_state',
    publishedAt: '2026-08-24T05:00:00.000Z',
    lane: 'sports',
    tags: ['nfl', 'scores', 'sports state'],
    baseScore: 0.72,
    importance: 0.7,
    novelty: 0.3,
    quality: 0.86,
    momentum: 0.6,
  };
  assert.equal(isFrontierSourceAdmitted(item), true);
});
