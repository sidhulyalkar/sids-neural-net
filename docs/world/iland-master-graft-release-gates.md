# iLand master-based integration candidate

## Immutable sources
- Current production parent: `23bff8cfd42742ac60446dd75d392c7c771447d9`
- Selected iLand world donor: `dbd9a0a2c3aa71806ad620187bd059633dc4c6bf` (draft PR #176)
- **Do not merge or deploy.** All world modules are added without altering the production homepage.
- Master `app/page.tsx` remains unchanged. This candidate adds `/world` as a standalone route rather than exporting the source branch's world homepage.

## Scope
- **235 newly added source assets** copied by exact Git blob identity: components/world/, lib/world/, public/world/, tests/world-*, supporting world playtest scripts and the isolated ski lab.
- No historical branch ancestry, unrelated application pages, package dependencies, lockfile, global layout, production feature flags, or deployed configuration changes.
- Authoritative physics default is PR #176, not unqualified experimental PR #180.
- There is intentionally no wholesale merge of the source branch's 1,700+ commits.

## Blocking release gates
- [ ] Full dependency/typecheck closure and both feature configurations.
- [ ] World route loads and original production homepage remains unchanged.
- [ ] Rendered geometry, independent ski contact and 180/360 player-input clean landing.
- [ ] Five genuine halfpipe crossings (not qualified in the donor).
- [ ] Menu-authorized Ski Jump only; no automatic scored Big Air on halfpipe.
- [ ] Mobile dual-stick controls, accessible activities, underwater, museum, arcade, Shasta, skate, skimboard and Jet-Ski without regression.
- [ ] Actual GPU-backed desktop/mobile pacing and fallback stability.
- [ ] Manual visual review and owner approval before merge/deploy.

## Known donor failures
- World Mode expected fifty-fifty but observed boardslide.
- Redwood tunnel could not complete from normal controls in browser QA.
- Disc Golf arcade throw timed out.
- Clean halfpipe completed most of the run but software-WebGL timeout occurred close to downhill threshold.
- Distinguish these from CI runner and dependency-install failures.

Source asset details and the exact bundle/release SHA must be reported from **this candidate**, never inherited from donor QA.
