import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INTEREST_MAX_HOLD_MS,
  INTEREST_MIN_HOLD_MS,
  holdToInterestScore,
  interestScoreReaction,
  validInterestScore,
} from '../lib/frontier/interestRating';

test('quick taps and invalid durations do not submit an accidental preference', () => {
  assert.equal(holdToInterestScore(0), null);
  assert.equal(holdToInterestScore(INTEREST_MIN_HOLD_MS - 1), null);
  assert.equal(holdToInterestScore(Number.NaN), null);
  assert.equal(holdToInterestScore(-100), null);
});

test('hold duration maps monotonically and is capped to 1–10', () => {
  assert.equal(holdToInterestScore(INTEREST_MIN_HOLD_MS), 1);
  assert.equal(holdToInterestScore(INTEREST_MAX_HOLD_MS), 10);
  assert.equal(holdToInterestScore(90_000), 10);
  let prior = 1;
  for (let time = INTEREST_MIN_HOLD_MS; time <= INTEREST_MAX_HOLD_MS; time += 20) {
    const value = holdToInterestScore(time);
    assert.ok(value !== null);
    assert.ok(value >= prior);
    assert.ok(value <= 10);
    prior = value;
  }
});

test('explicit numerical rating preserves coarse taste semantics', () => {
  assert.equal(interestScoreReaction(1), 'down');
  assert.equal(interestScoreReaction(3), 'meh');
  assert.equal(interestScoreReaction(5), 'read');
  assert.equal(interestScoreReaction(6), 'useful');
  assert.equal(interestScoreReaction(8), 'up');
  assert.equal(interestScoreReaction(10), 'love');
});

test('only exact discrete ratings can be saved', () => {
  assert.equal(validInterestScore(1), true);
  assert.equal(validInterestScore(10), true);
  assert.equal(validInterestScore(0), false);
  assert.equal(validInterestScore(11), false);
  assert.equal(validInterestScore(5.5), false);
});
