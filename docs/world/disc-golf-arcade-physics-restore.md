# Disc golf: restoring the playable arcade throw

Status: draft PR #94, Oct 12 2026.

## Regression and provenance

The Oct 10 playable implementation (commit `0e6536dc3adc`) simulated
simple translational arcade glide: modest horizontal drag, small wind drift,
slight lift compensating gravity and a signed bank-induced turn. A later
Oct 11 chain (notably `4311584d1ada`) routed all live and preview throws
through spinning six-degree-of-freedom rigid-body aerodynamics, then added
surface skids and rolling. The result may be more academically elaborate,
but an ordinary player throw can pitch/roll into a rapid landing, and
prolonged rolling delays the next playable stroke.

## Game rule restored

- Default, live shots use the Oct 10 arcade flight equations, not the
  quaternion rigid-body integration.
- Launch power and loft still produce the original direct velocity; curve
  remains signed and develops after release.
- Wind remains locked at release and has subtle influence. The disc still
  visibly spins for presentation but not through an unstable flight solver.
- Every ordinary ground impact resolves directly to a safe playable lie;
  tree contacts and water redos keep their existing special rules.
- Real throws, power recommendations and trajectory previews call the
  same shared simulation.
- The 9-hole course, mandatory gates, Hole 9 length, power-rail interaction,
  basket scoring, Shasta fetch, and exclusive minigame controls stay intact.
- Keep the advanced scientific rigid-body and ground-contact modules and
  their independent tests as **experimental**, not default gameplay.
- Saved round records now use `disc-golf-v1.11-arcade-flight` so scores
  made under the previous flight rules are not compared as if identical.

## Acceptance

The unit suite checks an ordinary drive remains airborne at 0.5 seconds,
travels meaningful distance, settles without contact-roll lockout, and can
be thrown again. It also verifies real flights match predictions.
The Chromium smoke test `scripts/playtest-disc-golf-arcade.mjs` uses the
real HUD power rail and Enter release to verify a shot actually launches,
flies for a visible interval and lands after one counted stroke.

Manual QA still needed for tap, held-Space release, pointer drag on the
power rail, different curve settings, all nine holes, and mobile.
