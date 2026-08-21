(() => {
  'use strict';

  const content = window.MosslightContent;
  if (!content?.rooms?.length) return;

  const POWERUPS = [
    {
      id: 'rapid-bloom',
      name: 'Rapid Bloom',
      icon: '✦',
      color: '#7bf19d',
      description: 'casts recharge 28% faster',
      apply: { fireRate: 1.28 },
    },
    {
      id: 'giant-dew',
      name: 'Giant Dew',
      icon: '◉',
      color: '#6bdcff',
      description: 'restoration shots grow 38%',
      apply: { projectileScale: 1.38 },
    },
    {
      id: 'prism-spores',
      name: 'Prism Spores',
      icon: '⟡',
      color: '#e4a7ff',
      description: 'every cast becomes a three-shot fan',
      apply: { spread: 3 },
    },
    {
      id: 'river-echo',
      name: 'River Echo',
      icon: '≈',
      color: '#85e9ff',
      description: 'shots can pass through one relationship',
      apply: { pierce: 1 },
    },
    {
      id: 'sunstep',
      name: 'Sunstep',
      icon: '☀',
      color: '#ffd66b',
      description: 'move faster and dash sooner',
      apply: { moveSpeed: 1.16, dashRecharge: 1.28 },
    },
    {
      id: 'moss-ward',
      name: 'Moss Ward',
      icon: '⬡',
      color: '#c8f7ed',
      description: 'grow a renewable stress shield',
      apply: { shield: 1 },
    },
  ];

  const MOVEMENT_PATTERNS = ['patrol', 'weave', 'orbit', 'swoop', 'stalk', 'dash', 'spiral'];
  const ANIMAL_PATTERNS = ['prowl', 'swoop', 'graze', 'hop', 'flee', 'orbit'];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function rngFrom(seed) {
    let value = (seed || 1) >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sceneSeed(room, slot) {
    return ((room.atlas?.seed || 0x51d7348b) ^ ((slot + 1) * 0x9e3779b9)) >>> 0;
  }

  function cueSet(room) {
    return new Set(room.atlas?.scene?.renderCues || []);
  }

  function situationFor(room, slot) {
    const terrain = room.atlas?.terrain || room.decor;
    const atmosphere = room.atlas?.scene?.atmosphere || 'calm';
    const cues = cueSet(room);

    if (slot === 9) return { id: 'earthheart-convergence', name: 'Earthheart convergence', hint: 'Read several moving lanes at once. Restore in the openings.' };
    if (['reef', 'shore', 'wetland', 'river', 'lake'].includes(terrain) || cues.has('coral') || cues.has('water')) {
      return { id: 'tidal-lanes', name: 'tidal lanes', hint: 'Currents sweep in readable bands. Cross after a lane passes.' };
    }
    if (['forest', 'garden', 'meadow', 'field'].includes(terrain) || cues.has('tree') || cues.has('roots')) {
      return { id: 'living-corridor', name: 'living corridor', hint: 'Roots and wildlife reshape the safe route. Keep an exit lane in mind.' };
    }
    if (['desert', 'canyon', 'volcanic'].includes(terrain) || atmosphere === 'sunset') {
      return { id: 'heat-crossing', name: 'heat crossing', hint: 'Heat fronts open and close crossing windows. Dash through the cool gap.' };
    }
    if (['ice', 'snow', 'mountain'].includes(terrain) || cues.has('ice') || cues.has('snow')) {
      return { id: 'alpine-switchback', name: 'alpine switchback', hint: 'Cold fronts weave across narrow routes. Change lanes before they meet.' };
    }
    if (room.atlas?.collection === 'celestial' || cues.has('stars') || cues.has('meteor') || cues.has('aurora')) {
      return { id: 'orbital-dance', name: 'orbital dance', hint: 'Orbiting bodies create rotating gaps. Move with the gap instead of against it.' };
    }
    if (['storm', 'rain', 'wind'].includes(atmosphere)) {
      return { id: 'weather-window', name: 'weather window', hint: 'Weather sweeps the arena in pulses. Restore during the quiet beat.' };
    }
    return { id: 'migration-path', name: 'migration path', hint: 'Wildlife crosses the room in patterns. Read the route, then move.' };
  }

  function speciesFor(room, index) {
    const wildlife = room.atlas?.wildlife || [];
    if (wildlife.length) return wildlife[index % wildlife.length];
    const terrain = room.atlas?.terrain || '';
    if (['reef', 'shore', 'wetland'].includes(terrain)) return ['ray', 'turtle', 'heron'][index % 3];
    if (['ice', 'snow', 'mountain'].includes(terrain)) return ['marmot', 'hare', 'goat'][index % 3];
    if (['desert', 'canyon'].includes(terrain)) return ['lizard', 'hawk', 'fox'][index % 3];
    return ['fox', 'owl', 'deer', 'moth'][index % 4];
  }

  function encounterPatternFor(room, index, slot) {
    const species = String(speciesFor(room, index)).toLowerCase();
    if (/owl|hawk|eagle|bird|moth|butterfly|bat/.test(species)) return slot >= 5 ? 'swoop' : 'weave';
    if (/deer|goat|antelope|horse/.test(species)) return slot >= 6 ? 'dash' : 'patrol';
    if (/fox|wolf|cat|lynx/.test(species)) return slot >= 7 ? 'stalk' : 'weave';
    if (/ray|fish|turtle|dolphin|whale/.test(species)) return slot >= 6 ? 'orbit' : 'weave';
    if (/marmot|hare|rabbit/.test(species)) return slot >= 5 ? 'dash' : 'patrol';
    return MOVEMENT_PATTERNS[(sceneSeed(room, slot) + index * 3) % MOVEMENT_PATTERNS.length];
  }

  function animalPatternFor(target, room, index) {
    const species = String(target.species || '').toLowerCase();
    if (/owl|hawk|bird|moth|butterfly|bat/.test(species)) return 'swoop';
    if (/deer|goat|antelope/.test(species)) return 'flee';
    if (/fox|wolf|cat|lynx/.test(species)) return 'prowl';
    if (/marmot|hare|rabbit/.test(species)) return 'hop';
    if (/ray|fish|turtle/.test(species)) return 'orbit';
    return ANIMAL_PATTERNS[(sceneSeed(room, index) + index) % ANIMAL_PATTERNS.length];
  }

  function makeEncounter(room, slot, index, rng, level) {
    const pattern = encounterPatternFor(room, index, slot);
    const species = speciesFor(room, index);
    const speed = 54 + level * 6 + rng() * 22;
    const edge = index % 4;
    const x = edge === 0 ? 160 : edge === 2 ? 800 : 250 + rng() * 460;
    const y = edge === 1 ? 135 : edge === 3 ? 505 : 145 + rng() * 340;
    return {
      id: `${room.id}-encounter-${index}`,
      species,
      pattern,
      x,
      y,
      baseX: x,
      baseY: y,
      r: 13 + Math.min(5, level * 0.45),
      speed,
      phase: rng() * Math.PI * 2,
      range: 74 + rng() * 95,
      orbitRadius: 64 + rng() * 92,
      dashEvery: clamp(3.6 - level * 0.18 + rng() * 0.8, 1.65, 4.2),
      telegraph: 0,
      dashClock: 0.7 + rng() * 2.2,
      vx: 0,
      vy: 0,
      heading: rng() * Math.PI * 2,
    };
  }

  function motionForObstacle(room, slot, index, rng) {
    if (slot < 3) return null;
    const situation = room.challenge?.situation?.id || '';
    const axis = index % 2 ? 'y' : 'x';
    if (situation === 'orbital-dance' && slot >= 6) {
      return { type: 'orbit', radius: 18 + rng() * 28, speed: 0.45 + rng() * 0.35, phase: rng() * Math.PI * 2 };
    }
    if (situation === 'living-corridor') {
      return { type: axis === 'x' ? 'slide-x' : 'slide-y', range: 30 + slot * 4, speed: 0.55 + rng() * 0.45, phase: rng() * Math.PI * 2 };
    }
    if (slot >= 5 && index === 0) {
      return { type: axis === 'x' ? 'slide-x' : 'slide-y', range: 24 + slot * 3, speed: 0.45 + rng() * 0.5, phase: rng() * Math.PI * 2 };
    }
    return null;
  }

  function powerupFor(room, slot, rng) {
    // Room 1 stays pure tutorial. Every later room contains one world gift.
    if (slot === 0) return null;
    const sceneOffset = (room.atlas?.seed || 0) % POWERUPS.length;
    const powerup = POWERUPS[(sceneOffset + slot * 2) % POWERUPS.length];
    return {
      ...powerup,
      x: clamp(180 + rng() * 600, 160, 800),
      y: clamp(135 + rng() * 350, 125, 500),
      r: 15,
      collected: false,
    };
  }

  function enrichRoom(room, slot) {
    if (room.directorVersion === 1) return room;
    const rng = rngFrom(sceneSeed(room, slot));
    const level = slot + 1;
    const pressure = clamp((level - 1) / 9, 0, 1);
    const situation = situationFor(room, slot);
    const encounterCount = slot < 2 ? 0 : Math.min(5, 1 + Math.floor((slot - 1) / 2));

    room.challenge = {
      level,
      pressure,
      speedScale: 0.78 + pressure * 0.66,
      encounterCount,
      situation,
      rewardLabel: slot === 0 ? 'learn the restoration loop' : 'find the world gift while you restore',
    };

    room.targets.forEach((target, index) => {
      if (target.kind !== 'animal') return;
      target.movementPattern = animalPatternFor(target, room, index);
      target.movePhase = rng() * Math.PI * 2;
      target.moveRange = Math.max(target.wander || 18, 20 + level * 3);
      target.moveSpeed = 0.7 + rng() * 0.55 + pressure * 0.35;
    });

    room.obstacles.forEach((obstacle, index) => {
      obstacle.baseX = obstacle.x;
      obstacle.baseY = obstacle.y;
      obstacle.motion = motionForObstacle(room, slot, index, rng);
    });

    // Existing environmental fronts remain, but the Director gives each one a
    // motion grammar instead of leaving everything as edge-bouncing circles.
    room.hazards.forEach((hazard, index) => {
      hazard.baseX = hazard.x;
      hazard.baseY = hazard.y;
      hazard.pattern = ['patrol', 'weave', 'orbit', 'sweep'][(slot + index) % 4];
      hazard.phase = rng() * Math.PI * 2;
      hazard.range = 60 + rng() * 95;
      hazard.speedScale = 0.85 + pressure * 0.7;
    });

    room.encounters = Array.from({ length: encounterCount }, (_, index) => makeEncounter(room, slot, index, rng, level));
    room.powerup = powerupFor(room, slot, rng);
    room.directorVersion = 1;
    room.teaching = `${room.teaching} ${situation.hint}`;
    room.mechanic = `${room.mechanic} · threat ${level}/10`;
    return room;
  }

  function enrichRooms() {
    content.rooms.forEach((room, slot) => enrichRoom(room, slot));
    return content.rooms;
  }

  enrichRooms();

  const expedition = window.MosslightExpedition;
  if (expedition?.newRun) {
    const originalNewRun = expedition.newRun.bind(expedition);
    expedition.newRun = (...args) => {
      const result = originalNewRun(...args);
      enrichRooms();
      return result;
    };
  }

  // expedition.js registered these handlers before this script, so on click the
  // freshly generated Atlas rooms exist by the time this enrichment runs. game-v3
  // registers its restart handler afterwards and therefore sees enriched rooms.
  for (const id of ['again', 'flowAgain']) {
    document.getElementById(id)?.addEventListener('click', enrichRooms);
  }

  window.MosslightDirector = {
    schemaVersion: 1,
    powerups: POWERUPS,
    movementPatterns: MOVEMENT_PATTERNS,
    refresh: enrichRooms,
    summary: () => content.rooms.map((room) => ({
      id: room.id,
      level: room.challenge?.level,
      situation: room.challenge?.situation?.id,
      encounterPatterns: room.encounters?.map((encounter) => encounter.pattern) || [],
      animalPatterns: room.targets.filter((target) => target.kind === 'animal').map((target) => target.movementPattern),
      movingObstacles: room.obstacles.filter((obstacle) => obstacle.motion).length,
      powerup: room.powerup?.id || null,
    })),
  };
})();
