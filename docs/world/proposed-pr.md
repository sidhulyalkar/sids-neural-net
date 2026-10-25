# Add a compact, explorable World Mode portfolio

The homepage needs an inviting spatial experience while keeping professional work
immediately accessible. This change introduces a continuous four-landmark landscape
around the existing portfolio: sequoia grove, granite overlook, strange grove, and coast.

- Procedural environment, explorer, Shasta, collision-aware camera, and one discovery system.
- Keyboard, click/touch walking, orbit controls, menu travel, six real project records,
  three existing photos, and direct conventional navigation.
- Static/reduced-motion/mobile defaults, context-loss handling, bounded loading,
  paused rendering, adaptive DPR, and full runtime cleanup.
- Original fractal homepage preserved at `/atlas`; regression audits follow that route.
- Stage two: swept trunk collision, safe sliding and bounds, active-frame p50/p95
  diagnostics, sustained-slowness quality adaptation, and six new regression tests.
- Production CI includes a reproducible browser audit. No production dependency changes.

Validation: production build, TypeScript, ESLint, 631 tests, and existing bundle budget pass.
A full browser audit passed before the final renderer module split. The final rerun was
blocked by local Chromium IPC permissions; rerun in CI before merge. Hardware FPS and
physical-phone comfort remain unqualified. See `docs/world/validation.md`.

Keep this PR in draft until the final browser audit and desktop/phone performance check pass.
