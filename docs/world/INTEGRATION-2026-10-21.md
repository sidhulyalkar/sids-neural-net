# World integration — 2026-10-21

Target: `feat/sequoia-tunnel-skate-loop`, starting at `90361955`.

Integrated branch heads:

- `fix/island-ride-slope-wipeout-recovery` (`50613192`): rendered terrain contacts, independent steering, recoverable wipeouts, monotone frame clock.
- `feat/marine-wildlife-video-encounters` (`12618be0`): turtle fauna and species-matched real-video discovery/catalog. Actual clips still require qualified published media; no fabricated placeholders.
- `feat/world-browser-regression-hardening` (`eaf98314`): multi-frame Shasta fetch and browser initialization diagnostics.

Already included by ancestry: compact sports hub, photo places and minimal captions, iLand landing, Mystic Grove receiver/circuit/forest detail, Joshua reforestation, cave gallery and underwater trident sculpture. Older disc-camera and skim branches have separate histories; their target-facing avatar and shorebreak behavior is already present in this baseline and is retained rather than replacing current files wholesale.

Additional focused fixes:

- Cut-rim and outer lower-edge attachment requires at least 0.85 world units above local ground. Low wood remains a collision obstacle; inner floor riding stays available.
- Interior log jumps follow a bounded assisted path to the floor center, with a continuous upright rotation. Each sample remains inside the tapered bore. Bark jumps retain ballistic exterior behavior.
- Both loop directions support ordinary trick input with a brief normal-offset hop and a centered landing. Near mouths, hop duration shortens to fit the remaining track.

Validation: full world tests, targeted lint, TypeScript, production build, and real-keyboard browser coverage for both loop directions and a log wall-to-center jump.
