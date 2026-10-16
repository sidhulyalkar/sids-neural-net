import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frontierDeclaredImageWidth,
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
