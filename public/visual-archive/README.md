# Visual Cortex Image Prep

Use local optimized assets only. Do not depend on Google Photos URLs.

1. Download/export selected photos from Google Photos.
2. Put the new source photos in `photo-input/`.
3. Run the incremental updater:

   ```bash
   python3 scripts/update-visual-archive.py --input photo-input
   ```

   Or, when Node/npm works locally:

   ```bash
   npm run photos:update
   ```

4. The script will:
   - skip photos it has already processed
   - assign new files the next `photo-###` id
   - write optimized WebP files into `web/` and `thumbs/`
   - update `public/visual-archive/manifest.json`
   - print TypeScript entries to add to `src/data/visualArchive.ts`
5. Replace the generated alt text with a useful description.
6. Run:

   ```bash
   python3 scripts/check-visual-archive.py
   ```

7. Commit only optimized assets and metadata from:
   - `public/visual-archive/web`
   - `public/visual-archive/thumbs`
   - `public/visual-archive/manifest.json`
   - `src/data/visualArchive.ts`

Do not commit huge originals, Live Photo videos, or GPS-bearing source files.
