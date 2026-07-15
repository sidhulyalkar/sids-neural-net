# Perceptual Cortex acceptance audit

Date: 2026-07-15

## Delivered

- Standalone `/perceptual-cortex` route and Visual Cortex portal.
- Complete pointer/touch/keyboard/synthetic ambient fallback without permissions.
- Explicit, independent camera and microphone activation with visible indicators.
- Worker-isolated MediaPipe Hand Landmarker and Face Landmarker inference at 15 Hz.
- Continuous palm position, speed, normalized pinch, hand separation, bilateral symmetry, head pose, facial activity, and expressive stillness features.
- Artistic mappings for palm force, propagation energy, pinch depth, bilateral bloom, restrained head parallax, and global facial excitation.
- Audio RMS, frequency bands, spectral centroid, flux, and onset controls without recording.
- Feature-only replay at approximately 12.5 Hz; no images, audio, landmarks, or typed content.
- Deterministic titles and non-psychological artwork interpretations.
- Six deterministic synthetic demonstration presets.
- Five conceptual color templates with distinct mappings for every input modality.
- High/balanced/low adaptive quality tiers with mobile detection and staged degradation.
- Reduced-motion behavior for camera and field motion.
- True 1920×1080 rerender on PNG export with deterministic title and seed.
- Deterministic synthetic fixtures suitable for screenshot-based visual regression.
- ESLint 9 flat configuration and non-interactive `npm run lint`.

## Privacy audit

- Camera and microphone are never requested on initial load.
- Camera frames are transferred only to an in-browser worker and closed after inference.
- No sensor data is uploaded by application code.
- Audio is analyzed through `AnalyserNode`; it is never recorded.
- Replay contains normalized aggregate world controls only.
- Keyboard processing retains timestamps and cadence statistics, never key values or codes.
- Camera tracks, microphone tracks, workers, intervals, videos, and audio contexts are stopped on disable or unmount.
- Facial controls are described as activity dynamics and never presented as emotional truth.

## Verification

- `npm run typecheck`: passing.
- `npm run test`: 39 passing.
- `npm run lint`: passing with eight pre-existing unused-variable warnings outside Perceptual Cortex.
- `npx next build`: passing; `/perceptual-cortex` statically generated.

## Manual browser checks still recommended

Automated unit/build checks cannot grant real browser permissions or compare GPU output across devices. Before public release, manually verify camera and microphone permission denial, live camera inference in Chromium/Firefox/Safari, WebGL context recovery, iOS touch behavior, physical-device frame rate, and exported PNG composition. Deterministic preset `bilateral-bloom` at a fixed seed is the canonical visual-regression fixture.
