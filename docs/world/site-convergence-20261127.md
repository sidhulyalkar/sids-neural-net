# Integrated release candidate audit — November 27

## Source reconciliation

Base: PR #204 at 5bd9c41cea6a58c572dcd256b9c65950a765694f.
FRONTIER donor: PR #203 at 343df8426ada89984ad2ef2c3fbd012678374db7.

Merge the latest midnight gallery, ivory reader, lightning interactions and engagement calibration into the classic-world candidate. Retain /world and /frontier/read immersive navigation exclusions. The newer reader removes the obsolete rating slider, including its former null-draft failure path. Preserve classic skiing, WASD aerial tricks, minimal directional disc slingshot, gallery and South Shore integrations.

Fix focused slingshot Escape: cancel the active pointer drag before consuming keyboard power shortcuts. Previously Escape reset keyboard power and stopped propagation while leaving the pointer drag armed, so mouse release could throw.

## Verified predecessor CI

GitHub workflows for the base: nine success, two failure. Success includes website CI, world integration build/unit gate, gallery, South Shore, mobile snorkeling, arcade, fractal home, FRONTIER refresh and sensor QC. Within the complete browser workflow, skim, grove, cairn, header and aerial jobs passed.

Failures remain explicit:
- Disc golf browser: scripts/playtest-disc-golf.mjs cancellation assertion, flying after Escape. Addressed in this candidate; fresh browser qualification required.
- Full world: scripts/playtest-world.mjs:608 timed out waiting for authored Ski Jump flight. Final telemetry: player (-2,-54.67), phase armed, grounded, speed 10.80. Root cause not yet proven. Do not remove or relax this gate.

## Local checks

Initial integrated full suite: 1,230 tests, 1,226 pass, one failure, three skipped retired ski tests. The single failure was the source-shape check for the explicit /world navigation exclusion; preserving that expression resolved all five tests in the affected file. Final CI must run the complete integrated suite.

## Remaining production gates

- Exact new commit: all workflows, including FRONTIER browser audit and the complete world journey.
- Inspect fresh desktop/mobile screenshots: lightning interaction, reader typography, gallery exposure, forest camera framing and disc slingshot layout.
- Resolve Ski Jump approach failure; verify actual flight and safe return without automatic authorization.
- Verify disc cancellation and all nine throw → flight → retrieval → handoff loops.
- Resolve the existing Next.js security advisory and verify dependencies against primary advisories. npm audit could not return results in this environment; no security clearance is claimed.
- Real-device frame timing and mobile input qualification remain outstanding.

Keep PR #204 draft. No production promotion. Older experimental ski branches and superseded FRONTIER designs are not integration targets.

Final combined local run: 1,230 tests; 1,227 pass, zero failures, three retired-ski skips. Production build passed with the existing security advisory still reported. These results do not substitute for fresh remote browser qualification.
