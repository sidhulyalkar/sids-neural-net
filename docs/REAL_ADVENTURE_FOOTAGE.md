# Real adventure footage in Sid's iLand

## Status

The website already has an underwater reef and a photo/video dialog. It now
also has a moving sea turtle and species-aware video encounters for turtle,
manta ray, shark, and stingray. **There are still no published snorkeling
videos.** Until a real clip is curated, the associated encounter is not shown.

Do not upload private Google Photos links into the public video manifest.
Download/export the actual footage you want public, review it, and upload only
the chosen edited clips to your intended public media origin.

## Prepare a snorkeling clip

Prerequisites: Python 3 and FFmpeg with `ffmpeg` and `ffprobe` in PATH.
Trim to a focused encounter first (roughly 10–45 seconds works well). Keep
the animal visible in the selected poster frame. The existing preparation
script transcodes the clip and extracts a poster.

Example, using a public media folder:

```bash
python scripts/prepare-visual-motion.py \
  --input "/path/to/trimmed-turtle-video.mp4" \
  --slug lagoon-turtle \
  --title "Sea turtle" \
  --activity snorkeling --animal turtle --reef lagoon \
  --location "Bora Bora" \
  --output public/visual-motion/lagoon-turtle
```

The output is a `manifest-fragment.json`, one JPEG poster and H.264 MP4
variants no larger than the input resolution. Adjust `--poster-time` in
seconds if the turtle isn't prominent in the generated poster.

For large clips, prefer uploading the derivatives to a public video CDN/storage
origin instead of committing large MP4 files to Git. Specify
`--public-url-base https://<your-actual-media-host>/visual-motion/lagoon-turtle`
when preparing media outside `public/`; that URL must really serve your files.
Do not guess, publish or hardcode a media URL that does not exist.

**The script does not upload footage or publish it.** Review what you share:
visible people, audio, identifiable location, and personally identifying EXIF
details. The processing script strips container metadata.

## Publish one clip in Visual Cortex

After confirming the files are really accessible at their final URLs,
copy the matching fields from `manifest-fragment.json` into
`src/data/visualMotion.ts` as a `VisualMotionEntry`. The script's
`sourceProbe` is diagnostic only and should be excluded from the TypeScript
record. Supply a simple, accurate `alt`, for example
`"Sea turtle swimming over shallow coral"`.

```ts
{
  id: "lagoon-turtle",
  title: "Sea turtle",
  alt: "Sea turtle swimming over coral",
  posterSrc: "/visual-motion/lagoon-turtle/lagoon-turtle-poster.jpg",
  durationSeconds: 22.4,
  aspectRatio: "1920 / 1080",
  location: "Bora Bora",
  encounter: { activity: "snorkeling", animal: "turtle", reef: "lagoon" },
  sources: [{
    src: "/visual-motion/lagoon-turtle/lagoon-turtle-1080p.mp4",
    type: "video/mp4",
    label: "1080p",
    height: 1080,
  }],
}
```

The record above is **illustrative only**. Those paths and video details
are not real assets until your preparation/export is complete.

Publishing the record does two things automatically:

1. Makes the clip available in the existing Visual Cortex motion gallery.
2. Creates an actual Sid's iLand encounter while snorkeling near a matching
   creature in the appropriate reef.

The encounter references the animal's *animated position*, rather than a
fixed world marker. Come within roughly six world units, press Enter (or tap
the discovery control), and watch the clip. Opening the modal pauses the World;
closing it returns to the same snorkeling position/depth. No background
autoplay or placeholder video is used.

## Species bindings

| Footage | Encounter | World |
| --- | --- | --- |
| Sea turtle | `animal: "turtle", reef: "lagoon"` | Tropical reef sea turtle |
| Manta ray | `animal: "manta", reef: "lagoon"` | Swimming manta |
| Blacktip shark | `animal: "shark", reef: "lagoon"` | Tropical reef shark |
| Leopard shark | `animal: "shark", reef: "kelp"` | California kelp shark |
| Stingray | `animal: "ray", reef: "lagoon"` | Tropical stingray |

Species labels should match what is actually recorded. For example, don't
label an eagle ray as a manta just to make it open the manta clip. There is
currently no turtle in the kelp reef and no named animal encounter for generic
fish; those can be added after the first clip batch is qualified.

## Ski and dirt-bike clips

Use the exact same video-preparation command with one of the following
activity metadata values:

```bash
--activity ski
--activity dirt-bike
```

These clips will enter the Visual Cortex motion gallery when manually
published. **They do not yet trigger ski jumps or bike encounters in
Sid's iLand.** A later pass can attach each clip to a particular ski jump,
trail, or race checkpoint, just as the marine encounters bind to moving
creatures. Do not infer a dirt-bike clip belongs to the existing bicycle race.

## Before calling an encounter published

- Confirm the selected clip actually depicts the target species and the
  authored `reef` is appropriate.
- Verify poster and video return HTTP 200 and play on phone + desktop.
- Run `node --import tsx --test tests/world-marine-video-encounters.test.ts`.
- Run TypeScript, lint and the World regression and visual/browser QA.
- Confirm close/Escape restores the previous depth, position and input focus.
- Only then merge/deploy the approved media + code.
