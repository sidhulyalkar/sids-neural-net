# Arcade Cavern / The Home Stand: source and usage record

The game-local files below are truthful recreations of existing official
sports marks supplied as transparent PNGs. They are no longer generated
using `polygon()`, straight stripes, approximated shields, or fake team
silhouettes in the runtime canvas. **Logo ownership and trademark rights
remain with the respective clubs/franchises.** Presence in a public GitHub
repository is not evidence of full commercial merchandising rights. Review
final published use accordingly.

| Local file | Team | Original repository source |
| --- | --- | --- |
| `public/world/arcade-cavern/sports/chelsea-crest.png` | Chelsea FC | `frertommy/team-logos`, `MSI2026/Premier League/Chelsea/chelsea_big_square.png` |
| `public/world/arcade-cavern/sports/patriots-crest.png` | New England Patriots | `frertommy/team-logos`, `NFL/AFC/New England Patriots/new-england-patriots_big_square.png` |
| `public/world/arcade-cavern/sports/warriors-crest.png` | Golden State Warriors | `frertommy/team-logos`, `NBA/Western Conference/Golden State Warriors/golden-state-warriors_big_square.png` |

Repository: https://github.com/frertommy/team-logos
Origin sources reported there:
- Chelsea: https://a.espncdn.com/i/teamlogos/soccer/500/363.png
- Patriots: https://a.espncdn.com/i/teamlogos/nfl/500/ne.png
- Warriors: https://a.espncdn.com/i/teamlogos/nba/500/gs.png

The artwork shown in the cavern is a **single transparent painted composition**
created in `worldArcadeSportsMural.ts` using these three existing crest PNGs.
No external image host is contacted when a visitor opens the website. The
runtime compositor preserves each crest's aspect ratio and alpha. Any paint
scratching is applied to the **backplate only**, before the authentic crest
is drawn, so the team artwork remains legible. The resulting CanvasTexture
is rendered on the existing *rock-following mesh* rather than an invented
floating rectangular billboard.

A complete art review must still compare a real browser screenshot against
the approved concept reference at the normal character-to-wall distance,
including portrait readability and material integration.
