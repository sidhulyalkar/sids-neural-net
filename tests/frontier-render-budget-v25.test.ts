import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

test('FRONTIER keeps non-critical canvas and bridge work off the immediate route path', () => {
  const page = readRepoFile('app/frontier/page.tsx');
  const deferred = readRepoFile('components/frontier/FrontierDeferredExtras.tsx');

  assert.ok(page.includes('<FrontierDeferredExtras />'));
  assert.ok(!page.includes("from '@/components/frontier/BackgroundCanvas'"));
  assert.ok(!page.includes("from '@/components/frontier/FrontierRuntimeControls'"));
  assert.ok(!page.includes("from '@/components/frontier/signals/SignalTelemetryBridge'"));
  assert.ok(!page.includes("from '@/components/frontier/sync/MeshStateBridge'"));

  assert.ok(deferred.includes('requestIdleCallback'));
  assert.ok(deferred.includes("lazy(() =>"));
  assert.ok(deferred.includes("import('./BackgroundCanvas')"));
  assert.ok(deferred.includes("import('./signals/SignalTelemetryBridge')"));
  assert.ok(deferred.includes("import('./sync/MeshStateBridge')"));
  assert.ok(deferred.includes("import('./FrontierRuntimeControls')"));
});

test('ambient canvas is suppressed for constrained or motion-sensitive clients', () => {
  const deferred = readRepoFile('components/frontier/FrontierDeferredExtras.tsx');

  assert.ok(deferred.includes('connection?.saveData'));
  assert.ok(deferred.includes("connection?.effectiveType === 'slow-2g'"));
  assert.ok(deferred.includes("connection?.effectiveType === '2g'"));
  assert.ok(deferred.includes("prefers-reduced-motion: reduce"));
});
