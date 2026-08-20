import type { Vec3 } from './types';

export type RandomSource = () => number;

/** Mulberry32-style deterministic PRNG. */
export function makeRandom(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deriveSeed(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

export function range(random: RandomSource, min: number, max: number): number {
  return min + (max - min) * random();
}

export function pick<T>(random: RandomSource, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]!;
}

export function chance(random: RandomSource, probability: number): boolean {
  return random() < probability;
}

export function sampleAnnulus(
  random: RandomSource,
  minRadius: number,
  maxRadius: number,
  minHeight = 0,
  maxHeight = 0
): Vec3 {
  const angle = random() * Math.PI * 2;
  const radiusSquared = range(random, minRadius * minRadius, maxRadius * maxRadius);
  const radius = Math.sqrt(radiusSquared);
  return [Math.cos(angle) * radius, range(random, minHeight, maxHeight), Math.sin(angle) * radius];
}

export function pointAlongRibbon(index: number, count: number, width: number, length: number, seed: number): Vec3 {
  const random = makeRandom(deriveSeed(seed, index));
  const t = count <= 1 ? 0 : index / (count - 1);
  const z = length * (0.5 - t);
  const wave = Math.sin(t * Math.PI * 2.4 + seed * 0.013) * width * 0.55;
  return [wave + range(random, -width * 0.15, width * 0.15), 0, z];
}

export function finiteVec3(value: Vec3): boolean {
  return value.every(Number.isFinite);
}

export function distanceXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}