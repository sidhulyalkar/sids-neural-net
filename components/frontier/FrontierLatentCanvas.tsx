'use client';

import { useEffect, useRef, useState } from 'react';
import { FRONTIER_VECTOR_DIMENSION } from '@/lib/frontier/vector/math';
import { frontierVectorStore, type FrontierVectorSnapshot } from '@/lib/frontier/vector/vectorStore';
import styles from './frontier-latent.module.css';

const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in float a_freshness;
layout(location=2) in float a_engagement;
uniform vec2 u_rotation;
uniform vec2 u_pan;
uniform float u_zoom;
uniform float u_aspect;
uniform float u_dpr;
out float v_freshness;
out float v_engagement;

void main() {
  float cy = cos(u_rotation.x), sy = sin(u_rotation.x);
  float cp = cos(u_rotation.y), sp = sin(u_rotation.y);
  vec3 p = a_position;
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  p = vec3(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);
  float depth = max(1.25, 2.8 - p.z * 0.65);
  vec2 projected = (p.xy * u_zoom + u_pan) / depth;
  projected.x /= max(0.5, u_aspect);
  gl_Position = vec4(projected, 0.0, 1.0);
  float energy = 0.55 * a_freshness + 0.45 * a_engagement;
  gl_PointSize = u_dpr * (2.2 + energy * 3.6) * clamp(2.0 / depth, 0.7, 1.45);
  v_freshness = a_freshness;
  v_engagement = a_engagement;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in float v_freshness;
in float v_engagement;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float radius = length(q);
  if (radius > 1.0) discard;
  float core = 1.0 - smoothstep(0.20, 0.92, radius);
  float halo = 1.0 - smoothstep(0.0, 1.0, radius);
  vec3 quiet = vec3(0.53, 0.60, 0.57);
  vec3 fresh = vec3(0.69, 0.82, 0.76);
  vec3 engaged = vec3(0.72, 0.76, 0.86);
  vec3 color = mix(quiet, fresh, v_freshness * 0.72);
  color = mix(color, engaged, v_engagement * 0.28);
  float alpha = (0.16 + v_freshness * 0.24 + v_engagement * 0.32) * (core + halo * 0.38);
  outColor = vec4(color, alpha);
}`;

type ProjectionResponse =
  | { type: 'projected'; requestId: string; positions: ArrayBuffer; explained: ArrayBuffer }
  | { type: 'error'; requestId: string; message: string };

type Camera = {
  yaw: number;
  pitch: number;
  zoom: number;
  panX: number;
  panY: number;
  yawVelocity: number;
  pitchVelocity: number;
  zoomVelocity: number;
  panXVelocity: number;
  panYVelocity: number;
};

type Tooltip = { x: number; y: number; title: string; meta: string };

function defaultCamera(): Camera {
  return {
    yaw: -0.34,
    pitch: 0.22,
    zoom: 2.28,
    panX: 0,
    panY: 0,
    yawVelocity: 0,
    pitchVelocity: 0,
    zoomVelocity: 0,
    panXVelocity: 0,
    panYVelocity: 0,
  };
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create latent shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Latent shader compile failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function program(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const output = gl.createProgram();
  if (!output) throw new Error('Unable to create latent program');
  gl.attachShader(output, vertex);
  gl.attachShader(output, fragment);
  gl.linkProgram(output);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(output, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(output) || 'Latent program link failed';
    gl.deleteProgram(output);
    throw new Error(message);
  }
  return output;
}

function freshness(record: FrontierVectorSnapshot, now: number): number {
  const published = record.publishedAt ? new Date(record.publishedAt).getTime() : record.createdAt;
  if (!Number.isFinite(published)) return 0.35;
  const ageDays = Math.max(0, (now - published) / 86_400_000);
  return Math.max(0.06, Math.pow(0.5, ageDays / 14));
}

function engagement(record: FrontierVectorSnapshot): number {
  const score = Number.isFinite(record.engagement) ? (record.engagement ?? 0) : 0;
  return Math.max(0.06, Math.min(1, 0.5 + 0.5 * Math.tanh(score / 2.3)));
}

function isEditable(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  return Boolean(node?.closest('input, textarea, select, [contenteditable="true"]'));
}

function projectedClientPoint(
  position: Float32Array,
  index: number,
  camera: Camera,
  rect: DOMRect
): { x: number; y: number } {
  const x = position[index * 3];
  const y = position[index * 3 + 1];
  const z = position[index * 3 + 2];
  const cy = Math.cos(camera.yaw);
  const sy = Math.sin(camera.yaw);
  const cp = Math.cos(camera.pitch);
  const sp = Math.sin(camera.pitch);
  const rx = cy * x + sy * z;
  const rz = -sy * x + cy * z;
  const ry = cp * y - sp * rz;
  const rz2 = sp * y + cp * rz;
  const depth = Math.max(1.25, 2.8 - rz2 * 0.65);
  const aspect = Math.max(0.5, rect.width / Math.max(1, rect.height));
  const ndcX = ((rx * camera.zoom + camera.panX) / depth) / aspect;
  const ndcY = (ry * camera.zoom + camera.panY) / depth;
  return {
    x: rect.left + (ndcX * 0.5 + 0.5) * rect.width,
    y: rect.top + (0.5 - ndcY * 0.5) * rect.height,
  };
}

export function FrontierLatentCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordsRef = useRef<FrontierVectorSnapshot[]>([]);
  const positionsRef = useRef<Float32Array>();
  const cameraRef = useRef<Camera>(defaultCamera());
  const [count, setCount] = useState(0);
  const [explained, setExplained] = useState(0);
  const [tooltip, setTooltip] = useState<Tooltip>();
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      setEmpty(true);
      return;
    }

    let shaderProgram: WebGLProgram;
    try { shaderProgram = program(gl); } catch {
      setEmpty(true);
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(shaderProgram);
      setEmpty(true);
      return;
    }

    const uniforms = {
      rotation: gl.getUniformLocation(shaderProgram, 'u_rotation'),
      pan: gl.getUniformLocation(shaderProgram, 'u_pan'),
      zoom: gl.getUniformLocation(shaderProgram, 'u_zoom'),
      aspect: gl.getUniformLocation(shaderProgram, 'u_aspect'),
      dpr: gl.getUniformLocation(shaderProgram, 'u_dpr'),
    };

    let worker: Worker | undefined;
    let destroyed = false;
    let frame: number | undefined;
    let pointCount = 0;
    let lastTime = performance.now();
    let dragging = false;
    let panning = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let pointerFrame: number | undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(1.8, Math.max(1, window.devicePixelRatio || 1));
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      return { rect, dpr };
    };

    const draw = (now: number) => {
      frame = undefined;
      if (destroyed || document.visibilityState === 'hidden') return;
      const { rect, dpr } = resize();
      const camera = cameraRef.current;
      const dt = Math.min(32, Math.max(1, now - lastTime)) / 16.667;
      lastTime = now;

      if (!reducedMotion) {
        camera.yaw += camera.yawVelocity * dt;
        camera.pitch = Math.max(-1.15, Math.min(1.15, camera.pitch + camera.pitchVelocity * dt));
        camera.zoom = Math.max(0.8, Math.min(5.2, camera.zoom + camera.zoomVelocity * dt));
        camera.panX += camera.panXVelocity * dt;
        camera.panY += camera.panYVelocity * dt;
        const damping = Math.pow(0.84, dt);
        camera.yawVelocity *= damping;
        camera.pitchVelocity *= damping;
        camera.zoomVelocity *= damping;
        camera.panXVelocity *= damping;
        camera.panYVelocity *= damping;
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(shaderProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);
      gl.uniform2f(uniforms.rotation, camera.yaw, camera.pitch);
      gl.uniform2f(uniforms.pan, camera.panX, camera.panY);
      gl.uniform1f(uniforms.zoom, camera.zoom);
      gl.uniform1f(uniforms.aspect, rect.width / Math.max(1, rect.height));
      gl.uniform1f(uniforms.dpr, dpr);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, pointCount);

      const moving = Math.abs(camera.yawVelocity) + Math.abs(camera.pitchVelocity)
        + Math.abs(camera.zoomVelocity) + Math.abs(camera.panXVelocity) + Math.abs(camera.panYVelocity) > 0.00015;
      if ((moving || dragging) && !reducedMotion) requestDraw();
    };

    const requestDraw = () => {
      if (frame !== undefined || destroyed) return;
      frame = window.requestAnimationFrame(draw);
    };

    const upload = (positions: Float32Array, records: FrontierVectorSnapshot[]) => {
      const now = Date.now();
      const interleaved = new Float32Array(records.length * 5);
      for (let index = 0; index < records.length; index += 1) {
        interleaved[index * 5] = positions[index * 3];
        interleaved[index * 5 + 1] = positions[index * 3 + 1];
        interleaved[index * 5 + 2] = positions[index * 3 + 2];
        interleaved[index * 5 + 3] = freshness(records[index], now);
        interleaved[index * 5 + 4] = engagement(records[index]);
      }
      pointCount = records.length;
      positionsRef.current = positions;
      recordsRef.current = records;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
      setCount(records.length);
      requestDraw();
    };

    const startProjection = async () => {
      let records: FrontierVectorSnapshot[] = [];
      try { records = await frontierVectorStore.snapshot(1_000); } catch { records = []; }
      if (destroyed) return;
      records = records.filter((record) => record.vector.length >= FRONTIER_VECTOR_DIMENSION).slice(0, 1_000);
      if (records.length < 4) {
        setEmpty(true);
        return;
      }

      const matrix = new Float32Array(records.length * FRONTIER_VECTOR_DIMENSION);
      for (let row = 0; row < records.length; row += 1) {
        matrix.set(records[row].vector.subarray(0, FRONTIER_VECTOR_DIMENSION), row * FRONTIER_VECTOR_DIMENSION);
      }

      try {
        worker = new Worker(new URL('./vector/latentProjectionWorker.ts', import.meta.url), { type: 'module' });
        const requestId = `${Date.now().toString(36)}-${records.length}`;
        worker.onmessage = (event: MessageEvent<ProjectionResponse>) => {
          const response = event.data;
          if (response.requestId !== requestId || destroyed) return;
          if (response.type === 'error') {
            setEmpty(true);
            return;
          }
          const positions = new Float32Array(response.positions);
          const variance = new Float32Array(response.explained);
          setExplained(Math.max(0, Math.min(1, variance[0] + variance[1] + variance[2])));
          setEmpty(false);
          upload(positions, records);
        };
        const transfer = matrix.buffer as ArrayBuffer;
        worker.postMessage({
          type: 'project',
          requestId,
          matrix: transfer,
          rows: records.length,
          dimensions: FRONTIER_VECTOR_DIMENSION,
        }, [transfer]);
      } catch {
        setEmpty(true);
      }
    };

    const scheduleProjection = () => {
      const idleWindow = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number };
      if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(() => void startProjection(), { timeout: 700 });
      else window.setTimeout(() => void startProjection(), 32);
    };

    const resetCamera = () => {
      cameraRef.current = defaultCamera();
      setTooltip(undefined);
      requestDraw();
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      panning = event.shiftKey || event.button === 1 || event.button === 2;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      setTooltip(undefined);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (dragging) {
        const dx = event.clientX - lastPointerX;
        const dy = event.clientY - lastPointerY;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        const camera = cameraRef.current;
        if (panning) {
          camera.panX += dx * 0.0028;
          camera.panY -= dy * 0.0028;
          camera.panXVelocity = dx * 0.0007;
          camera.panYVelocity = -dy * 0.0007;
        } else {
          camera.yaw += dx * 0.005;
          camera.pitch = Math.max(-1.15, Math.min(1.15, camera.pitch + dy * 0.004));
          camera.yawVelocity = dx * 0.0011;
          camera.pitchVelocity = dy * 0.0009;
        }
        requestDraw();
        return;
      }

      if (pointerFrame !== undefined) window.cancelAnimationFrame(pointerFrame);
      pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = undefined;
        const positions = positionsRef.current;
        const records = recordsRef.current;
        if (!positions?.length || !records.length) return;
        const rect = canvas.getBoundingClientRect();
        let nearest = -1;
        let nearestDistance = 13 * 13;
        for (let index = 0; index < records.length; index += 1) {
          const point = projectedClientPoint(positions, index, cameraRef.current, rect);
          const dx = point.x - event.clientX;
          const dy = point.y - event.clientY;
          const distance = dx * dx + dy * dy;
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = index;
          }
        }
        if (nearest < 0) {
          setTooltip(undefined);
          return;
        }
        const record = records[nearest];
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          title: record.title ?? 'Stored discovery',
          meta: [record.sourceLabel, record.lane].filter(Boolean).join(' · ') || 'local vector',
        });
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      requestDraw();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const camera = cameraRef.current;
      const delta = Math.max(-120, Math.min(120, event.deltaY));
      const change = -delta * 0.0019;
      camera.zoom = Math.max(0.8, Math.min(5.2, camera.zoom + change));
      camera.zoomVelocity = reducedMotion ? 0 : change * 0.16;
      requestDraw();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(event.target)) return;
      if (event.key === '/') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('[aria-label="Search FRONTIER topics"]')?.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        resetCamera();
      }
    };

    const onResize = () => requestDraw();
    const onVisibility = () => { if (document.visibilityState === 'visible') requestDraw(); };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = undefined;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('webglcontextlost', onContextLost);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    scheduleProjection();
    requestDraw();

    return () => {
      destroyed = true;
      worker?.terminate();
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (pointerFrame !== undefined) window.cancelAnimationFrame(pointerFrame);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(shaderProgram);
    };
  }, []);

  if (empty) {
    return <div className={styles.empty}>Your latent map will appear as FRONTIER learns more of your reading history.</div>;
  }

  return (
    <div className={styles.shell}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="3D map of your local FRONTIER reading vectors" tabIndex={0} />
      <div className={styles.meta}>
        Local latent topography
        <strong>{count ? `${count} discoveries` : 'Mapping…'}</strong>
        {count ? <span>{Math.round(explained * 100)}% visible variance</span> : null}
      </div>
      <p className={styles.hint}>Drag to orbit · Shift-drag to pan · Wheel to zoom · Esc resets · / returns to search</p>
      {tooltip ? (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.title}</strong>
          <span>{tooltip.meta}</span>
        </div>
      ) : null}
    </div>
  );
}
