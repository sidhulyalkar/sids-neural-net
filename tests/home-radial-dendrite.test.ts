import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const home = readFileSync(join(root, 'app/page.tsx'), 'utf8');
const radial = readFileSync(join(root, 'components/neural-atlas-canvas/RadialDendriteHome.tsx'), 'utf8');
const nav = readFileSync(join(root, 'src/data/siteNav.ts'), 'utf8');

test('homepage uses the eight-way radial dendrite renderer', () => {
  assert.match(home, /RadialDendriteHome/);
  assert.doesNotMatch(home, /personal live radar/);
  assert.match(radial, /const BRANCH_COUNT = 8/);
  assert.match(radial, /const ANGLE_STEP = \(Math\.PI \* 2\) \/ BRANCH_COUNT/);
  assert.match(radial, /data-home-branch-count=\{BRANCH_COUNT\}/);
});

test('all eight permanent destinations own a primary dendrite', () => {
  for (const [id, href] of [
    ['frontier', '/frontier'],
    ['games', '/arcade'],
    ['builds', '/projects'],
    ['systems', '/case-studies'],
    ['contact', '/contact'],
    ['visuals', '/photography'],
    ['research', '/ideas'],
    ['papers', '/publications'],
  ] as const) {
    assert.match(radial, new RegExp(`id: '${id}'.*href: '${href}'`));
  }

  assert.match(nav, /href: '\/frontier'/);
  assert.match(nav, /href: '\/arcade'/);
});

test('branch morphology stays balanced across all eight arms', () => {
  assert.match(radial, /DESTINATIONS\.forEach\(\(destination, branchIndex\) =>/);
  assert.match(radial, /const secondaryCount = geometry\.compact \? 2 : 3/);
  assert.match(radial, /const twigCount = 2/);
  assert.match(radial, /const tipSprayCount = geometry\.compact \? 3 : 4/);
  assert.match(radial, /branchIndex \* ANGLE_STEP/);
  assert.doesNotMatch(radial, /primaryCount = wideViewport/);
});

test('responsive geometry is viewport-derived and resize-safe', () => {
  assert.match(radial, /ResizeObserver/);
  assert.match(radial, /window\.visualViewport\?\.addEventListener\('resize'/);
  assert.match(radial, /const compact = dimensions\.width < 640/);
  assert.match(radial, /const short = dimensions\.height < 620/);
  assert.match(radial, /VISUAL_LIMITS\.dprCap/);
  assert.match(radial, /compactLabel/);
});
