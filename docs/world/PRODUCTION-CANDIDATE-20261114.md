# Sid's iLand · master-based production qualification candidate

**Status: DRAFT / NOT RELEASE-READY. No merge or production deployment authorized.**

## Provenance and safety
- Baseline: `master` commit `23bff8cfd42742ac60446dd75d392c7c771447d9` (2026-11-14).
- World source: non-ski quality PR #174 at `b670452b2dcb4bfd19032b69edcff6d3df7ceb05`, including its PR #171/#170 dependencies. The historical branch itself was **not merged**.
- Ski visual-sole PR #176 (`dbd9a0a2c3aa71806ad620187bd059633dc4c6bf`) is **NOT YET** integrated. It depends on PR #170 and overlaps non-ski camera/render paths; port only after review and new tests.
- Master keeps its existing fractal homepage at `/`. The candidate exposes the world separately at `/world`. No change to live production routing or content feeds.
- Explicit source selection: full `components/world`, `lib/world`, `docs/world`, `public/world`; the development-only guarded ski lab (production `notFound()`), all `tests/world-*`, new `scripts/playtest-*`, world audits, and the photo-place data required by `lib/world/content.ts`. No blanket selection of unrelated FRONTIER, publications, layout or home changes.
- The current-master photo archive is enriched with location records copied from source. Verify all archive display and links against the original master before release.

## Reproduction commands
Run from the **exact candidate SHA**, with `npm ci`. Execute the full unit/typecheck/lint suite and existing client bundle budgets in **both** V3 configurations, then Chromium acceptance using `WORLD_BASE_URL=http://127.0.0.1:3000/world`. The `iLand Master-Based Release Qualification` PR workflow automates this on Ubuntu 24.04. Website CI must also pass without dropping the existing site.
```bash
npm ci
npm run typecheck && npm run lint && npm test
NEXT_PUBLIC_SKI_V3=0 npm run build
NEXT_PUBLIC_SKI_V3=1 npm run build
```
Re-run the browser suite against each matching compiled build. Environment variables compiled into client assets cannot be toggled after building.

## P0 acceptance: all must be evidence-backed
- [ ] Exact-head Website CI, TypeScript, ESLint, all tests, bundle checks and this qualification matrix pass (V3=0 and V3=1).
- [ ] Fractal homepage and production portfolio/frontier/game links remain functional. No unrelated file deletion and no regressions in master content.
- [ ] Desktop normal menu run → third-person skiing → actual halfpipe alternating bank visits, jump, physically measured ski/boot sole contact, rider-controlled keyboard 180/360, landing, slow runout and correct return to exploration. Crossings must be observed, not scripted.
- [ ] V3 off retains the legacy skiing behavior. Neither unarmed normal mode nor ordinary terrain enables scored Big Air; Ski Jump remains explicit menu authorization.
- [ ] Redwood bowl/loop/tunnel true entrance, inverted poses, contact and exit; skater, skis and bicycle wheels never float or clip. Render screenshots from exactly the tested physics frame.
- [ ] Mountain bike, Jet-Ski, skim, swim/snorkel, disc golf, Shasta and recovery from falls confirmed with real input, normal navigation and camera.
- [ ] Forest, streams, waterfall, museum, gallery, arcade cavern, reef, North Shore and protected terrain retain accessibility and geometry/hydrology invariants.
- [ ] Cairn stories, genuine images, research links and gallery returns work on keyboard, touch, screen readers and narrow phones; no hard-coded keyboard-only interaction.
- [ ] Native desktop GPU and representative iOS/Android devices capture 1% low FPS, frame-time p50/p95/p99, dropped frames, asset loading and memory trend. Chromium SwiftShader reports are software evidence **only**.
- [ ] Screenshots/video collected and reviewed for contact, large foreground occluders, white terrain walls, z-fighting, UI overlap, ecology scale and visual hierarchy.
- [ ] A final evidence matrix records exact candidate SHA, failing test names/line numbers, bundle size and comparison against current master; all release blockers closed before changing homepage or deploying.

## Known blockers at candidate creation
1. Source PR #174 reported two inherited failures in Website CI (ski ridge-log grind timeout) and combined Jet-Ski suite (Disc Golf hidden shortcut after driving). These are distinct failures and require exact-head reproduction; do not call Jet-Ski vehicle broken without its own evidence.
2. PR #174 reported a bike-camera screenshot with a pale foreground obstruction and a North Shore screenshot occluded by the fallen sequoia. Later code attempts fixes; exact-head hardware screenshots are still needed.
3. PR #170 documented rigid sole bridging with clearance near 0.65 world units and incomplete real-player halfpipe/trick validation; #176's bounded *visual* ski skin does not solve physical contact.
4. The original source was wired as the website homepage, so browser test URLs must be adjusted to `/world` for this master-preserving candidate. The general browser suite that expects the old `/atlas` location requires a deliberate rewrite, not a false PASS.
5. This tree has not yet passed its own CI or device QA. No release readiness claim is justified before same-SHA results are captured.
6. Master branch is currently unprotected. Require reviewed status checks and controlled release permissions before promoting a candidate.

## Release rule
Keep this PR and upstream PRs **draft**. Do not merge, switch production homepage, or deploy. Request an explicit release approval only after the exact-SHA PASS/FAIL matrix, screenshots/videos and device benchmarks are reviewable.
