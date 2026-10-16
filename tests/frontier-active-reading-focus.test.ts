import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const cssPath = path.resolve('components/frontier/frontier-fluid-interaction.module.css');
const css = fs.readFileSync(cssPath, 'utf8');

test('expanded FRONTIER reading surface uses a warm yellow layout-neutral focus ring', () => {
  assert.match(css, /\.card::after\s*\{[\s\S]*?position:\s*absolute;/);
  assert.match(css, /\.card::after\s*\{[\s\S]*?border:\s*1px solid transparent;/);
  assert.match(css, /\.card\[data-fluid-expanded='true'\]::after[\s\S]*?border-color:\s*rgba\(246, 210, 78, 0\.92\)/);
  assert.match(css, /\.card\[data-fluid-expanded='true'\]::after[\s\S]*?box-shadow:/);
});

test('active highlight cannot change the masonry card box model', () => {
  const cardBlock = css.match(/\.card\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.doesNotMatch(cardBlock, /\bborder(?:-width)?:/);
  assert.doesNotMatch(cardBlock, /\boutline(?:-width)?:/);
  assert.match(css, /\.card::after\s*\{[\s\S]*?pointer-events:\s*none;/);
});

test('keyboard focus receives the same visual locator without a second layout system', () => {
  assert.match(css, /\.card:focus-visible::after/);
  assert.match(css, /\.card:focus-visible\s*\{\s*outline:\s*none;/);
});
