(() => {
  'use strict';

  const content = window.MosslightContent;
  if (!content?.rooms?.length) return;

  const W = 960;
  const H = 640;
  const SPAWN = { x: 86, y: H / 2, r: 70 };
  const PORTAL = { x: 894, y: H / 2, r: 82 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function hash(value) {
    let result = 2166136261;
    for (const char of String(value)) {
      result ^= char.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function circleHitsRect(circle, rect, margin = 0) {
    const cx = clamp(circle.x, rect.x - margin, rect.x + rect.w + margin);
    const cy = clamp(circle.y, rect.y - margin, rect.y + rect.h + margin);
    return Math.hypot(circle.x - cx, circle.y - cy) < circle.r + margin;
  }

  function pointHitsObstacle(point, obstacle, margin = 24) {
    return point.x > obstacle.x - margin && point.x < obstacle.x + obstacle.w + margin && point.y > obstacle.y - margin && point.y < obstacle.y + obstacle.h + margin;
  }

  function repairObstacle(room, obstacle, index) {
    const original = { x: obstacle.x, y: obstacle.y };
    const blockedSpawn = circleHitsRect(SPAWN, obstacle, 10);
    const blockedPortal = circleHitsRect(PORTAL, obstacle, 10);
    if (!blockedSpawn && !blockedPortal) return null;

    const seed = hash(`${room.id}:obstacle:${index}`);
    const candidates = [
      { x: 250 + (seed % 130), y: 105 + ((seed >>> 3) % 120) },
      { x: 420 + (seed % 110), y: 390 + ((seed >>> 5) % 90) },
      { x: 600 + (seed % 90), y: 120 + ((seed >>> 7) % 130) },
      { x: 370 + (seed % 210), y: 245 + ((seed >>> 9) % 100) },
    ];

    for (const candidate of candidates) {
      const probe = { ...obstacle, x: clamp(candidate.x, 150, 790 - obstacle.w), y: clamp(candidate.y, 95, 520 - obstacle.h) };
      if (circleHitsRect(SPAWN, probe, 10) || circleHitsRect(PORTAL, probe, 10)) continue;
      const overlapsOther = room.obstacles.some((other) => other !== obstacle && probe.x < other.x + other.w + 12 && probe.x + probe.w + 12 > other.x && probe.y < other.y + other.h + 12 && probe.y + probe.h + 12 > other.y);
      if (overlapsOther) continue;
      obstacle.x = probe.x;
      obstacle.y = probe.y;
      obstacle.baseX = probe.x;
      obstacle.baseY = probe.y;
      return { kind: 'obstacle', index, from: original, to: { x: obstacle.x, y: obstacle.y } };
    }

    obstacle.x = clamp(obstacle.x, 190, 760 - obstacle.w);
    obstacle.y = obstacle.y < H / 2 ? 105 : clamp(H - 95 - obstacle.h, 100, 500);
    obstacle.baseX = obstacle.x;
    obstacle.baseY = obstacle.y;
    return { kind: 'obstacle-fallback', index, from: original, to: { x: obstacle.x, y: obstacle.y } };
  }

  function repairPowerup(room) {
    const pickup = room.powerup;
    if (!pickup) return null;
    const valid = () => {
      if (Math.hypot(pickup.x - SPAWN.x, pickup.y - SPAWN.y) < SPAWN.r + 35) return false;
      if (Math.hypot(pickup.x - PORTAL.x, pickup.y - PORTAL.y) < PORTAL.r + 18) return false;
      return !room.obstacles.some((obstacle) => pointHitsObstacle(pickup, obstacle, (pickup.r || 15) + 16));
    };
    if (valid()) return null;

    const from = { x: pickup.x, y: pickup.y };
    const seed = hash(`${room.id}:world-gift`);
    for (let attempt = 0; attempt < 18; attempt += 1) {
      pickup.x = 190 + ((seed + attempt * 137) % 590);
      pickup.y = 125 + (((seed >>> 8) + attempt * 83) % 365);
      if (valid()) return { kind: 'powerup', from, to: { x: pickup.x, y: pickup.y } };
    }
    pickup.x = W / 2;
    pickup.y = 120;
    return { kind: 'powerup-fallback', from, to: { x: pickup.x, y: pickup.y } };
  }

  function repairEncounter(room, encounter, index) {
    const point = { x: encounter.x, y: encounter.y };
    const blocked = Math.hypot(point.x - SPAWN.x, point.y - SPAWN.y) < SPAWN.r + (encounter.r || 14) + 35 || room.obstacles.some((obstacle) => pointHitsObstacle(point, obstacle, (encounter.r || 14) + 8));
    if (!blocked) return null;
    const from = { x: encounter.x, y: encounter.y };
    const seed = hash(`${room.id}:encounter:${index}`);
    encounter.x = 360 + (seed % 410);
    encounter.y = 135 + ((seed >>> 9) % 350);
    encounter.baseX = encounter.x;
    encounter.baseY = encounter.y;
    return { kind: 'encounter', index, from, to: { x: encounter.x, y: encounter.y } };
  }

  function preflightRoom(room) {
    const repairs = [];
    room.obstacles.forEach((obstacle, index) => {
      const repair = repairObstacle(room, obstacle, index);
      if (repair) repairs.push(repair);
    });
    const giftRepair = repairPowerup(room);
    if (giftRepair) repairs.push(giftRepair);
    (room.encounters || []).forEach((encounter, index) => {
      const repair = repairEncounter(room, encounter, index);
      if (repair) repairs.push(repair);
    });
    room.portalSafety = {
      spawn: { ...SPAWN },
      exit: { ...PORTAL },
      repairs,
      pass: !room.obstacles.some((obstacle) => circleHitsRect(SPAWN, obstacle, 6) || circleHitsRect(PORTAL, obstacle, 6)),
    };
    return room.portalSafety;
  }

  function run() {
    const reports = content.rooms.map(preflightRoom);
    window.MosslightArenaPreflight.last = reports;
    return reports;
  }

  window.MosslightArenaPreflight = {
    schemaVersion: 1,
    run,
    last: [],
    summary: () => window.MosslightArenaPreflight.last.map((report, index) => ({ index, pass: report.pass, repairs: report.repairs.length })),
  };

  run();

  const expedition = window.MosslightExpedition;
  if (expedition?.newRun) {
    const originalNewRun = expedition.newRun.bind(expedition);
    expedition.newRun = (...args) => {
      const result = originalNewRun(...args);
      run();
      return result;
    };
  }
})();
