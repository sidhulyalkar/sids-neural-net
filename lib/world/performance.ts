/** Bounded, active-frame-only diagnostics; no network analytics or persistent data. */
export class FrameSampler {
  private samples: number[] = [];
  private elapsed = 0;
  reset() { this.samples = []; this.elapsed = 0; }
  add(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    this.samples.push(seconds * 1000);
    this.elapsed += seconds;
    if (this.elapsed < 3 && this.samples.length < 1024) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const result = {
      fps: this.samples.length / this.elapsed,
      p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
      p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
      frames: sorted.length,
    };
    this.reset();
    return result;
  }
}

/** Two consecutive slow windows avoid reacting to a single loading stall. */
export class QualityController {
  private slowWindows = 0;
  reset() { this.slowWindows = 0; }
  update(fps: number, dpr: number) {
    this.slowWindows = fps < 40 ? this.slowWindows + 1 : 0;
    if (this.slowWindows < 2) return dpr;
    this.reset();
    return Math.max(Math.min(dpr, 0.75), dpr - 0.25);
  }
}
