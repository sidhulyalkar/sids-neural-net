'use client';

import { mediaDecodeScale } from '@/lib/frontier/media/capabilities';
import { FrontierMediaScheduler, type FrontierMediaPriority } from '@/lib/frontier/media/scheduler';
import { frontierMediaTelemetry } from '@/lib/frontier/media/telemetry';
import { FrontierTextureCache } from '@/lib/frontier/media/textureCache';

type SurfaceState = 'loading' | 'ready' | 'fallback';

type Registration = {
  id: string;
  node: HTMLElement;
  src: string;
  onState: (state: SurfaceState) => void;
  near: boolean;
  textureKey?: string;
  releaseTimer?: number;
  failedUntil?: number;
};

type WorkerSuccess = {
  id: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  decodeMs: number;
};

type WorkerFailure = {
  id: string;
  error: string;
};

type PendingDecode = {
  resolve: (payload: WorkerSuccess) => void;
  reject: (error: Error) => void;
};

const TEXTURE_RELEASE_DELAY_MS = 12_000;
const FAILED_RETRY_MS = 45_000;

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
in vec2 v_uv;
out vec4 outColor;
void main() {
  outColor = texture(u_texture, v_uv);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'WebGL shader compilation failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL program');
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'WebGL program linking failed';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function gpuBudgetBytes(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 4;
  const mobile = window.innerWidth < 720;
  if (mobile || memory <= 2) return 64 * 1024 * 1024;
  if (memory <= 4) return 112 * 1024 * 1024;
  return 160 * 1024 * 1024;
}

function visibleRect(rect: DOMRect): boolean {
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
}

function textureCoordinates(textureWidth: number, textureHeight: number, rect: DOMRect): [number, number, number, number] {
  const imageAspect = textureWidth / Math.max(1, textureHeight);
  const slotAspect = rect.width / Math.max(1, rect.height);
  let u0 = 0;
  let u1 = 1;
  let v0 = 0;
  let v1 = 1;
  if (imageAspect > slotAspect) {
    const visible = slotAspect / imageAspect;
    u0 = (1 - visible) / 2;
    u1 = 1 - u0;
  } else if (imageAspect < slotAspect) {
    const visible = imageAspect / slotAspect;
    v0 = (1 - visible) / 2;
    v1 = 1 - v0;
  }
  return [u0, v0, u1, v1];
}

class FrontierImagePlane {
  private readonly registrations = new Map<string, Registration>();
  private readonly scheduler = new FrontierMediaScheduler(4);
  private readonly pending = new Map<string, PendingDecode>();
  private readonly observer: IntersectionObserver;
  private readonly resizeObserver: ResizeObserver;
  private canvas?: HTMLCanvasElement;
  private gl?: WebGL2RenderingContext;
  private program?: WebGLProgram;
  private buffer?: WebGLBuffer;
  private cache?: FrontierTextureCache;
  private worker?: Worker;
  private raf?: number;
  private idleDestroyTimer?: number;
  private destroyed = false;
  private gpuAvailable = true;

  constructor() {
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.frontierGpuId;
        if (!id) continue;
        const registration = this.registrations.get(id);
        if (!registration) continue;
        registration.near = entry.isIntersecting;
        if (entry.isIntersecting) {
          if (registration.releaseTimer !== undefined) {
            window.clearTimeout(registration.releaseTimer);
            registration.releaseTimer = undefined;
          }
          this.ensureTexture(registration);
        } else {
          this.scheduler.cancel(`image:${id}`);
          this.scheduleTextureRelease(registration);
        }
      }
      this.invalidate();
    }, { rootMargin: '700px 0px', threshold: 0 });

    this.resizeObserver = new ResizeObserver(() => this.invalidate(true));
    this.mount();
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  register(input: Omit<Registration, 'near'>): () => void {
    if (this.destroyed) {
      input.onState('fallback');
      return () => undefined;
    }
    if (this.idleDestroyTimer !== undefined) {
      window.clearTimeout(this.idleDestroyTimer);
      this.idleDestroyTimer = undefined;
    }
    const existing = this.registrations.get(input.id);
    if (existing && existing.node !== input.node) this.unregister(input.id);

    input.node.dataset.frontierGpuId = input.id;
    const registration: Registration = { ...input, near: false };
    this.registrations.set(input.id, registration);
    this.observer.observe(input.node);
    this.resizeObserver.observe(input.node);
    input.onState(this.gpuAvailable ? 'loading' : 'fallback');
    this.invalidate(true);

    return () => this.unregister(input.id);
  }

  private unregister(id: string): void {
    const registration = this.registrations.get(id);
    if (!registration) return;
    this.observer.unobserve(registration.node);
    this.resizeObserver.unobserve(registration.node);
    this.scheduler.cancel(`image:${id}`);
    if (registration.releaseTimer !== undefined) window.clearTimeout(registration.releaseTimer);
    this.releaseRegistrationTexture(registration);
    delete registration.node.dataset.frontierGpuId;
    this.registrations.delete(id);
    this.invalidate();
    if (!this.registrations.size) {
      this.idleDestroyTimer = window.setTimeout(() => {
        if (!this.registrations.size) this.destroy();
      }, 3_000);
    }
  }

  private mount(): void {
    try {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, {
        position: 'fixed',
        inset: '0',
        width: '100vw',
        height: '100dvh',
        pointerEvents: 'none',
        zIndex: '42',
        contain: 'strict',
      });
      const gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
      });
      if (!gl) throw new Error('WebGL2 unavailable');

      const program = createProgram(gl);
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error('Unable to allocate media vertex buffer');

      this.canvas = canvas;
      this.gl = gl;
      this.program = program;
      this.buffer = buffer;
      this.cache = new FrontierTextureCache(gl, gpuBudgetBytes());
      document.body.appendChild(canvas);

      canvas.addEventListener('webglcontextlost', this.onContextLost, false);
      canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
      window.addEventListener('scroll', this.onViewportChange, { passive: true });
      window.addEventListener('resize', this.onViewportChange, { passive: true });
      document.addEventListener('visibilitychange', this.onVisibilityChange);

      try {
        this.worker = new Worker(new URL('./frontier-image.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (event: MessageEvent<WorkerSuccess | WorkerFailure>) => {
          const pending = this.pending.get(event.data.id);
          if (!pending) {
            if ('bitmap' in event.data) event.data.bitmap.close();
            return;
          }
          this.pending.delete(event.data.id);
          if ('bitmap' in event.data) pending.resolve(event.data);
          else pending.reject(new Error(event.data.error));
        };
      } catch {
        this.worker = undefined;
      }
    } catch {
      this.gpuAvailable = false;
      this.teardownGpuOnly();
    }
  }

  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    this.gpuAvailable = false;
    this.cache?.destroy();
    for (const registration of this.registrations.values()) {
      registration.textureKey = undefined;
      registration.onState('fallback');
    }
  };

  private readonly onContextRestored = () => {
    // Keep the semantic/native fallback stable. A new plane is acquired after
    // the current surfaces remount rather than risking a half-restored context.
    this.destroy();
  };

  private readonly onViewportChange = () => this.invalidate();
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      if (this.raf !== undefined) cancelAnimationFrame(this.raf);
      this.raf = undefined;
      return;
    }
    this.invalidate(true);
  };

  private invalidate(reevaluate = false): void {
    if (this.destroyed || document.visibilityState === 'hidden') return;
    if (reevaluate) {
      for (const registration of this.registrations.values()) {
        if (registration.near) this.ensureTexture(registration, true);
      }
    }
    if (this.raf !== undefined) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = undefined;
      this.render();
    });
  }

  private ensureTexture(registration: Registration, forceResize = false): void {
    if (!this.gpuAvailable || !this.cache || !registration.node.isConnected) {
      registration.onState('fallback');
      return;
    }
    if (registration.failedUntil && registration.failedUntil > Date.now()) {
      registration.onState('fallback');
      return;
    }
    const rect = registration.node.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;

    const scale = mediaDecodeScale();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.max(32, Math.min(1920, Math.round(rect.width * dpr * scale)));
    const height = Math.max(24, Math.min(1280, Math.round(rect.height * dpr * scale)));
    const textureKey = `${registration.src}|${width}x${height}`;
    if (!forceResize && registration.textureKey === textureKey && this.cache.has(textureKey)) return;
    if (registration.textureKey && registration.textureKey !== textureKey) this.releaseRegistrationTexture(registration);
    registration.textureKey = textureKey;
    if (this.cache.has(textureKey)) {
      registration.failedUntil = undefined;
      registration.onState('ready');
      this.invalidate();
      return;
    }

    registration.onState('loading');
    const priority: FrontierMediaPriority = visibleRect(rect) ? 'visible' : 'near';
    this.scheduler.enqueue({
      id: `image:${registration.id}`,
      priority,
      run: async (signal) => {
        try {
          const payload = await this.decode(registration.id, registration.src, width, height, signal);
          if (signal.aborted || !this.registrations.has(registration.id)) {
            payload.bitmap.close();
            frontierMediaTelemetry.requestCancelled();
            return;
          }
          frontierMediaTelemetry.imageDecoded(payload.decodeMs);
          this.cache?.put(textureKey, payload.bitmap);
          const current = this.registrations.get(registration.id);
          if (current?.textureKey === textureKey) {
            current.failedUntil = undefined;
            current.onState('ready');
          }
          this.invalidate();
        } catch (error) {
          if (signal.aborted) {
            frontierMediaTelemetry.requestCancelled();
            return;
          }
          const current = this.registrations.get(registration.id);
          if (current) {
            current.failedUntil = Date.now() + FAILED_RETRY_MS;
            current.onState('fallback');
          }
          throw error;
        }
      },
    });
  }

  private scheduleTextureRelease(registration: Registration): void {
    if (registration.releaseTimer !== undefined) window.clearTimeout(registration.releaseTimer);
    registration.releaseTimer = window.setTimeout(() => {
      registration.releaseTimer = undefined;
      if (registration.near || !this.registrations.has(registration.id)) return;
      this.releaseRegistrationTexture(registration);
      this.invalidate();
    }, TEXTURE_RELEASE_DELAY_MS);
  }

  private releaseRegistrationTexture(registration: Registration): void {
    const key = registration.textureKey;
    if (!key) return;
    registration.textureKey = undefined;
    const sharedByNearSurface = [...this.registrations.values()].some((candidate) =>
      candidate !== registration && candidate.near && candidate.textureKey === key
    );
    if (!sharedByNearSurface) this.cache?.remove(key);
  }

  private decode(id: string, url: string, width: number, height: number, signal: AbortSignal): Promise<WorkerSuccess> {
    if (!this.worker) return this.decodeOnMainThread(id, url, width, height, signal);
    const requestId = `${id}:${performance.now()}:${Math.random().toString(36).slice(2)}`;
    return new Promise<WorkerSuccess>((resolve, reject) => {
      const abort = () => {
        this.pending.delete(requestId);
        this.worker?.postMessage({ type: 'cancel', id: requestId });
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', abort, { once: true });
      this.pending.set(requestId, {
        resolve: (payload) => {
          signal.removeEventListener('abort', abort);
          resolve(payload);
        },
        reject: (error) => {
          signal.removeEventListener('abort', abort);
          reject(error);
        },
      });
      this.worker?.postMessage({ type: 'decode', id: requestId, url, width, height });
    });
  }

  private async decodeOnMainThread(id: string, url: string, width: number, height: number, signal: AbortSignal): Promise<WorkerSuccess> {
    const started = performance.now();
    const response = await fetch(url, { signal, credentials: 'omit', cache: 'force-cache' });
    if (!response.ok) throw new Error(`Image ${response.status}`);
    const bitmap = await createImageBitmap(await response.blob(), {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
      imageOrientation: 'from-image',
      premultiplyAlpha: 'premultiply',
    });
    if (signal.aborted) {
      bitmap.close();
      throw new DOMException('Aborted', 'AbortError');
    }
    return { id, bitmap, width: bitmap.width, height: bitmap.height, decodeMs: performance.now() - started };
  }

  private render(): void {
    const canvas = this.canvas;
    const gl = this.gl;
    const program = this.program;
    const buffer = this.buffer;
    const cache = this.cache;
    if (!canvas || !gl || !program || !buffer || !cache || !this.gpuAvailable) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.floor(window.innerWidth * dpr));
    const pixelHeight = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      cache.setBudget(gpuBudgetBytes());
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const uvLocation = gl.getAttribLocation(program, 'a_uv');
    gl.enableVertexAttribArray(positionLocation);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);

    for (const registration of this.registrations.values()) {
      if (!registration.near || !registration.textureKey) continue;
      const rect = registration.node.getBoundingClientRect();
      if (!visibleRect(rect)) continue;
      const entry = cache.get(registration.textureKey);
      if (!entry) {
        this.ensureTexture(registration);
        continue;
      }

      const left = (rect.left / window.innerWidth) * 2 - 1;
      const right = (rect.right / window.innerWidth) * 2 - 1;
      const top = 1 - (rect.top / window.innerHeight) * 2;
      const bottom = 1 - (rect.bottom / window.innerHeight) * 2;
      const [u0, v0, u1, v1] = textureCoordinates(entry.width, entry.height, rect);
      const vertices = new Float32Array([
        left, top, u0, v0,
        right, top, u1, v0,
        left, bottom, u0, v1,
        left, bottom, u0, v1,
        right, top, u1, v0,
        right, bottom, u1, v1,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.raf !== undefined) cancelAnimationFrame(this.raf);
    if (this.idleDestroyTimer !== undefined) window.clearTimeout(this.idleDestroyTimer);
    for (const registration of this.registrations.values()) {
      if (registration.releaseTimer !== undefined) window.clearTimeout(registration.releaseTimer);
      registration.onState('fallback');
    }
    this.scheduler.cancelAll();
    this.observer.disconnect();
    this.resizeObserver.disconnect();
    for (const [id, pending] of this.pending) {
      this.worker?.postMessage({ type: 'cancel', id });
      pending.reject(new Error('media plane destroyed'));
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = undefined;
    this.cache?.destroy();
    window.removeEventListener('scroll', this.onViewportChange);
    window.removeEventListener('resize', this.onViewportChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
      this.canvas.remove();
    }
    this.teardownGpuOnly();
    if (sharedPlane === this) sharedPlane = undefined;
  }

  private teardownGpuOnly(): void {
    this.canvas?.remove();
    this.canvas = undefined;
    this.cache = undefined;
    this.buffer = undefined;
    this.program = undefined;
    this.gl = undefined;
  }
}

let sharedPlane: FrontierImagePlane | undefined;

export function registerFrontierGpuImage(input: {
  id: string;
  node: HTMLElement;
  src: string;
  onState: (state: SurfaceState) => void;
}): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (!sharedPlane || sharedPlane.isDestroyed()) sharedPlane = new FrontierImagePlane();
  return sharedPlane.register(input);
}
