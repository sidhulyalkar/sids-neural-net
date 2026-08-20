// Interpolates playback position between the ~1Hz Spotify `playback_update` events
// using an injected wall clock, so callers get a smooth per-frame position.
export class PlaybackClock {
  private lastPositionMs = 0;
  private lastWallMs = 0;
  private playing = false;

  update(positionMs: number, isPaused: boolean, wallMs: number) {
    this.lastPositionMs = Math.max(0, positionMs);
    this.lastWallMs = wallMs;
    this.playing = !isPaused;
  }

  reset(wallMs = 0) {
    this.lastPositionMs = 0;
    this.lastWallMs = wallMs;
    this.playing = false;
  }

  positionMs(wallMs: number): number {
    if (!this.playing) return this.lastPositionMs;
    return Math.max(0, this.lastPositionMs + (wallMs - this.lastWallMs));
  }

  get isPlaying() {
    return this.playing;
  }
}
