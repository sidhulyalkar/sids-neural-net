# Arcade cavern photo albums

The cavern uses actual local photos as a **temporary visual gallery**. No
decorative titles, captions, slogans, handwritten text or typography are added
by the mural compositors. Existing game-cover artwork and sports-team crests
may still contain lettering *inside their original image files*; the game HUD,
interaction buttons and accessibility labels remain functional.

## Replacing the current pictures

1. Save new, optimized `.webp`, `.jpg`, `.png` or `.avif` pictures beneath
   `public/arcade-albums/<album-name>/`. Keep filenames lowercase and use
   hyphens instead of spaces.
2. Open `lib/world/arcadeCavernGalleryContent.ts`.
3. Replace the **local URL arrays** in `CAVERN_PHOTO_ALBUMS`, for example:

   ```ts
   shasta: {
     images: [
       "/arcade-albums/shasta/shasta-01.webp",
       "/arcade-albums/shasta/shasta-02.webp",
     ],
     heroIndex: 0,
   },
   nature: {
     images: ["/arcade-albums/trails/lake.webp"],
   },
   feature: {
     images: [
       "/arcade-albums/panoramas/forest.webp",
       "/arcade-albums/panoramas/waterfall.webp",
       "/arcade-albums/panoramas/snow.webp",
     ],
   },
   ```

4. Run the World regression suite and the Arcade Cavern browser QA; inspect
   side-wall and rear-wall screenshots at normal camera distance.

The renderer builds one atlas per album, automatically positions Shasta's hero
picture and the remaining images, and adjusts the landscape grid to the
number of pictures. Up to 25 images per wall are supported; the rear panorama
looks best with three wide photographs. A future replacement only needs
updates to the album configuration and image files, not the mesh geometry.

Current layout: Shasta collage on the entrance-left rock, nature photography
on the upper right and a rear-side patch, three real game images on the right
and within their respective selection niches, sports team marks on the right,
and a short photographic triptych above the rear center game. Paint and rocks
sit behind the artwork; the original game raycast and collision geometry is
unchanged.

## Quality criteria

- Never stretch original image aspect ratios. Photos are cropped thoughtfully
  within a frame or letterboxed for game covers.
- No added words in the Shasta, nature, panorama, or game-image compositors.
  The sports compositor may label exactly the three teams underneath their crests.
- Gallery image requests are local and checked in to `public/`.
- Keep the centerline walkable, the game covers distinguishable, and gameplay
  prompts accessible. Do not add decorative UI that blocks the cave.
