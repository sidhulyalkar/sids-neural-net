import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBandEnergy, calculateRms, calculateSpectralCentroid, calculateSpectralFlux } from '../components/perceptual-cortex/audioFeatures';
import { advanceWorld, createInputSnapshot } from '../components/perceptual-cortex/fusionEngine';
import { createWorldState } from '../components/perceptual-cortex/signalTypes';

test('silent time-domain samples produce zero RMS', () => {
  assert.equal(calculateRms(new Uint8Array(32).fill(128)), 0);
});

test('RMS rises for an oscillating signal and remains normalized', () => {
  const samples = Uint8Array.from({ length: 64 }, (_, index) => index % 2 ? 192 : 64);
  const rms = calculateRms(samples);
  assert.ok(rms > .5 && rms <= 1);
});

test('band energy only aggregates bins inside the requested frequency range', () => {
  const bins = new Uint8Array(16); bins[2] = 255; bins[12] = 255;
  assert.ok(calculateBandEnergy(bins, 1600, 32, 50, 200) > 0);
  assert.equal(calculateBandEnergy(bins, 1600, 32, 300, 500), 0);
});

test('spectral centroid and positive flux track changes without retaining audio', () => {
  const previous = new Uint8Array([0, 10, 0, 0]);
  const current = new Uint8Array([0, 10, 0, 255]);
  assert.ok(calculateSpectralCentroid(current) > .8);
  assert.ok(calculateSpectralFlux(current, previous) > 0);
});

test('audio features enter fusion as artistic controls', () => {
  const input = createInputSnapshot(); const world = createWorldState();
  input.audioActive = true;
  input.audio = { rms: .8, smoothedRms: .7, lowEnergy: .6, midEnergy: .5, highEnergy: .4, spectralCentroid: .7, spectralFlux: .5, onset: .9 };
  advanceWorld(world, input, 1000, .1);
  assert.ok(world.oscillationAmplitude > .04);
  assert.ok(world.onsetImpulse >= .9);
  assert.ok(world.activeModalities.includes('audio'));
});
