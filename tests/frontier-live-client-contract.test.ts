import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const experience = readFileSync(new URL('../components/frontier/FrontierExperience.tsx', import.meta.url), 'utf8');

test('manual refresh always returns to the live server rather than consuming the pending queue as a substitute', () => {
  const block = experience.match(/const manualRefresh = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[[^\]]+\]\);/)?.[1] ?? '';
  assert.match(block, /clearPending\(\)/);
  assert.match(block, /await loadFeed\(true, focusSignatureRef\.current\)/);
  assert.match(block, /requestPoll\('manual-refresh'\)/);
  assert.doesNotMatch(block, /flushPending/);
  assert.doesNotMatch(block, /pendingCount/);
});

test('manual live pulls carry an explicit cache-busting request identity', () => {
  assert.match(experience, /params\.set\('fresh', '1'\)/);
  assert.match(experience, /params\.set\('request', `\$\{Date\.now\(\)\}-\$\{Math\.random\(\)/);
  assert.match(experience, /cache: 'no-store'/);
});

test('passive cold load stays snapshot-first across adaptive store hydration', () => {
  assert.match(experience, /const focusSignatureRef = useRef\(focusSignature\);/);
  assert.match(experience, /focusSignatureRef\.current = focusSignature;/);

  const loadBlock = experience.match(/const loadFeed = useCallback\(async \(forceFresh = false, focus = ''\) => \{([\s\S]*?)\n  \}, \[clearPending, spikeExploration\]\);/)?.[1] ?? '';
  assert.match(loadBlock, /const payload = await fetchPayload\(focus\);/);
  assert.match(loadBlock, /if \(!focus && !forceFresh && nextItems\.length\)/);
  assert.doesNotMatch(loadBlock, /activeSearch/);
  assert.doesNotMatch(loadBlock, /focusSignature/);

  assert.match(experience, /void loadFeed\(false, activeSearch \? focusSignatureRef\.current : ''\);/);
  assert.match(experience, /\}, \[activeSearch, loadFeed\]\);/);
  assert.doesNotMatch(experience, /\}, \[activeSearch, clearPending, focusSignature, spikeExploration\]\);/);
});

test('only the authoritative request may settle the loading skeleton', () => {
  const loadBlock = experience.match(/const loadFeed = useCallback\(async \(forceFresh = false, focus = ''\) => \{([\s\S]*?)\n  \}, \[clearPending, spikeExploration\]\);/)?.[1] ?? '';
  assert.match(loadBlock, /if \(requestRef\.current === controller\) \{\s*requestRef\.current = null;\s*setLoading\(false\);\s*\}/);
});

test('opportunistic local feed cache is bounded to hours rather than a day-plus stale window', () => {
  assert.match(experience, /FEED_CACHE_MAX_AGE_MS = 4 \* 60 \* 60_000/);
});

test('Today authority stays on the real realm-ranked cohort but runs after the useful-paint path', () => {
  assert.match(experience, /buildFrontierLiveAuthorityBridge/);
  assert.doesNotMatch(experience, /const liveAuthority = useMemo/);
  assert.match(experience, /const selectionToken = recordFrontierClientSelection\(\{/);
  assert.match(experience, /return scheduleFrontierDiagnostic\(\(\) => \{/);

  const schedulerIndex = experience.indexOf('return scheduleFrontierDiagnostic(() => {');
  const auditIndex = experience.indexOf('const authority = buildFrontierLiveAuthorityBridge({');
  assert(schedulerIndex >= 0 && auditIndex > schedulerIndex, 'authority counterfactual must remain inside the deferred scheduler');

  const authorityBlock = experience.slice(auditIndex, experience.indexOf('recordFrontierClientAuthority({', auditIndex));
  assert.match(authorityBlock, /realmRanked,/);
  assert.match(authorityBlock, /limit: INITIAL_BROWSE_TARGET/);
  assert.match(authorityBlock, /now,/);
  assert.match(authorityBlock, /pairEvidence,/);
  assert.match(authorityBlock, /sessionIntent,/);
  assert.match(authorityBlock, /directPreferenceEvidence,/);

  const patchBlock = experience.slice(
    experience.indexOf('recordFrontierClientAuthority({', auditIndex),
    experience.indexOf('});', experience.indexOf('recordFrontierClientAuthority({', auditIndex)) + 3,
  );
  assert.match(patchBlock, /selectionToken,/);
  assert.match(patchBlock, /rankAuthority: authority\.rankAuthority/);
  assert.match(patchBlock, /slateTasteAuthority: authority\.slateTasteAuthority/);
  assert.doesNotMatch(patchBlock, /items:/);
  assert.doesNotMatch(patchBlock, /realmRanked:/);
});
