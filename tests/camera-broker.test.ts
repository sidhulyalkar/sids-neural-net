import assert from 'node:assert/strict';
import test from 'node:test';
import { CameraBroker } from '../lib/media/CameraBroker';

type FakeTrack = {
  readyState: 'live' | 'ended';
  stopCalls: number;
  stop: () => void;
  addEventListener: () => void;
};

function fakeMediaStream() {
  const track: FakeTrack = {
    readyState: 'live',
    stopCalls: 0,
    stop() {
      this.stopCalls += 1;
      this.readyState = 'ended';
    },
    addEventListener() {},
  };
  const stream = {
    get active() { return track.readyState === 'live'; },
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track };
}

test('camera broker shares one physical stream until the final lease releases', async () => {
  const { stream, track } = fakeMediaStream();
  let acquisitions = 0;
  const broker = new CameraBroker(async () => {
    acquisitions += 1;
    return stream;
  });

  const [frontier, persona] = await Promise.all([
    broker.acquire({ width: { ideal: 640 }, facingMode: 'user' }),
    broker.acquire({ height: { ideal: 480 }, facingMode: 'user' }),
  ]);

  assert.equal(acquisitions, 1, 'concurrent consumers must share one getUserMedia request');
  assert.equal(frontier.stream, persona.stream);
  assert.equal(broker.activeLeaseCount, 2);

  frontier.release();
  assert.equal(track.stopCalls, 0, 'one consumer cannot terminate another consumer camera lease');
  assert.equal(broker.activeLeaseCount, 1);
  assert.equal(broker.active, true);

  persona.release();
  assert.equal(track.stopCalls, 1, 'the physical track stops exactly once after the final release');
  assert.equal(broker.activeLeaseCount, 0);
  assert.equal(broker.active, false);

  persona.release();
  assert.equal(track.stopCalls, 1, 'lease release is idempotent');
});

test('camera broker reacquires after the previous physical stream is fully released', async () => {
  const first = fakeMediaStream();
  const second = fakeMediaStream();
  const streams = [first.stream, second.stream];
  let acquisitions = 0;
  const broker = new CameraBroker(async () => streams[acquisitions++]);

  const leaseA = await broker.acquire({ facingMode: 'user' });
  leaseA.release();
  const leaseB = await broker.acquire({ facingMode: 'user' });

  assert.equal(acquisitions, 2);
  assert.notEqual(leaseA.stream, leaseB.stream);
  assert.equal(first.track.stopCalls, 1);
  leaseB.release();
  assert.equal(second.track.stopCalls, 1);
});
