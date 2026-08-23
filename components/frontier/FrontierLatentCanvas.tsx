'use client';

import { useEffect, useRef, useState } from 'react';
import {
  compileLatentProgram,
  defaultLatentCamera,
  latentEngagement,
  latentFreshness,
  type LatentCamera,
} from '@/lib/frontier/vector/latentRender';
import { FRONTIER_VECTOR_DIMENSION } from '@/lib/frontier/vector/math';
import { frontierVectorStore, type FrontierVectorSnapshot } from '@/lib/frontier/vector/vectorStore';
import styles from './frontier-latent.module.css';

type ProjectionResponse =
  | { type: 'projected'; requestId: string; positions: ArrayBuffer; explained: ArrayBuffer }
  | { type: 'error'; requestId: string; message: string };

export function FrontierLatentCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<LatentCamera>(defaultLatentCamera());
  const [count, setCount] = useState(0);
  const [explained, setExplained] = useState(0);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    })!;
    if (!gl) {
      setEmpty(true);
      return;
    }

    let shaderProgram: WebGLProgram;
    try { shaderProgram = compileLatentProgram(gl); } catch {
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
    let lastX = 0;
    let lastY = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function requestDraw() {
      if (frame !== undefined || destroyed) return;
      frame = window.requestAnimationFrame(draw);
    }

    function resize() {
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
    }

    function draw(now: number) {
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

      const motion = Math.abs(camera.yawVelocity) + Math.abs(camera.pitchVelocity)
        + Math.abs(camera.zoomVelocity) + Math.abs(camera.panXVelocity) + Math.abs(camera.panYVelocity);
      if ((dragging || motion > 0.00015) && !reducedMotion) requestDraw();
    }

    function upload(positions: Float32Array, records: FrontierVectorSnapshot[]) {
      const now = Date.now();
      const interleaved = new Float32Array(records.length * 5);
      for (let index = 0; index < records.length; index += 1) {
        interleaved[index * 5] = positions[index * 3];
        interleaved[index * 5 + 1] = positions[index * 3 + 1];
        interleaved[index * 5 + 2] = positions[index * 3 + 2];
        interleaved[index * 5 + 3] = latentFreshness(records[index], now);
        interleaved[index * 5 + 4] = latentEngagement(records[index]);
      }
      pointCount = records.length;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
      setCount(records.length);
      requestDraw();
    }

    async function project() {
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
        worker.onerror = () => { if (!destroyed) setEmpty(true); };
        worker.onmessage = (event: MessageEvent<ProjectionResponse>) => {
          const response = event.data;
          if (destroyed || response.requestId !== requestId) return;
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
        worker.postMessage({ type: 'project', requestId, matrix: transfer, rows: records.length, dimensions: FRONTIER_VECTOR_DIMENSION }, [transfer]);
      } catch {
        setEmpty(true);
      }
    }

    const idleWindow = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number };
    if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(() => void project(), { timeout: 700 });
    else window.setTimeout(() => void project(), 32);

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      panning = event.shiftKey || event.button === 1 || event.button === 2;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
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
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      requestDraw();
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = Math.max(-120, Math.min(120, event.deltaY));
      const change = -delta * 0.0019;
      const camera = cameraRef.current;
      camera.zoom = Math.max(0.8, Math.min(5.2, camera.zoom + change));
      camera.zoomVelocity = reducedMotion ? 0 : change * 0.16;
      requestDraw();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === '/') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('[aria-label="Search FRONTIER topics"]')?.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cameraRef.current = defaultLatentCamera();
        requestDraw();
      }
    };
    const onResize = () => requestDraw();
    const onVisibility = () => { if (document.visibilityState === 'visible') requestDraw(); };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    requestDraw();

    return () => {
      destroyed = true;
      worker?.terminate();
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(shaderProgram);
    };
  }, []);

  if (empty) return <div className={styles.empty}>Your latent map will appear as FRONTIER learns more of your reading history.</div>;

  return (
    <div className={styles.shell}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="3D map of your local FRONTIER reading vectors" tabIndex={0} />
      <div className={styles.meta}>Local latent topography<strong>{count ? `${count} discoveries` : 'Mapping…'}</strong>{count ? <span>{Math.round(explained * 100)}% visible variance</span> : null}</div>
      <p className={styles.hint}>Drag to orbit · Shift-drag to pan · Wheel to zoom · Esc resets · / returns to search</p>
    </div>
  );
}
