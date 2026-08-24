import assert from 'node:assert/strict';
import test from 'node:test';
import { assessFrontierHost } from '../lib/frontier/sourceTrust';

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
