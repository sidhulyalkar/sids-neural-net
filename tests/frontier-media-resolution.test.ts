import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frontierDeclaredImageWidth,
  frontierImageResolutionFallbacks,
  preferredFrontierImageSource,
} from '../lib/frontier/media/sourceResolution';

test('Guardian RSS thumbnails are promoted to a bounded source-authentic 2K transform', () => {
  const raw = 'https://i.guim.co.uk/img/media/54ddeb74f362e849e7d8685c4a445ebc44fc6034/298_0_6294_5034/master/6294.jpg?width=140&quality=85&auto=format&fit=max&s=abc123';
  const upgraded = preferredFrontierImageSource(raw);
  const url = new URL(upgraded);
  assert.equal(url.hostname, 'i.guim.co.uk');
  assert.equal(url.searchParams.get('width'), '2048');
  assert.equal(url.searchParams.get('quality'), '88');
  assert.equal(url.searchParams.get('auto'), 'format');
  assert.equal(url.searchParams.get('fit'), 'max');
  assert.equal(url.searchParams.get('s'), 'abc123');
});

test('Guardian 2K promotion never requests pixels wider than the identified master', () => {
  const raw = 'https://i.guim.co.uk/img/media/example/0_0_900_720/master/900.jpg?width=140&quality=85&auto=format&fit=max';
  assert.equal(frontierDeclaredImageWidth(preferredFrontierImageSource(raw)), 900);
});

test('already-higher-resolution and unrelated publisher media remain byte-for-byte unchanged', () => {
  const hd = 'https://i.guim.co.uk/img/media/example/0_0_2400_1600/master/2400.jpg?width=2200&quality=90&auto=format';
  const nasa = 'https://apod.nasa.gov/apod/image/2608/EarthShadow_Martin_4000.jpg';
  assert.equal(preferredFrontierImageSource(hd), hd);
  assert.equal(preferredFrontierImageSource(nasa), nasa);
});

test('malformed media values fail closed without inventing a URL', () => {
  assert.equal(preferredFrontierImageSource('not a url'), 'not a url');
  assert.equal(frontierDeclaredImageWidth('not a url'), undefined);
});


test('YouTube uses authentic HD maxres first with safe source resolution alternatives', () => {
  const poster = 'https://i.ytimg.com/vi/yvNpoXd3sRc/maxresdefault.jpg';
  assert.deepEqual(frontierImageResolutionFallbacks(poster), [
    'https://i.ytimg.com/vi/yvNpoXd3sRc/sddefault.jpg',
    'https://i.ytimg.com/vi/yvNpoXd3sRc/hqdefault.jpg',
  ]);
  assert.deepEqual(frontierImageResolutionFallbacks('https://i.ytimg.com/vi/../secret/maxresdefault.jpg'), []);
});

test('Guardian 140px discovery thumbnail exposes an authentic 1200px retry', () => {
  const url = 'https://i.guim.co.uk/img/media/example/0_0_2500_1667/master/2500.jpg?width=140&quality=70';
  const fallback = frontierImageResolutionFallbacks(url);
  assert.equal(fallback.length, 1);
  assert.equal(new URL(fallback[0]).searchParams.get('width'), '1200');
  assert.equal(new URL(fallback[0]).searchParams.get('quality'), '85');
  assert.deepEqual(frontierImageResolutionFallbacks('http://localhost/media.jpg'), []);
  assert.deepEqual(frontierImageResolutionFallbacks('https://untrusted.example/media.jpg'), []);
});
