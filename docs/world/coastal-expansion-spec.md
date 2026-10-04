# Coastal expansion — implementation contract

Sid requested a concise entry, a choice between the original site and spatial exploration,
his warm-coated Shasta, outdoor sport movement, blue California skies, grounded flora,
and an expanded landscape including a game area, canyon, cavern, and waterfall.

## Entry and identity

- “Brains, machines, open trails.” One short identity line.
- “View site” links directly to the preserved original fractal menu at `/atlas`.
- “Explore world” starts exploration; “Get to know me” links to `/about`.
- Both routes remain native, server-rendered links. Reduced-motion, mobile, Save-Data,
  no-JavaScript, and WebGL-error paths retain conventional navigation.

## Shasta

References inspected: archive `photo-040` (daylight topcoat), `photo-042` and
`photo-043` (face, chest, shape). Sid's direct correction is authoritative: white,
golden-brown upper fur, darker tan-gold along the top, reddish-brown at the tail base.
`SHASTA_COAT` in `lib/world/ecology.ts` centralizes the editable material palette.

| Part | Material sRGB |
| --- | --- |
| White face, chest, legs, tail | `#f4eee1` |
| Tan-gold upper saddle | `#c4a675` |
| Soft golden neck and ears | `#dbc39a` |
| Reddish-brown tail root | `#ab7352` |

These are art-directed matches informed by the photographs and owner description.
They are not exact physical reflectance measurements: the photos contain shade,
sunset illumination, camera processing, and no calibrated reference target.

## Movement

| Mode | Behavior | Action |
| --- | --- | --- |
| Trail run | Responsive 6.6 units/s; Shift boosts pace | Jump |
| Skate | Accelerates to 11 units/s, coasts to rest; visible board/wheels | Ollie |
| Mountain bike | Accelerates to 13 units/s; visible bike, wheel motion, riding pose | Bunny-hop |
| Ski | Travels to snow; slope-dependent speed up to 21 units/s; skis/poles, gliding pose; on foot below snowline | Hop |
| Boulder | Travels to three authored rock ledges; 4.8 units/s approach | Climb to the next reachable higher hold; jump elsewhere |

All modes share swept collision and bounded time steps. Click travel clamps to the
remaining target distance. Blur/pause clears input and speed; menu travel clears
momentum, jump and climb state. Keyboard controls operate only when the canvas has
focus, leaving page buttons usable. Every action is also available as a touch button.
This is a lightweight arcade representation of Sid's interests, not a sport simulator.

## Landscape

Playable bounds expand from 76×76 to 90×92 world units. Seven menu destinations:
redwood grove, granite overlook, strange grove, wild coast, Fern falls, Moss canyon,
and Arcade cavern. The original six project records and three photos remain.

- Sky: clear blue, pale distant haze, neutral daylight; widened entry composition.
- Coast: turquoise ocean, sandy bluff colors, low coastal scrub and poppy clusters.
- Fern falls: cliff, animated water streaks, shallow pool and expanding ripple.
- Moss canyon: two rock walls, moss patches, fern-like forms, walkable central trail.
- Arcade cavern: rock arch and unicorn-emblem cabinet. Featured Stretchicorn card;
  all playable games come from `src/data/arcadeGames.ts`, using existing game pages.
  No iframe or extra game loop runs in the 3D scene.

This is an imagined California coast-to-mountain composite. The snowy ridge is a
mountain memory, not a claim that an alpine snowfield belongs in coastal scrub.
Neural trees remain visibly fantastical. Moss/fern forms are stylized, not species IDs.

## Ecological sources

Coastal species and habitat placements use public National Park Service references.
A quiet “Field notes” panel links visitors to those sources.

- Coast redwood (*Sequoia sempervirens*), sheltered inland grove; avoid salt-exposed bluffs:
  https://www.nps.gov/redw/learn/nature/plants.htm
- Coyote brush (*Baccharis pilularis*), exposed coastal scrub:
  https://www.nps.gov/pore/learn/nature/wildlandfire_fireecology_vegtypes_coastalscrub.htm
- California sagebrush (*Artemisia californica*), dry coastal slopes:
  https://www.nps.gov/samo/learn/nature/coastalsagescrub.htm
- California poppy (*Eschscholzia californica*), sunny meadow patches:
  https://www.nps.gov/muwo/learn/nature/plants.htm

## Acceptance

Automated: mode acceleration/braking, sprint, trunk collision, map bounds, click
overshoot, snow transitions, ordered climb reachability, all seven landmark landings,
game-catalog parity, existing projects/photos, frame metrics, build/typecheck/lint.

Browser audit: entry links, all seven panels, all five equipped modes, jump/climb
actions, game routes, plant source links, keyboard containment, touch navigation,
reduced motion, no-JavaScript, context loss, original eight-branch atlas, render budget.
It captures new area/activity screenshots for visual review.

Physical desktop/phone comfort and sustained frame-rate qualification remain separate
release gates. No hardware frame-rate claim is inferred from headless software rendering.
