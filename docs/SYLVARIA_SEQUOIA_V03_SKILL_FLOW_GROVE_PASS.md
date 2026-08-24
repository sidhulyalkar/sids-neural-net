# Sylvaria: Sequoia v0.3 — Skill-Flow + Grove Pass

## Why this pass exists

The prior Icy-flow tuning solved the wrong extreme too aggressively. A recorded 78-second run climbed from single-digit Flow to roughly 371× Flow while repeatedly ricocheting between the sequoia walls. The player was no longer composing movement. Passive bark collisions awarded Flow, refreshed Air Kick, preserved Stride, and fed a speed state that increasingly sustained itself.

The design target is now explicit: **easy to enter, difficult to automate, expressive to master**.

## Passive bark versus deliberate bark

Passive bark contact is a redirect only. It must:

- lose substantial horizontal energy;
- provide only a small vertical correction;
- never award Flow;
- never refresh Air Kick;
- trim stored Stride rather than increasing it.

The valuable wall interaction is deliberate:

1. collide with bark;
2. continue holding toward the trunk to catch a short Bark Cling;
3. press Jump during the grip window;
4. launch a Bark Kick away from the trunk;
5. earn one BARK Flow link and restore Air Kick.

A wall is therefore a skill surface, not an automatic pinball bumper.

## Anti-runaway momentum envelope

Stride remains a short memory of earned speed, but turnaround inheritance is reduced to 62% and decays quickly. Combo Carry is intentionally tiny and capped. Flow-driven acceleration is capped separately from the base movement envelope.

Ground running can create a useful two-floor or carefully prepared three-floor clear. It cannot automatically solve four consecutive FLOW floors without another mechanic or a better route.

## Grove Chambers

The playable corridor expands to 724 px between physical bark edges. The new GROVE grammar periodically opens the tower into broad center branches followed by asymmetric left/right aerial choices and a central recombination.

The tower now alternates between:

- readable FLOW sequences;
- forgiving RECOVERY shelves;
- open GROVE chambers;
- Sap-centric SLINGSHOT sequences;
- tighter CRUX compositions.

This creates spatial rhythm instead of one constant-width vertical ladder.

## Progression

- ROOTWAYS: floor 0+
- REDWOOD RUN: floor 30+
- SAPWORK: floor 70+
- HIGH CANOPY: floor 115+
- CROWNLINE: floor 165+

The progression begins asking for intentional route composition sooner than the runway-heavy Icy-flow pass, without restoring the original precision-exam opening.

## Character and forest art

The final renderer now overlays a complete presentation pass:

- Pip has an articulated forest-climber silhouette, hood, scarf, tunic, boots, heartwood clasp and readable Sap hook;
- the scarf is the main velocity silhouette;
- Bark Cling shows a compact GRIP cue;
- sequoias use irregular bark plates, moss pads, fungi, ancient knots and phase-aware color;
- the exact physical collision edge remains a straight visible line so decorative bark never lies;
- background layers include forest silhouettes, canopy light shafts and altitude-dependent atmospheric color;
- branch rendering gains curved contours, moss traces and clearer authored-route differentiation.

## Qualification contract

`npm run check:sylvaria-flow` now rejects both known failure modes. It asserts that the teaching band remains reachable while also proving that passive bark cannot create Flow, passive bark cannot refresh Air Kick, full Stride cannot solve four FLOW floors automatically, combo carry and acceleration are bounded, Grove Chambers exist as real geometry, and the wider physical corridor is present.

The normal Sylvaria validator syntax-checks every runtime module, including the final skill-flow renderer. The browser matrix remains responsible for physical jump/Air Kick input behavior and cross-engine rendering.
