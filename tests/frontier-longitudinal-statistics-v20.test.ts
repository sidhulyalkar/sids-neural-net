import assert from 'node:assert/strict';
import test from 'node:test';
import {
  benjaminiHochbergQValues,
  exactConditionalPoissonRatePValue,
} from '../lib/frontier/longitudinalStatistics';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function poisson(lambda: number, random: () => number): number {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= Math.max(Number.MIN_VALUE, random());
  } while (product > limit);
  return count - 1;
}

test('exact conditional rate test is symmetric and respects unequal exposure', () => {
  assert.equal(exactConditionalPoissonRatePValue(0, 1, 0, 9), 1);
  assert.ok(Math.abs(exactConditionalPoissonRatePValue(0, 1, 4, 1) - 0.125) < 1e-12);
  assert.ok(Math.abs(
    exactConditionalPoissonRatePValue(2, 1, 12, 1)
      - exactConditionalPoissonRatePValue(12, 1, 2, 1),
  ) < 1e-12);
  assert.ok(exactConditionalPoissonRatePValue(2, 2, 8, 8) > 0.99,
    'proportional counts across unequal exposure should be compatible with equal rates');
  assert.ok(exactConditionalPoissonRatePValue(2, 8, 8, 2) < 0.001,
    'the same counts with reversed exposure should be strongly incompatible with equal rates');
});

test('Benjamini-Hochberg adjustment is monotone in ranked p-values and preserves input order', () => {
  const q = benjaminiHochbergQValues([0.04, 0.001, 0.03, 1]);
  assert.deepEqual(q.map((value) => Number(value.toFixed(6))), [0.053333, 0.004, 0.053333, 1]);
});

test('global-null Poisson simulation remains conservative with unequal exposure denominators', () => {
  const random = seededRandom(0x12345678);
  const families = 400;
  const topics = 32;
  let familiesWithDiscovery = 0;

  for (let family = 0; family < families; family += 1) {
    const pValues: number[] = [];
    for (let topic = 0; topic < topics; topic += 1) {
      const recentExposure = 1 + Math.floor(random() * 8);
      const previousExposure = 1 + Math.floor(random() * 8);
      const commonRate = 0.8;
      pValues.push(exactConditionalPoissonRatePValue(
        poisson(commonRate * recentExposure, random), recentExposure,
        poisson(commonRate * previousExposure, random), previousExposure,
      ));
    }
    if (benjaminiHochbergQValues(pValues).some((value) => value <= 0.1)) familiesWithDiscovery += 1;
  }

  const empiricalFalseDiscoveryFamilyRate = familiesWithDiscovery / families;
  assert.ok(empiricalFalseDiscoveryFamilyRate <= 0.1,
    `global-null family discovery rate ${empiricalFalseDiscoveryFamilyRate} exceeded nominal 0.1`);
});

test('bursty overdispersion is explicitly recognized as outside the Poisson calibration envelope', () => {
  const random = seededRandom(0x9abcdef0);
  const families = 200;
  const topics = 32;
  let familiesWithDiscovery = 0;

  for (let family = 0; family < families; family += 1) {
    const pValues: number[] = [];
    for (let topic = 0; topic < topics; topic += 1) {
      const recentExposure = 1 + Math.floor(random() * 8);
      const previousExposure = 1 + Math.floor(random() * 8);
      const recentBurst = -Math.log(Math.max(Number.MIN_VALUE, random()));
      const previousBurst = -Math.log(Math.max(Number.MIN_VALUE, random()));
      pValues.push(exactConditionalPoissonRatePValue(
        poisson(0.8 * recentExposure * recentBurst, random), recentExposure,
        poisson(0.8 * previousExposure * previousBurst, random), previousExposure,
      ));
    }
    if (benjaminiHochbergQValues(pValues).some((value) => value <= 0.1)) familiesWithDiscovery += 1;
  }

  const misspecifiedFamilyRate = familiesWithDiscovery / families;
  assert.ok(misspecifiedFamilyRate > 0.1,
    'the sensitivity fixture should demonstrate that bursty overdispersion breaks nominal Poisson calibration');
});
