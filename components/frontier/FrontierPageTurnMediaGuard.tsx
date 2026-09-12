'use client';

/**
 * FRONTIER's steady-state image engine paints optimized textures into one fixed
 * viewport WebGL canvas. That is ideal while cards are stationary, but a fixed
 * canvas cannot inherit a newspaper sheet's CSS 3D transform, clipping, opacity,
 * or perspective during a page turn.
 *
 * Every GPU image already keeps a browser-native copy mounted underneath as its
 * resilience path. During the bounded `prepare` and `turn` phases we temporarily
 * hide only the known fixed media plane so those native pixels become presentation
 * authority and rotate with the sheet. Decode/texture work stays alive behind the
 * scenes, so the GPU plane can resume immediately after the deck returns to idle.
 */
export function FrontierPageTurnMediaGuard() {
  return (
    <style data-frontier-page-turn-media-guard="native-sheet">
      {`
        body:has([data-frontier-section-deck="true"][data-frontier-turning="prepare"]) > canvas[aria-hidden="true"][style*="z-index: 42"],
        body:has([data-frontier-section-deck="true"][data-frontier-turning="turn"]) > canvas[aria-hidden="true"][style*="z-index: 42"] {
          opacity: 0 !important;
          visibility: hidden !important;
          transition: none !important;
        }
      `}
    </style>
  );
}
