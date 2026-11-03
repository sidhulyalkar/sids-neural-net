import assert from 'node:assert/strict';
import test from 'node:test';
import { SIGNAL_TRAIL_POINTS, signalScoreAtX, signalScoreLabel, validSignalScore } from '../lib/frontier/signalTrail';

test('signal trail has exactly ten reachable stable score positions', () => {
  assert.equal(SIGNAL_TRAIL_POINTS.length, 10);
  assert.equal(new Set(SIGNAL_TRAIL_POINTS.map(([x]) => x)).size, 10);
  assert.ok(SIGNAL_TRAIL_POINTS.every(([x,y]) => x >= 0 && x <= 360 && y >= 0 && y <= 78));
  assert.ok(SIGNAL_TRAIL_POINTS.every(([x],i) => i === 0 || x > SIGNAL_TRAIL_POINTS[i-1][0]));
});

test('only discrete valid user-selected scores can be saved', () => {
  for(let n=1;n<=10;n++) {
    assert.equal(validSignalScore(n), true);
    assert.notEqual(signalScoreLabel(n).trim(), '');
  }
  for(const invalid of [-1,0,10.5,11,NaN,Infinity]) assert.equal(validSignalScore(invalid),false);
});

test('interest labels convey personal reaction, not claims about article quality', () => {
  assert.equal(signalScoreLabel(1),'Not for me');
  assert.equal(signalScoreLabel(5),'Worth exploring');
  assert.equal(signalScoreLabel(10),'Exceptional');
});

test('pointer positions match displayed nodes on desktop and narrow phones', () => {
  for (const width of [280, 318, 478]) {
    for (const left of [0, 42, 300]) {
      const center = (score: number) => left + width * SIGNAL_TRAIL_POINTS[score - 1][0] / 360;
      for (let score = 1; score <= 10; score++) {
        assert.equal(signalScoreAtX(center(score), left, width), score,
          `node ${score} must resolve identically at width ${width}`);
      }
      assert.equal(signalScoreAtX(left, left, width), 1, 'outside the first node clamps low');
      assert.equal(signalScoreAtX(left + width, left, width), 10, 'outside the last node clamps high');
    }
  }
});

test('invalid coordinates never produce an out-of-range or fractional rating', () => {
  assert.equal(signalScoreAtX(NaN, 0, 300), 5);
  assert.equal(signalScoreAtX(200, 0, 0), 5);
  assert.equal(signalScoreAtX(200, Infinity, 300), 5);
});
