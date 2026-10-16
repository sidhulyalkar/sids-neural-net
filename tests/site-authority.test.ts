import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { CANONICAL_SITE_URL, canonicalSiteUrl } from '../lib/siteAuthority';

const RETIRED_DOMAIN = 'sidsneural.net';
const AUTHORITY_FILES = [
  'app/layout.tsx',
  'app/robots.ts',
  'app/sitemap.ts',
  '.env.example',
];

test('canonical production identity is fixed to sidhulyalkar.com', () => {
  assert.equal(CANONICAL_SITE_URL, 'https://sidhulyalkar.com');
  assert.equal(canonicalSiteUrl(), 'https://sidhulyalkar.com');
  assert.equal(canonicalSiteUrl('/frontier'), 'https://sidhulyalkar.com/frontier');
  assert.equal(canonicalSiteUrl('frontier'), 'https://sidhulyalkar.com/frontier');
});

test('robots and sitemap publish only the canonical production origin', () => {
  assert.equal(robots().sitemap, 'https://sidhulyalkar.com/sitemap.xml');

  const entries = sitemap();
  assert(entries.length > 0);
  for (const entry of entries) {
    assert.equal(new URL(entry.url).origin, CANONICAL_SITE_URL, `non-canonical sitemap URL: ${entry.url}`);
  }
});

test('canonical-authority files cannot reference the retired domain', () => {
  for (const relativePath of AUTHORITY_FILES) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
    assert.equal(source.includes(RETIRED_DOMAIN), false, `${relativePath} still references ${RETIRED_DOMAIN}`);
  }
});
