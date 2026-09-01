import assert from 'node:assert/strict';
import test from 'node:test';
import { CameraSession } from '../lib/media/CameraSession';

function fakeVideo(): HTMLVideoElement {
  return {
    srcObject: null,
    muted: false,
    playsInline: false,
    async play() {},
    pause() {},
  } as unknown as HTMLVideoElement;
}

test('camera sessions with matching constraints share one physical stream until the final lease releases', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let getUserMediaCalls = 0;
  let stopCalls = 0;
  const track = {
    stop() { stopCalls += 1; },
    addEventListener() {},
  };
  const stream = {
    active: true,
    getTracks() { return [track]; },
  } as unknown as MediaStream;

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        async getUserMedia() {
          getUserMediaCalls += 1;
          return stream;
        },
      },
    },
  });

  try {
    const constraints: MediaTrackConstraints = { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: 'user' };
    const first = new CameraSession();
    const second = new CameraSession();
    const firstVideo = fakeVideo();
    const secondVideo = fakeVideo();

    await Promise.all([
      first.start(firstVideo, constraints),
      second.start(secondVideo, { facingMode: 'user', height: { ideal: 360 }, width: { ideal: 640 } }),
    ]);

    assert.equal(getUserMediaCalls, 1);
    assert.equal(firstVideo.srcObject, stream);
    assert.equal(secondVideo.srcObject, stream);

    first.stop();
    assert.equal(stopCalls, 0);
    assert.equal(firstVideo.srcObject, null);
    assert.equal(secondVideo.srcObject, stream);

    second.stop();
    assert.equal(stopCalls, 1);
    assert.equal(secondVideo.srcObject, null);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete (globalThis as { navigator?: Navigator }).navigator;
  }
});