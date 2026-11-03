import assert from 'node:assert/strict';
import test from 'node:test';
import { SIGNAL_TRAIL_POINTS, signalScoreLabel, validSignalScore } from '../lib/frontier/signalTrail';

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
