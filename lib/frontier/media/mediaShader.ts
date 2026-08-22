export const FRONTIER_MEDIA_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
}`;

/**
 * Four-fetch bicubic reconstruction. The hardware bilinear sampler performs the
 * inner interpolation, so this is substantially cheaper than a literal 16-tap
 * kernel while avoiding the soft look of ordinary bilinear enlargement.
 *
 * The shader performs no synthetic saturation or sharpening. When the WebGL
 * drawing buffer is Display-P3, browser color management carries wide-gamut
 * source pixels through to the compositor without changing editorial content.
 */
export const FRONTIER_MEDIA_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform vec2 u_sourceSize;
uniform float u_useBicubic;
in vec2 v_uv;
out vec4 outColor;

vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) / 6.0;
}

vec4 bicubicSample(sampler2D tex, vec2 uv, vec2 sourceSize) {
  vec2 safeSize = max(sourceSize, vec2(1.0));
  vec2 invSize = 1.0 / safeSize;
  vec2 coord = uv * safeSize - 0.5;
  vec2 fractional = fract(coord);
  coord -= fractional;

  vec4 xcubic = cubic(fractional.x);
  vec4 ycubic = cubic(fractional.y);
  vec4 c = coord.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xcubic.xz + xcubic.yw, ycubic.xz + ycubic.yw);
  vec4 offset = c + vec4(xcubic.yw, ycubic.yw) / max(s, vec4(0.0001));
  offset *= invSize.xxyy;

  vec4 sample0 = texture(tex, offset.xz);
  vec4 sample1 = texture(tex, offset.yz);
  vec4 sample2 = texture(tex, offset.xw);
  vec4 sample3 = texture(tex, offset.yw);

  float sx = s.x / max(s.x + s.y, 0.0001);
  float sy = s.z / max(s.z + s.w, 0.0001);
  return mix(mix(sample3, sample2, sx), mix(sample1, sample0, sx), sy);
}

void main() {
  vec4 color = u_useBicubic > 0.5
    ? bicubicSample(u_texture, v_uv, u_sourceSize)
    : texture(u_texture, v_uv);
  outColor = color;
}`;

type WideGamutWebGl = WebGL2RenderingContext & {
  drawingBufferColorSpace?: 'srgb' | 'display-p3';
  unpackColorSpace?: 'srgb' | 'display-p3';
};

type WideGamutContextAttributes = WebGLContextAttributes & {
  colorSpace?: 'srgb' | 'display-p3';
};

export function prefersDisplayP3(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(color-gamut: p3)').matches;
}

export function frontierWebGlContextAttributes(): WideGamutContextAttributes {
  return {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    premultipliedAlpha: true,
    colorSpace: prefersDisplayP3() ? 'display-p3' : 'srgb',
  };
}

export function configureWideGamutDrawingBuffer(gl: WebGL2RenderingContext): 'display-p3' | 'srgb' {
  const wide = gl as WideGamutWebGl;
  const target = prefersDisplayP3() ? 'display-p3' : 'srgb';
  try {
    if ('drawingBufferColorSpace' in wide) wide.drawingBufferColorSpace = target;
    if ('unpackColorSpace' in wide) wide.unpackColorSpace = target;
  } catch {
    return 'srgb';
  }
  return wide.drawingBufferColorSpace === 'display-p3' ? 'display-p3' : 'srgb';
}

export function nativeMediaDpr(max = 2.5): number {
  if (typeof window === 'undefined') return 1;
  const raw = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
  return Math.min(max, Math.max(1, raw));
}

export function shouldUseBicubicUpscale(
  sourceWidth: number,
  sourceHeight: number,
  cssWidth: number,
  cssHeight: number,
  dpr = nativeMediaDpr()
): boolean {
  const targetWidth = Math.max(1, cssWidth * dpr);
  const targetHeight = Math.max(1, cssHeight * dpr);
  return sourceWidth < targetWidth * 0.92 || sourceHeight < targetHeight * 0.92;
}
