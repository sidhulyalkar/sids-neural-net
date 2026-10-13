# Disc golf 3D camera occlusion: wooded second shot

Status: draft on PR #94. The reference regression image shows a solid green
leaf slab taking over Hole 1's second-shot view with the bottom throw rail
still responsive. This is a camera visibility problem, not a disc trajectory
problem.

## Root cause

Before this change, aim poses were derived only from the lie and the next
basket. Camera clearance clamped against analytic terrain height, while the
ordinary world camera considered only the *horizontal* radii of collision
trunks. Large, overlapping redwood crown and native/rainforest leaf meshes
can therefore envelop the eye or block its entire line of sight to the
player. Camera lerping could also move an otherwise valid target pose
straight through a canopy.

## Spatial solution

- Every authored instanced redwood/alpine crown, trunk, native tree and
  rainforest canopy contributes a conservative 3D ellipsoid matching its
  actual procedural dimensions; no invisible global vegetation removal.
- `CameraVisibilityField` partitions ellipsoids into 9-unit spatial-hash
  cells. Exact swept 3D ray/ellipsoid intersection rejects candidates
  occluding either the player head or torso, or containing the camera.
- Keep the existing basket-aligned shot whenever it is clear. Otherwise
  search candidate third-person poses around the player over different
  yaw offsets, heights and boom lengths. Score primarily for visibility,
  secondarily for original cinematic composition and previous framing.
- Query the field again on the *interpolated* camera, not only on the
  desired target. If a blend enters a crown, cut immediately to the
  validated safe shot, avoiding frames engulfed in leaf triangles.
- Cache the selected shot while the lie, focus and requested pose remain
  stable; this avoids a large search on every render frame and suppresses
  symmetric angle flipping. Expose read-only canvas diagnostics
  `data-disc-golf-camera-volumes`, `...-adjusted`, `...-clear` and
  `...-rendered-camera-clear` for CI.
- Scope active camera repositioning to ready, landed and water disc-golf
  aiming states. Preserve disc-flight tracking, Shasta's cinematic fetch,
  first-hole basket introduction, cave and sea cameras, and all gameplay
  collision, throwing and scoring semantics.

## Acceptance criteria

1. Open Hole 1 and throw from the tee. Wait for Shasta to return the disc
   and the second lie to become playable.
2. The next aiming shot contains a visible player silhouette rather than
   a solid green polygon, including while the camera interpolates.
3. The throw rail still fires a second counted shot. Canopy and intended
   landscape remain unchanged; no global tree hiding.
4. Synthetic regression: a leaf ellipsoid occupying the camera is
   detected in full 3D and corrected by local yaw/lift/boom search.
5. New checks participate in World Landscape Regression and the real
   Chromium disc-golf acceptance step. Manual device/visual inspection
   remains required before merging.
