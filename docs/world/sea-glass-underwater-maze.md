# Sea Glass Archive: Underwater photography maze

## Scope and material language
The west-coast kelp trident remains at (-58, 7). Just offshore to its north-west,
a *circular metal pressure hatch* sits at the eastern edge of the Sea Glass
photography bunker. The visitor swims deeper toward it, and it opens when they
reach the matching depth and horizontal radius. The gallery's blue-transparent
panels use non-refractive tinted glass with slim dark steel ribs and a cyan
pressure seal; images remain neutral, cleanly framed and illuminated.

This reuses the research museum's fundamental one-exhibit-per-wall structure and
its click-to-open interaction, while the exterior, route and materials are
purpose-built for kelp forest snorkeling.

## Physical layout
- A deterministic 6 × 6 linked grid, each bay 5.4 world units wide.
- A traversable spanning network with four shortcuts, not randomly blocked
  rooms or a collection of isolated boxes.
- All 49 Visual Archive photos, one image per accessible display face.
- Outer aquarium glass, inner blue bulkheads, warm-dark metal photo backing,
  and instanced floor/roof lighting details.
- Depth follows the local seabed. The diver's normal depth controller is
  maintained in open ocean and automatically tracks photo eye height *only*
  within the maze.
- Continuous swept wall collision, including the entrance cheeks.
- Over-shoulder exhibit camera; tapping an image opens the site's normal photo
  detail interface without replacing it with an iframe.
- At most 12 high-resolution textures resident near the visitor, with distance
  culling and disposal to preserve mobile GPU memory.

## Ocean theming and visual hierarchy
The walls are tinted cyan-blue and transparent (about 34% opacity). Instead of
expensive screen-space refraction, dark steel ribs and luminous seal hardware
provide contrast, while the existing kelp schools and underwater atmosphere
remain visible outside. Photo colors are **not** globally tinted blue.
Use a cool, gentle marine palette and avoid many new dynamic lights.
No wildlife density changes or sport/companion regressions are intended.

## Acceptance criteria
1. The 49-image registry matches the Visual Archive, with no silent subset.
2. There are no unreachable maze cells, and passage footprints match visuals.
3. Circular hatch is deeper than the surface swim mode, close to the kelp
   trident and operable from both sides.
4. All exhibit walls remain underwater and within world bounds.
5. Photographs display in original aspect ratio, and empty/missing images
   remain visible as neutral placeholders rather than black planes.
6. No escape traps: visitors return through the same airlock; depth and
   terrain clearance remain consistent across room transitions.
7. Validation includes deterministic maze tests, world typecheck, lint,
   island browser smoke and mobile GPU screenshot review.

## Follow-up visual polish
The first code pass intentionally avoids expensive full refraction,
per-photo dynamic lighting and large transparent meshes that would degrade
software-rendered mobile WebGL. Validate actual image rendering, collision
reachability, haze depth and first-person camera framing in a physical-browser
playtest before merging the branch chain.
