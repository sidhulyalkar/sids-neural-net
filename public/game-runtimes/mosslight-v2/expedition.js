(() => {
  'use strict';

  const content = window.MosslightContent;
  const atlas = window.MosslightAtlas;
  if (!content?.rooms?.length || !atlas?.scenes?.length) return;

  const RUN_SIZE = content.rooms.length;
  const STORAGE_KEY = 'sid.mosslight.atlas-deck.v1';
  const PLAYTEST = new URLSearchParams(window.location.search).has('playtest');
  const templates = JSON.parse(JSON.stringify(content.rooms));
  const sceneByIndex = new Map(atlas.scenes.map((scene) => [scene.index, scene]));
  let activeRooms = [];
  let deckSnapshot = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const pad = (value) => String(value).padStart(3, '0');
  const titleCase = (value) => value.replace(/\b\w/g, (letter) => letter.toUpperCase());

  function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] || 0x51d7348b;
    } catch {
      return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
    }
  }

  function shuffledIndices(seed) {
    const rng = mulberry32(seed);
    const order = atlas.scenes.map((scene) => scene.index);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function validDeck(value) {
    return value && value.schemaVersion === 1 && Array.isArray(value.order) && value.order.length === atlas.count && Number.isInteger(value.cursor) && Number.isInteger(value.cycle) && Number.isInteger(value.seed);
  }

  function loadDeck() {
    if (PLAYTEST) return { schemaVersion: 1, order: atlas.scenes.map((scene) => scene.index), cursor: 0, cycle: 0, seed: 1 };
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (validDeck(stored)) return stored;
    } catch {}
    const seed = randomSeed();
    return { schemaVersion: 1, order: shuffledIndices(seed), cursor: 0, cycle: 0, seed };
  }

  function saveDeck(deck) {
    if (PLAYTEST) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(deck)); } catch {}
  }

  function takeScenes(count = RUN_SIZE) {
    const deck = loadDeck();
    const selected = [];
    while (selected.length < count) {
      if (deck.cursor >= deck.order.length) {
        deck.cycle += 1;
        deck.seed = (deck.seed + 0x9e3779b9 + deck.cycle * 7919) >>> 0;
        deck.order = shuffledIndices(deck.seed);
        deck.cursor = 0;
      }
      const index = deck.order[deck.cursor++];
      const scene = sceneByIndex.get(index);
      if (scene) selected.push(scene);
    }
    saveDeck(deck);
    deckSnapshot = { cycle: deck.cycle, cursor: deck.cursor, remaining: Math.max(0, deck.order.length - deck.cursor) };
    return selected;
  }

  function rgb(hex) {
    const raw = hex.replace('#', '');
    const normalized = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    const value = Number.parseInt(normalized, 16);
    return [value >> 16, (value >> 8) & 255, value & 255];
  }

  function shade(hex, amount) {
    const [r, g, b] = rgb(hex);
    const factor = clamp(amount, 0, 1);
    return `#${[r, g, b].map((value) => Math.round(value * factor).toString(16).padStart(2, '0')).join('')}`;
  }

  function decorFor(scene) {
    const cues = new Set(scene.scene.renderCues);
    if (['reef', 'shore', 'wetland'].includes(scene.terrain) || ['coral', 'kelp', 'ocean'].some((cue) => cues.has(cue))) return 'tide';
    if (['river', 'lake'].includes(scene.terrain) || ['river', 'lake', 'waterfall'].some((cue) => cues.has(cue))) return 'river';
    if (['ice', 'snow', 'mountain'].includes(scene.terrain) || ['ice', 'snow', 'mountain'].some((cue) => cues.has(cue))) return 'alpine';
    if (['garden', 'meadow', 'field'].includes(scene.terrain) || ['flower', 'sunflower', 'grass'].some((cue) => cues.has(cue))) return scene.scene.depth === 'macro' ? 'garden' : 'meadow';
    if (scene.terrain === 'forest' || ['tree', 'pine', 'oak', 'bamboo', 'moss', 'fern', 'roots'].some((cue) => cues.has(cue))) return 'hollow';
    if (['desert', 'canyon', 'volcanic'].includes(scene.terrain) || ['sand', 'canyon', 'cactus'].some((cue) => cues.has(cue))) return 'burn';
    if (scene.collection === 'celestial' || ['stars', 'aurora', 'meteor', 'crystal', 'glow'].some((cue) => cues.has(cue))) return scene.scene.depth === 'panorama' ? 'heart' : 'glasshouse';
    return ['garden', 'orchard', 'hollow', 'meadow', 'glasshouse', 'heart'][scene.seed % 6];
  }

  function paletteFor(scene) {
    const palette = scene.palette;
    return {
      bg: shade(palette.sky, scene.scene.atmosphere === 'night' ? 0.2 : 0.28),
      floor: shade(palette.ground, 0.48),
      accent: palette.accent,
      water: palette.water,
      warm: palette.glow || palette.secondary,
    };
  }

  function obstacleKind(scene, original) {
    const cues = new Set(scene.scene.renderCues);
    if (scene.terrain === 'ice' || cues.has('ice') || cues.has('snow')) return 'ice';
    if (scene.terrain === 'forest' || ['tree', 'roots', 'log', 'bamboo'].some((cue) => cues.has(cue))) return original === 'hedge' ? 'hedge' : ['tree', 'root', 'log'][scene.seed % 3];
    if (['reef', 'wetland', 'shore'].includes(scene.terrain) || cues.has('coral') || cues.has('kelp')) return 'mangrove';
    if (scene.terrain === 'desert' || scene.terrain === 'canyon' || scene.terrain === 'volcanic') return scene.terrain === 'volcanic' ? 'char' : 'rock';
    if (cues.has('crystal')) return 'ice';
    return original;
  }

  function hazardType(scene, fallback) {
    const atmosphere = scene.scene.atmosphere;
    if (atmosphere === 'snow' || atmosphere === 'frost' || scene.terrain === 'ice') return 'cold';
    if (atmosphere === 'storm' || atmosphere === 'rain' || ['river', 'shore', 'reef', 'wetland'].includes(scene.terrain)) return 'current';
    if (scene.terrain === 'desert' || scene.terrain === 'volcanic' || atmosphere === 'sunset') return 'heat';
    if (scene.terrain === 'forest' || scene.scene.density > 0.76) return 'thorn';
    if (atmosphere === 'fog' || atmosphere === 'mist') return 'smoke';
    return fallback;
  }

  function targetLabel(target, scene, index) {
    const focal = scene.scene.focalSubject || scene.name;
    if (target.kind === 'animal') return scene.wildlife?.[index % Math.max(1, scene.wildlife.length)] || 'returning wildlife';
    if (target.kind === 'cloud') return `${scene.scene.atmosphere} cloud`;
    if (target.kind === 'sluice') return `${scene.terrain} flow gate`;
    if (target.kind === 'heart') return `${focal} habitat core`;
    if (target.kind === 'fruit') return `${focal} food source`;
    if (target.kind === 'ember') return `stressed ${focal}`;
    if (target.kind === 'ice') return `${focal} thaw point`;
    if (target.kind === 'coral') return `${focal} nursery`;
    if (target.kind === 'pollinator') return `${focal} pollinator patch`;
    return `${focal} ${index + 1}`;
  }

  function pointInsideObstacle(x, y, obstacle, margin = 28) {
    return x > obstacle.x - margin && x < obstacle.x + obstacle.w + margin && y > obstacle.y - margin && y < obstacle.y + obstacle.h + margin;
  }

  function adaptRoom(template, scene, slot) {
    const room = JSON.parse(JSON.stringify(template));
    const rng = mulberry32((scene.seed ^ ((slot + 1) * 0x45d9f3b)) >>> 0);
    room.id = `atlas-${pad(scene.index)}-${template.id}`;
    room.title = `${scene.icon} ${titleCase(scene.name)}`;
    room.subtitle = `world ${pad(scene.index)} · ${scene.collectionLabel}`;
    room.task = `Restore this ${scene.scene.atmosphere} ${scene.terrain} vignette: ${template.task.charAt(0).toLowerCase()}${template.task.slice(1)}`;
    room.teaching = `Mouse or arrow keys aim. Click or Space casts. ${template.teaching.replace(/Aim with the mouse\. ?/i, '')}`;
    room.decor = decorFor(scene);
    room.palette = paletteFor(scene);
    room.atlas = scene;

    room.obstacles = room.obstacles.map((obstacle, index) => ({
      ...obstacle,
      x: clamp(obstacle.x + (rng() - 0.5) * 34, 70, 820),
      y: clamp(obstacle.y + (rng() - 0.5) * 28, 100, 500),
      kind: obstacleKind(scene, obstacle.kind),
      atlasCue: scene.scene.renderCues[index % Math.max(1, scene.scene.renderCues.length)],
    }));

    room.targets = room.targets.map((target, index) => {
      let x = clamp(target.x + (rng() - 0.5) * 74, 150, 830);
      let y = clamp(target.y + (rng() - 0.5) * 62, 125, 500);
      for (let attempt = 0; attempt < 8 && room.obstacles.some((obstacle) => pointInsideObstacle(x, y, obstacle)); attempt += 1) {
        x = clamp(170 + rng() * 620, 150, 830);
        y = clamp(130 + rng() * 350, 125, 500);
      }
      const next = {
        ...target,
        id: `${room.id}-${target.id}`,
        label: targetLabel(target, scene, index),
        x,
        y,
        baseX: x,
        baseY: y,
      };
      if (next.zone) {
        next.zone = {
          ...next.zone,
          x: clamp(next.zone.x + (rng() - 0.5) * 60, 170, 800),
          y: clamp(next.zone.y + (rng() - 0.5) * 50, 145, 480),
        };
      }
      if (next.kind === 'animal' && scene.wildlife?.length) next.species = scene.wildlife[index % scene.wildlife.length];
      if (next.kind === 'sluice') next.orientation = (next.goal + 1 + Math.floor(rng() * 3)) % 4;
      return next;
    });

    room.hazards = room.hazards.map((hazard) => {
      const speed = Math.max(36, Math.hypot(hazard.vx, hazard.vy));
      const angle = rng() * Math.PI * 2;
      return {
        ...hazard,
        type: hazardType(scene, hazard.type),
        x: clamp(hazard.x + (rng() - 0.5) * 80, 130, 830),
        y: clamp(hazard.y + (rng() - 0.5) * 70, 125, 500),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      };
    });

    if (slot >= 4 && room.hazards.length === 0 && ['storm', 'rain', 'snow', 'wind'].includes(scene.scene.atmosphere)) {
      const angle = rng() * Math.PI * 2;
      room.hazards.push({
        type: hazardType(scene, 'current'),
        x: 380 + rng() * 310,
        y: 180 + rng() * 220,
        vx: Math.cos(angle) * 54,
        vy: Math.sin(angle) * 54,
        r: 18,
      });
    }

    return room;
  }

  function newExpedition() {
    const scenes = takeScenes(RUN_SIZE);
    activeRooms = templates.map((template, slot) => adaptRoom(template, scenes[slot], slot));
    content.rooms.splice(0, content.rooms.length, ...activeRooms);
    const start = document.getElementById('start');
    if (start) start.textContent = `enter world ${pad(scenes[0].index)}`;
    return activeRooms;
  }

  function cueSet(scene) { return new Set(scene?.scene?.renderCues || []); }

  function installAtlasOverlay() {
    const game = document.getElementById('game');
    const base = document.getElementById('c');
    if (!game || !base || document.getElementById('atlasOverlay')) return;
    const overlay = document.createElement('canvas');
    overlay.id = 'atlasOverlay';
    overlay.width = 960;
    overlay.height = 640;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.pointerEvents = 'none';
    overlay.style.cursor = 'default';
    overlay.style.opacity = '0.34';
    base.insertAdjacentElement('afterend', overlay);
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    const activeScene = () => {
      const title = document.getElementById('roomTitle')?.textContent;
      return activeRooms.find((room) => room.title === title)?.atlas || activeRooms[0]?.atlas;
    };

    function lineWave(y, amp, phase, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = 40; x <= 920; x += 20) {
        const yy = y + Math.sin(x * 0.021 + phase) * amp;
        if (x === 40) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    function frame(now) {
      ctx.clearRect(0, 0, 960, 640);
      const scene = activeScene();
      if (scene) {
        const cues = cueSet(scene);
        const t = now * 0.001;
        const color = scene.palette.accent;
        const glow = scene.palette.glow;
        const rng = mulberry32(scene.seed >>> 0);
        ctx.save();

        if (['rain', 'storm'].includes(scene.scene.atmosphere)) {
          ctx.strokeStyle = `${scene.palette.water}55`;
          ctx.lineWidth = 1;
          for (let i = 0; i < 28; i += 1) {
            const x = (rng() * 1040 + t * 55) % 1040 - 40;
            const y = (rng() * 720 + t * 130) % 720 - 40;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 20); ctx.stroke();
          }
        }

        if (['snow', 'frost'].includes(scene.scene.atmosphere) || cues.has('snow') || cues.has('ice')) {
          ctx.fillStyle = '#e8fbff66';
          for (let i = 0; i < 24; i += 1) {
            const x = (rng() * 960 + Math.sin(t + i) * 18) % 960;
            const y = (rng() * 700 + t * (8 + (i % 4) * 3)) % 700 - 30;
            ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * 0.7, 0, Math.PI * 2); ctx.fill();
          }
        }

        if (['water', 'river', 'lake', 'ocean', 'waterfall'].some((cue) => cues.has(cue)) || ['shore', 'reef', 'wetland'].includes(scene.terrain)) {
          for (let i = 0; i < 4; i += 1) lineWave(472 + i * 25, 5 + i * 1.5, t * (0.45 + i * 0.08), `${scene.palette.water}36`);
        }

        if (['mountain', 'canyon'].some((cue) => cues.has(cue)) || ['mountain', 'canyon'].includes(scene.terrain)) {
          ctx.strokeStyle = `${color}30`;
          for (let i = 0; i < 7; i += 1) {
            const x = 40 + i * 145;
            const h = 55 + ((scene.seed + i * 37) % 80);
            ctx.beginPath(); ctx.moveTo(x - 80, 570); ctx.lineTo(x, 570 - h); ctx.lineTo(x + 95, 570); ctx.stroke();
          }
        }

        if (['tree', 'pine', 'oak', 'bamboo', 'roots'].some((cue) => cues.has(cue))) {
          ctx.strokeStyle = `${color}2e`;
          ctx.lineWidth = 2;
          for (const side of [1, -1]) {
            ctx.beginPath();
            ctx.moveTo(side > 0 ? 35 : 925, 540);
            for (let i = 0; i < 6; i += 1) {
              const x = side > 0 ? 45 + i * 20 : 915 - i * 20;
              const y = 500 - i * 66 + Math.sin(t + i) * 4;
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }

        if (['flower', 'sunflower'].some((cue) => cues.has(cue))) {
          ctx.fillStyle = `${glow}55`;
          for (let i = 0; i < 16; i += 1) {
            const x = 70 + rng() * 820;
            const y = 105 + rng() * 430;
            const pulse = 1.5 + Math.sin(t * 1.4 + i) * 0.6;
            ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.fill();
          }
        }

        if (cues.has('crystal')) {
          ctx.strokeStyle = `${glow}4d`;
          for (let i = 0; i < 9; i += 1) {
            const x = 90 + rng() * 780;
            const y = 110 + rng() * 390;
            const r = 7 + rng() * 13;
            ctx.beginPath();
            ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.65, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.65, y); ctx.closePath(); ctx.stroke();
          }
        }

        if (scene.collection === 'celestial' || ['stars', 'meteor', 'aurora'].some((cue) => cues.has(cue))) {
          ctx.fillStyle = `${glow}75`;
          for (let i = 0; i < 34; i += 1) {
            const x = 50 + rng() * 860;
            const y = 78 + rng() * 250;
            const pulse = 0.7 + 0.7 * Math.sin(t * 1.7 + i);
            ctx.beginPath(); ctx.arc(x, y, 0.7 + pulse, 0, Math.PI * 2); ctx.fill();
          }
          if (cues.has('aurora')) {
            ctx.strokeStyle = `${color}45`; ctx.lineWidth = 7;
            ctx.beginPath();
            for (let x = 80; x < 900; x += 20) {
              const y = 125 + Math.sin(x * 0.012 + t * 0.35) * 28;
              if (x === 80) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }

        if (scene.scene.atmosphere === 'glow' || cues.has('firefly') || cues.has('glow')) {
          ctx.fillStyle = `${glow}70`;
          const count = 12 + Math.round(scene.scene.sparkle * 18);
          for (let i = 0; i < count; i += 1) {
            const x = 55 + rng() * 850 + Math.sin(t * 0.8 + i) * 7;
            const y = 85 + rng() * 460 + Math.cos(t * 0.65 + i * 0.7) * 7;
            ctx.beginPath(); ctx.arc(x, y, 1.2 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill();
          }
        }

        ctx.restore();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  newExpedition();
  installAtlasOverlay();

  for (const id of ['again', 'flowAgain']) {
    document.getElementById(id)?.addEventListener('click', () => newExpedition());
  }

  window.MosslightExpedition = {
    schemaVersion: 1,
    atlasCount: atlas.count,
    runSize: RUN_SIZE,
    newRun: newExpedition,
    summary: () => ({
      atlasCount: atlas.count,
      runSize: RUN_SIZE,
      worlds: activeRooms.map((room) => ({ index: room.atlas.index, id: room.atlas.id, title: room.title, collection: room.atlas.collection })),
      deck: deckSnapshot,
      playtest: PLAYTEST,
    }),
  };
})();
