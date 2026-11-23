# Disc golf: player-controlled aiming and release qualification

## First increment: explicit full-circle aiming

Expose a touch/keyboard-accessible aim slider in the main HUD. A/D and left/right arrows rotate the stance through a full circle; Face gate/basket restores the route direction. Keep one authoritative heading for avatar, prediction and actual release. Lock aim and other keyboard tuning while charging or dragging power, throughout flight, and during Shasta retrieval. Keep the established throwing, course and fetch mechanics.

## Next increment: qualify the complete shot loop

1. Browser checks on the exact candidate: every hole and mandatory-gate state, aim at 0, ±90 and 180 degrees, verify actual avatar orientation against initial release velocity. Confirm controls are available without opening Tune.
2. Exercise keyboard, pointer and touch aiming; slider focus, repeated A/D input, opposite direction, recenter, cancellation, menu/blur and resizing. Verify no double throws or tuning changes during a held throw. Inspect desktop and phone screenshots for HUD overlap.
3. Check prediction against flight using identical power, direction, loft, curve, disc and wind. Include obstacles, water retries, gate misses, basket capture and approach shots. Never label the recommended power as a guarantee when facing away from the target.
4. Complete all nine holes through flight → landing → Shasta pickup → return → next lie. Assert scorecard updates exactly once, camera follows the disc, input locks and unlocks correctly, and exit/re-entry restores normal movement.
5. Measure actual-device frame timing during prediction, flight and fetch, then tune expensive work only where measurements justify it. Review camera framing and readable course cues.

## Release gate

Require exact-commit unit/type/build checks, browser journeys and screenshots, device input/performance evidence, and resolution of the existing Next.js security advisory before production promotion. Keep PR #204 draft until the integrated world is qualified. A unit-test pass is not visual or device signoff.

## Follow-on polish

If key-repeat stepping feels inconsistent in playtesting, move aim adjustment to a bounded elapsed-time controller with keyup, blur and visibility cleanup. Consider dragging an explicit aim handle, while preserving separate camera orbit controls and an accessible slider.
