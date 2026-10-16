import type { FrontierVectorSnapshot } from './vectorStore';

export const LATENT_VERTEX_SHADER = `#version 300 es
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

export const LATENT_FRAGMENT_SHADER = `#version 300 es
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

export type LatentCamera = {
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

export function defaultLatentCamera(): LatentCamera {
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

export function compileLatentProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const compile = (type: number, source: string) => {
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
  };
  const vertex = compile(gl.VERTEX_SHADER, LATENT_VERTEX_SHADER);
  const fragment = compile(gl.FRAGMENT_SHADER, LATENT_FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create latent program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Latent program link failed';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

export function latentFreshness(record: FrontierVectorSnapshot, now: number): number {
  const published = record.publishedAt ? new Date(record.publishedAt).getTime() : record.createdAt;
  if (!Number.isFinite(published)) return 0.35;
  const ageDays = Math.max(0, (now - published) / 86_400_000);
  return Math.max(0.06, Math.pow(0.5, ageDays / 14));
}

export function latentEngagement(record: FrontierVectorSnapshot): number {
  const score = Number.isFinite(record.engagement) ? (record.engagement ?? 0) : 0;
  return Math.max(0.06, Math.min(1, 0.5 + 0.5 * Math.tanh(score / 2.3)));
}

export function projectLatentPoint(
  position: Float32Array,
  index: number,
  camera: LatentCamera,
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
