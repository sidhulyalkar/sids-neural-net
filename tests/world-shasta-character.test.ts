import { test } from "node:test";
import assert from "node:assert/strict";
import { SHASTA_CHARACTER } from "../lib/world/shastaCharacter";

test("Shasta identity is explicit and male", () => {
  assert.equal(SHASTA_CHARACTER.identity.name, "Shasta");
  assert.equal(SHASTA_CHARACTER.identity.sex, "male");
  assert.equal(SHASTA_CHARACTER.identity.build, "lean-athletic");
});

test("Shasta face colors and proportions match the supplied photo profile", () => {
  assert.equal(SHASTA_CHARACTER.palette.amberEye, "#a87942");
  assert.equal(SHASTA_CHARACTER.palette.pinkBrownNose, "#95645b");
  assert.notEqual(
    SHASTA_CHARACTER.palette.amberEye,
    SHASTA_CHARACTER.palette.sable,
  );
  assert.ok(
    SHASTA_CHARACTER.proportions.muzzle.z > SHASTA_CHARACTER.proportions.head.z,
    "muzzle should project distinctly forward",
  );
  assert.ok(
    SHASTA_CHARACTER.proportions.cheek.x < SHASTA_CHARACTER.proportions.head.x,
    "cheek ruff should soften the face without widening the skull",
  );
});

test("Shasta coat keeps a light underside and layered warm saddle", () => {
  const { palette, coat } = SHASTA_CHARACTER;
  assert.notEqual(palette.creamWhite, palette.warmTan);
  assert.notEqual(palette.warmTan, palette.sable);
  assert.ok(coat.saddleSpine.sy < coat.saddleCenter.sy);
  assert.ok(coat.saddleSpine.sx < coat.saddleCenter.sx);
  assert.ok(coat.saddleSpine.sz < coat.saddleCenter.sz);
});

test("Shasta tail is a broad relaxed plume, not a tight torus", () => {
  const plume = SHASTA_CHARACTER.tail.plume;
  assert.equal(plume.length, 6);
  assert.ok(plume[2].y < plume[0].y, "plume should sweep downward from the hips");
  assert.ok(plume.at(-1)!.x > plume[1].x, "tip should curl gently outward");
  assert.ok(plume.at(-1)!.y > plume[3].y, "tip should lift after the low point");
  assert.ok(Math.abs(SHASTA_CHARACTER.tail.restAngleZ) < 0.1);
});

test("Shasta rendering profile keeps a smooth bespoke body and continuous plume", () => {
  assert.equal(SHASTA_CHARACTER.rendering.profileVersion, "photo-profile-v4-almond-eyes");
  assert.equal(SHASTA_CHARACTER.rendering.tailStyle, "continuous-relaxed-plume");
  assert.ok(SHASTA_CHARACTER.rendering.bodySegments >= 9);
  assert.ok(SHASTA_CHARACTER.rendering.bodyRings >= 7);
});

test("Shasta renders without a harness or volumetric brow markings", () => {
  assert.equal(SHASTA_CHARACTER.accessories.harnessInWorld, false);
  assert.equal("crownTan" in SHASTA_CHARACTER.coat, false);
  assert.ok(
    SHASTA_CHARACTER.proportions.cheek.y < SHASTA_CHARACTER.proportions.head.y * 0.5,
    "cheek ruff should not distort the face silhouette",
  );
});

test("Shasta eyes follow head curvature and maintain natural canine proportions", () => {
  const { face, proportions, palette } = SHASTA_CHARACTER;
  const x = face.eyeX / proportions.head.x;
  const y = (face.eyeY - 1.43) / proportions.head.y;
  const headSurface = 0.73 + proportions.head.z * Math.sqrt(1 - x*x - y*y);
  assert.ok(Math.abs(face.rimZ - headSurface) < 0.012, "rim rests against skull");
  assert.ok(face.rimZ < face.irisZ && face.irisZ < face.pupilZ);
  assert.ok(face.pupilZ + face.pupilRadius.z < headSurface + 0.04,
    "eye cannot protrude like an independent sphere");
  assert.ok(face.rimRadius.x > face.rimRadius.y * 1.5, "almond shape, not bulging circular eye");
  assert.ok(face.irisRadius.x < face.rimRadius.x * 0.65);
  assert.ok(face.pupilRadius.x < face.irisRadius.x * 0.5);
  assert.notEqual(palette.eyeRim, palette.creamWhite,
    "no oversized white eye socket or human-like sclera");
});
