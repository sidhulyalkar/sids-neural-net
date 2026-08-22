'use client';

import { useEffect, useRef } from 'react';
import { FRONTIER_AMBIENT_EXPLORATION_EVENT } from '@/lib/frontier/ambientState';
import styles from './frontier-ambient.module.css';

const VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p * 0.5;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_exploration;

float fluidField(vec2 p, float time, float exploration) {
  float frequency = mix(1.35, 2.75, exploration);
  float speed = mix(0.065, 0.13, exploration);
  vec2 q = p;
  q.x += 0.22 * sin(p.y * (1.7 + exploration) + time * speed);
  q.y += 0.18 * cos(p.x * (1.35 + exploration * 0.9) - time * speed * 0.82);

  float a = sin((q.x + q.y * 0.63) * frequency + time * speed * 0.7);
  float b = cos((q.y - q.x * 0.48) * (frequency * 1.21) - time * speed * 0.93);
  float c = sin(length(q + vec2(0.45, -0.2)) * (2.7 + exploration * 1.9) - time * speed * 0.54);
  return (a + b + c) / 3.0;
}

void main() {
  vec2 uv = v_uv;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / max(1.0, u_resolution.y);

  float field = fluidField(p, u_time, u_exploration);
  float contours = 0.5 + 0.5 * sin(field * mix(5.0, 8.2, u_exploration));
  float vignette = smoothstep(1.45, 0.22, length(p * vec2(0.72, 0.92)));
  float energy = mix(0.26, 0.48, u_exploration) * vignette;

  vec3 base = vec3(0.012, 0.019, 0.016);
  vec3 cool = vec3(0.018, 0.033, 0.028);
  vec3 tint = mix(base, cool, (0.22 + contours * 0.38) * energy);
  float breathing = 0.0035 * sin(u_time * 0.055 + field * 1.6);
  tint += breathing * vec3(0.72, 1.0, 0.88);

  outColor = vec4(tint, 1.0);
}`;

type Props = {
  /** Optional controlled value. When omitted, the canvas listens to FRONTIER's recommendation-state event. */
  explorationVector?: number;
};

type Uniforms = {
  resolution: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  exploration: WebGLUniformLocation | null;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create ambient shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader) || 'Ambient shader compile failed';
    gl.deleteShader(shader);
    throw new Error(error);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create ambient program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program) || 'Ambient program link failed';
    gl.deleteProgram(program);
    throw new Error(error);
  }
  return program;
}

export function BackgroundCanvas({ explorationVector }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetExplorationRef = useRef(clamp01(explorationVector ?? 0.34));
  const controlledRef = useRef(explorationVector !== undefined);

  useEffect(() => {
    controlledRef.current = explorationVector !== undefined;
    if (explorationVector !== undefined) targetExplorationRef.current = clamp01(explorationVector);
  }, [explorationVector]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    let program: WebGLProgram;
    try {
      program = link(gl);
    } catch {
      return;
    }

    const uniforms: Uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      exploration: gl.getUniformLocation(program, 'u_exploration'),
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let displayedExploration = targetExplorationRef.current;
    let timeout: number | undefined;
    let frame: number | undefined;
    let stopped = false;
    let lastRender = 0;

    const resize = () => {
      const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
      // The shader is intentionally rendered below native media resolution. It is
      // a low-frequency atmospheric field, not content, so 0.72x preserves the
      // visual while cutting fragment work roughly in half on high-DPR screens.
      const renderScale = 0.72;
      const width = Math.max(1, Math.round(window.innerWidth * dpr * renderScale));
      const height = Math.max(1, Math.round(window.innerHeight * dpr * renderScale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const draw = (now: number) => {
      frame = undefined;
      if (stopped || document.visibilityState === 'hidden') return;
      resize();
      displayedExploration += (targetExplorationRef.current - displayedExploration) * 0.075;

      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, reducedMotion ? 0 : now / 1000);
      gl.uniform1f(uniforms.exploration, displayedExploration);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      lastRender = now;

      if (!reducedMotion) schedule();
    };

    const requestDraw = () => {
      if (frame !== undefined || stopped) return;
      frame = window.requestAnimationFrame(draw);
    };

    const schedule = () => {
      if (timeout !== undefined || stopped || reducedMotion) return;
      const elapsed = performance.now() - lastRender;
      const wait = Math.max(0, 42 - elapsed); // ~24 fps, one fullscreen draw call.
      timeout = window.setTimeout(() => {
        timeout = undefined;
        requestDraw();
      }, wait);
    };

    const onExploration = (event: Event) => {
      if (controlledRef.current) return;
      const value = (event as CustomEvent<number>).detail;
      if (Number.isFinite(value)) targetExplorationRef.current = clamp01(value);
      if (reducedMotion) requestDraw();
    };

    const onResize = () => requestDraw();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') requestDraw();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      stopped = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };

    window.addEventListener(FRONTIER_AMBIENT_EXPLORATION_EVENT, onExploration);
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onContextLost, false);
    requestDraw();

    return () => {
      stopped = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      window.removeEventListener(FRONTIER_AMBIENT_EXPLORATION_EVENT, onExploration);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      gl.deleteProgram(program);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
