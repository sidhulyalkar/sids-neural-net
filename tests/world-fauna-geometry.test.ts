import test from "node:test";
import assert from "node:assert/strict";
import { createFishGeometry, createSharkGeometry, createRayWingGeometry, createCaudalFinGeometry } from "../components/world/worldFaunaGeometry";

test("marine meshes have finite lighting data and bounded triangle budgets", () => {
  const meshes = [createFishGeometry("anchovy", "#b7cad0"), createFishGeometry("rockfish", "#d07c3b"), createSharkGeometry("leopard"), createSharkGeometry("blacktip"), createRayWingGeometry()];
  for (const g of meshes) {
    for (const name of ["position", "normal"]) {
      const a = g.getAttribute(name);
      assert.ok(a.count > 60);
      assert.ok(Array.from(a.array).every(Number.isFinite));
    }
    assert.ok((g.index?.count ?? g.getAttribute("position").count) / 3 < 1500);
    assert.ok(g.boundingSphere && Number.isFinite(g.boundingSphere.radius));
    g.dispose();
  }
});

test("sharks have broad paired fins, a tapered snout and two caudal lobes", () => {
  for (const kind of ["leopard", "blacktip"] as const) {
    const g = createSharkGeometry(kind), p = g.getAttribute("position");
    const points = Array.from({length:p.count}, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)]);
    assert.ok(points.some(([x]) => x > 1));
    assert.ok(points.some(([x]) => x < -1));
    assert.ok(points.some(([, y, z]) => z < -2.1 && y > .6));
    assert.ok(points.some(([, y, z]) => z < -2.1 && y < -.3));
    assert.ok(points.filter(([, , z]) => z > 1.7).every(([x]) => Math.abs(x) < .12));
    assert.equal(g.getAttribute("color").count, p.count);
    g.dispose();
  }
});

test("fish tails retain a fork notch and rays have interior bend vertices", () => {
  const tail = createCaudalFinGeometry(), p = tail.getAttribute("position");
  const center = Array.from({length:p.count}, (_, i) => i).filter(i => Math.abs(p.getY(i)) < .01);
  assert.ok(center.every(i => p.getZ(i) > -.5));
  const ray = createRayWingGeometry(), r = ray.getAttribute("position");
  assert.ok(r.count > 100);
  assert.ok(Array.from({length:r.count}, (_, i) => i).some(i => Math.abs(r.getX(i)) > .3 && Math.abs(r.getX(i)) < .8 && r.getZ(i) < -.02));
  tail.dispose(); ray.dispose();
});
