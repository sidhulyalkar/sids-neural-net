# FRONTIER media engine

FRONTIER keeps the semantic interface in React/DOM and moves only heavyweight media work into browser-native accelerated paths. The goal is not to rebuild the browser. It is to keep text, links, accessibility, ranking, and interaction ordinary while making dense image/video feeds cheap enough to remain fluid.

## Principles

1. **Real media only.** The engine renders publisher/community/first-party media already attached to a FRONTIER signal. It never manufactures decorative article images.
2. **One image plane, few decoders.** Images can be painted through one viewport-sized WebGL2 canvas. Videos remain native `HTMLVideoElement` instances and are only mounted near the viewport.
3. **Native before custom.** Progressive video and native HLS are preferred. FRONTIER's tiny MSE controller is used only for normalized fMP4/CMAF manifests; it is not a general HLS/DASH parser.
4. **No permanent render loop.** The image plane redraws only after scroll/resize/texture/layout invalidation.
5. **Bounded memory.** Decoded images are resized to their display surface and GPU textures live inside an LRU budget derived from device class.
6. **Aggressive lifecycle cleanup.** Offscreen jobs abort, textures are deleted, `ImageBitmap.close()` is explicit, MSE buffers are trimmed, object URLs are revoked, workers terminate when the plane is idle, and videos drop their `src` when unmounted.
7. **Fallback is part of the design.** CORS failures, WebGL context loss, low-power/data-saving policy, unsupported codecs, and older browsers fall back to browser-native image/video behavior.

## Image pipeline

`SignalCard` delegates media to `FrontierMediaSurface`.

For image signals:

1. `GpuImageSurface` registers its semantic DOM rectangle with the singleton `FrontierImagePlane`.
2. A strict `IntersectionObserver` uses a 700 px warm zone. Far-away images have no decode work.
3. A four-slot `FrontierMediaScheduler` prioritizes currently visible work over warm/background work.
4. `frontier-image.worker.ts` fetches and calls `createImageBitmap()` off the main thread whenever the browser/bundler supports the worker path.
5. Decode dimensions are the actual rendered dimensions times a bounded DPR, not the source image's original megapixel dimensions.
6. The bitmap transfers to the main thread and uploads to a WebGL2 texture.
7. `FrontierTextureCache` estimates resident RGBA bytes and LRU-evicts textures once the device budget is exceeded.
8. The one fixed WebGL canvas paints only visible registered rectangles using `translate`-free normalized coordinates and object-cover UV cropping.
9. If GPU decode/fetch is unavailable, the surface keeps the ordinary lazy/async `<img>` fallback.

The canvas has `pointer-events:none` and is `aria-hidden`; DOM surfaces preserve accessibility labels and layout semantics.

### GPU budgets

Current defaults:

- mobile / <=2 GB hint: ~64 MB
- <=4 GB hint: ~112 MB
- larger desktop: ~160 MB

The values are deliberately conservative because decoded image memory is approximately `width × height × 4` before additional driver overhead.

## Trusted same-origin media proxy

Arbitrary publisher images cannot universally become WebGL textures because canvas/WebGL obey CORS. FRONTIER therefore provides an **optional, bounded, trusted image proxy** at `/api/frontier/media`.

The proxy is intentionally not an arbitrary URL proxy:

- only HTTP(S)
- host must be in the built-in trusted CDN set or `FRONTIER_MEDIA_PROXY_HOSTS`
- DNS resolution must contain no private/link-local/loopback/multicast address
- credentials in URLs are rejected
- redirects are bounded and revalidated
- fetch time is bounded
- response must be `image/*`
- payload is capped at 16 MB while streaming
- upstream cookies are never forwarded
- response receives `nosniff` and same-origin resource policy

The feed route decorates media from trusted hosts with `proxyUrl` / `posterProxyUrl`; arbitrary web imagery continues through the resilient native fallback.

## Video pipeline

Videos remain native `HTMLVideoElement` playback surfaces because the browser already has the best hardware decode/compositor integration.

`AdaptiveVideoSurface` has three viewport states:

- **off**: no video element/source; poster only
- **warm**: player may mount and load metadata/init data
- **active**: muted autoplay is attempted when network/data policy permits

Hidden tabs and offscreen surfaces pause playback. `Save-Data` and very slow connection hints disable automatic playback.

### Source order

`FrontierVideoStream` supports:

- `progressive`: ordinary MP4/WebM
- `hls`: native HLS when the browser advertises support
- `frontier-fmp4`: normalized, timeline-aligned CMAF/fMP4 renditions for the small MSE controller

YouTube remains a privacy-enhanced YouTube embed rather than attempting to extract or re-stream platform media.

### MSE + adaptive bitrate

`FrontierMseController` accepts only FRONTIER's normalized manifest. It serializes `SourceBuffer` operations, appends init/segments, trims the back buffer, and keeps a bounded forward buffer.

`FrontierThroughputEstimator` uses an EWMA rather than trusting one burst. Variant selection includes:

- bandwidth safety margin
- viewport-width cap
- aggressive downgrade on a shallow buffer
- hysteresis before an upgrade
- segment-boundary switching only

This keeps the custom streaming layer intentionally small rather than becoming another HLS.js.

## Liquid expansion

`useMediaFlip` performs First / Last / Invert / Play with the Web Animations API. The same wrapper and same playing video node remain mounted while its layout state becomes fixed/fullscreen. Only `transform` and border-radius interpolation are animated; playback is not restarted and grid dimensions are not animated.

`Escape` collapses the active media view. `prefers-reduced-motion` skips decorative interpolation and changes state immediately.

## Playback telemetry

The media engine records aggregate in-memory performance counters without adding user-tracking surface:

- image decode count/time
- texture upload count/time
- resident texture bytes/count
- cancelled media requests
- video start latency
- rebuffer events
- presented/dropped frame deltas

`getVideoPlaybackQuality()` is sampled only while a video is active. The telemetry object is currently diagnostic/local and is not uploaded to the recommendation profile.

## Rendering containment

`SignalBoard` uses `content-visibility:auto` and `contain-intrinsic-size` on card wrappers so the browser can skip offscreen subtree rendering while preserving the ordinary semantic card DOM. The expensive pixels are separately lifecycle-managed by the media engine.

## Lifecycle checklist

Every media subsystem must satisfy these rules:

- worker jobs can be abandoned without committing stale texture results
- bitmap ownership ends with explicit `close()` after upload or cancellation
- textures end with `gl.deleteTexture()`
- context loss immediately falls back rather than leaving blank media
- `requestAnimationFrame` is event-driven, never permanently spinning while idle
- `IntersectionObserver`, `ResizeObserver`, scroll/resize/visibility listeners disconnect on teardown
- MSE `AbortController` aborts outstanding segment fetches
- video source/object URLs are detached/revoked on teardown
- no generated overlay receives pointer events or enters the accessibility tree

## Deployment configuration

No secret is required for the core engine. To add extra trusted image CDN hosts to the same-origin GPU proxy:

```text
FRONTIER_MEDIA_PROXY_HOSTS=images.example.com,cdn.example.org
```

Only add hosts that are trusted to serve image assets for FRONTIER signals.

## Future extensions

The architecture intentionally leaves room for:

- server-side derived BlurHash / average-color metadata from the real source image
- first-party CMAF packaging for personal high-resolution video archives
- worker-side thumbnail/frame extraction using WebCodecs when it materially helps search or visual understanding
- device-session adaptation that lowers the video quality ceiling when measured dropped-frame rate is persistently high
- explicit media performance diagnostics in development/Radar mode

WebCodecs is not used as the default player because it does not provide container demuxing and would make ordinary playback substantially more complex than the native video stack.
