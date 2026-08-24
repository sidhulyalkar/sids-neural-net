(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { ctx, W, H, state, player, TUNE, clamp, lerp } = S;

  function worldToScreenY(worldY) {
    return H - (worldY - state.cameraBottom);
  }

  function phasePalette() {
    const phase = S.phaseForFloor(player.highestFloor).name;
    if (phase === 'ROOTWAYS') return ['#07140d', '#020705', '#4f815b'];
    if (phase === 'REDWOOD RUN') return ['#071714', '#030806', '#4c8b72'];
    if (phase === 'SAPWORK') return ['#081625', '#030710', '#5b80a7'];
    if (phase === 'HIGH CANOPY') return ['#10162c', '#050713', '#7c7ab6'];
    return ['#15132b', '#060711', '#a16d9e'];
  }

  function drawBackground(now) {
    const [top, bottom, glowColor] = phasePalette();
    const heightFactor = clamp(player.highestFloor / 175, 0, 1);
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const starAlpha = clamp((player.highestFloor - 18) / 115, 0.02, 0.90);
    for (const star of state.stars) {
      const y = (star.y + state.cameraBottom * star.parallax * 0.08) % H;
      ctx.globalAlpha = star.alpha * starAlpha;
      ctx.fillStyle = '#e8ffed';
      ctx.beginPath();
      ctx.arc(star.x, y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const fog = ctx.createRadialGradient(W / 2, H * 0.72, 30, W / 2, H * 0.72, 440);
    fog.addColorStop(0, `${glowColor}${Math.round((0.10 + heightFactor * 0.04) * 255).toString(16).padStart(2, '0')}`);
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, W, H);

    if (heightFactor > 0.25) {
      ctx.save();
      ctx.globalAlpha = 0.08 + heightFactor * 0.07;
      ctx.strokeStyle = '#c5ffe1';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i += 1) {
        const x = (i * 83 + now * (5 + i % 3) + state.cameraBottom * 0.06) % (W + 100) - 50;
        const y = (i * 57 + state.cameraBottom * 0.12) % (H + 80) - 40;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 18, y + 30);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawTrunk(x, width, flip = 1) {
    const gradient = ctx.createLinearGradient(x, 0, x + width * flip, 0);
    gradient.addColorStop(0, '#150c08');
    gradient.addColorStop(0.22, '#4a2415');
    gradient.addColorStop(0.5, '#71371e');
    gradient.addColorStop(0.78, '#32170f');
    gradient.addColorStop(1, '#110a07');
    ctx.fillStyle = gradient;
    ctx.fillRect(flip > 0 ? x : x - width, 0, width, H);

    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = '#b16938';
    ctx.lineWidth = 2;
    for (let i = 0; i < 13; i += 1) {
      const offset = (i / 12) * width;
      ctx.beginPath();
      for (let y = -30; y <= H + 30; y += 24) {
        const wiggle = Math.sin((y + state.cameraBottom * 0.45) * 0.032 + i * 1.8) * (3 + (i % 3));
        const px = flip > 0 ? x + offset + wiggle : x - offset - wiggle;
        if (y === -30) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function routeColor(type) {
    if (type === 'CRUX') return '#c16d35';
    if (type === 'RECOVERY') return '#845936';
    if (type === 'SLINGSHOT') return '#ad6230';
    return '#98512a';
  }

  function drawLaunchBurl(branch, y) {
    if (!branch.launch) return;
    const x = branch.launchX;
    const pulse = 0.92 + Math.sin(state.elapsed * 4 + branch.floor) * 0.08;
    ctx.save();
    ctx.shadowColor = '#ffc56e';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,190,90,.18)';
    ctx.beginPath();
    ctx.arc(x, y, 15 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d68a42';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 8 * pulse, 5 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,173,.72)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
  }

  function drawBranch(branch) {
    const y1 = worldToScreenY(S.branchYAt(branch, branch.x1));
    const y2 = worldToScreenY(S.branchYAt(branch, branch.x2));
    if (Math.max(y1, y2) < -42 || Math.min(y1, y2) > H + 42) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2b150d';
    ctx.lineWidth = branch.thickness + 8;
    ctx.beginPath();
    ctx.moveTo(branch.x1, y1);
    ctx.lineTo(branch.x2, y2);
    ctx.stroke();
    const gradient = ctx.createLinearGradient(branch.x1, y1, branch.x2, y2);
    gradient.addColorStop(0, routeColor(branch.chunkType));
    gradient.addColorStop(0.45, '#9c5229');
    gradient.addColorStop(1, '#4b2416');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = branch.thickness;
    ctx.beginPath();
    ctx.moveTo(branch.x1, y1);
    ctx.lineTo(branch.x2, y2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(245,179,94,.24)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(branch.x1 + 4, y1 - 2);
    ctx.lineTo(branch.x2 - 4, y2 - 2);
    ctx.stroke();
    const launchY = worldToScreenY(S.branchYAt(branch, branch.launchX));
    drawLaunchBurl(branch, launchY);
    if (branch.floor > 0 && branch.floor % 10 === 0) {
      ctx.fillStyle = 'rgba(205,255,210,.28)';
      ctx.font = '9px ui-monospace,monospace';
      ctx.textAlign = branch.side === 'right' ? 'right' : 'left';
      ctx.fillText(String(branch.floor), branch.side === 'right' ? branch.x2 - 8 : branch.x1 + 8, Math.min(y1, y2) - 10);
    }
    ctx.restore();
  }

  function drawKnot(knot, time) {
    const y = worldToScreenY(knot.y);
    if (y < -50 || y > H + 50) return;
    const pulse = 1 + Math.sin(time * 3 + knot.pulse) * 0.12;
    const gradient = ctx.createRadialGradient(knot.x, y, 2, knot.x, y, 21 * pulse);
    gradient.addColorStop(0, 'rgba(255,248,174,.96)');
    gradient.addColorStop(0.25, 'rgba(255,181,73,.72)');
    gradient.addColorStop(1, 'rgba(255,132,37,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(knot.x, y, 21 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6b84f';
    ctx.beginPath();
    ctx.arc(knot.x, y, 5.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,241,188,.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawRing(ring, time) {
    if (ring.hit) return;
    const y = worldToScreenY(ring.y);
    if (y < -55 || y > H + 55) return;
    const pulse = 1 + Math.sin(time * 4.1 + ring.pulse) * 0.075;
    const r = ring.radius * pulse;
    ctx.save();
    ctx.translate(ring.x, y);
    ctx.rotate(time * 0.34 + ring.pulse);
    ctx.shadowColor = '#9effbe';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(156,255,190,.78)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,220,129,.58)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(214,255,224,.55)';
    for (let i = 0; i < 4; i += 1) {
      const a = i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSapline(alpha) {
    if (!player.sap) return;
    const sx = lerp(player.px, player.x, alpha);
    const sy = worldToScreenY(lerp(player.py, player.y, alpha));
    const ky = worldToScreenY(player.sap.knot.y);
    const dx = player.sap.knot.x - sx;
    const dy = ky - sy;
    const midX = sx + dx * 0.5 - dy * 0.06;
    const midY = sy + dy * 0.5 + dx * 0.04;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = player.combo >= TUNE.combo.sapSurgeThreshold ? '#a0ffbe' : '#ffbd55';
    ctx.shadowBlur = player.combo >= TUNE.combo.sapSurgeThreshold ? 18 : 12;
    ctx.strokeStyle = player.combo >= TUNE.combo.sapSurgeThreshold ? 'rgba(159,255,189,.92)' : 'rgba(255,201,99,.88)';
    ctx.lineWidth = player.hyper ? 4.2 : 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(midX, midY, player.sap.knot.x, ky);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,249,214,.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(alpha, time) {
    const x = lerp(player.px, player.x, alpha);
    const y = worldToScreenY(lerp(player.py, player.y, alpha));
    const speed = Math.hypot(player.vx, player.vy);
    const tilt = clamp(player.vx / 850, -0.48, 0.48);
    const airborne = !player.grounded;
    const squash = player.squash * 0.16;
    const stretch = player.stretch * 0.12 + (airborne ? clamp(Math.abs(player.vy) / 1400, 0, 0.08) : 0);
    const sx = 1 + squash - stretch * 0.4;
    const sy = 1 - squash + stretch;

    if (airborne && player.airJumps > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18 + Math.sin(time * 7) * 0.03;
      ctx.strokeStyle = '#b1ffd0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(sx * player.facing, sy);

    if (player.hyper && !state.reducedMotion) {
      ctx.globalAlpha = 0.15;
      for (let i = 1; i <= 5; i += 1) {
        ctx.fillStyle = '#93ffbe';
        ctx.beginPath();
        ctx.ellipse(-player.facing * i * 11, i * 3, 14, 19, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#78dc92';
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.quadraticCurveTo(-18 - speed * 0.014, -8 + Math.sin(time * 10) * 2, -29 - speed * 0.019, 4);
    ctx.quadraticCurveTo(-15, 7, -4, 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#382117';
    ctx.beginPath(); ctx.ellipse(-7, 16, 7, 4.5, -0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, 16, 7, 4.5, 0.16, 0, Math.PI * 2); ctx.fill();

    const body = ctx.createLinearGradient(0, -18, 0, 18);
    body.addColorStop(0, '#f6ddb4');
    body.addColorStop(1, '#bd7c51');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 1, 13.5, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#a3e9ad';
    ctx.beginPath();
    ctx.moveTo(-9, -13); ctx.quadraticCurveTo(-20, -27, -15, -3); ctx.quadraticCurveTo(-10, -9, -9, -13); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -13); ctx.quadraticCurveTo(20, -27, 15, -3); ctx.quadraticCurveTo(10, -9, 9, -13); ctx.fill();

    ctx.fillStyle = '#20140f';
    const eyeY = player.heat > 0.35 ? -4 : -5;
    ctx.beginPath(); ctx.arc(-5, eyeY, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, eyeY, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4c2c20';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (player.hyper) ctx.arc(0, 1, 5, 0.1, Math.PI - 0.1);
    else if (player.vy < -500) { ctx.moveTo(-3, 2); ctx.lineTo(3, 2); }
    else ctx.arc(0, 1, 3.2, 0.25, Math.PI - 0.25);
    ctx.stroke();

    ctx.save();
    ctx.translate(9, 6);
    ctx.rotate(-0.48 + Math.sin(time * 7) * 0.04);
    ctx.strokeStyle = '#5e321c';
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -17); ctx.stroke();
    ctx.shadowColor = '#ffc766';
    ctx.shadowBlur = player.sap ? 14 : 7;
    ctx.fillStyle = player.sap ? '#fff1a7' : '#e8a94f';
    ctx.beginPath(); ctx.arc(0, -19, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      const y = worldToScreenY(particle.y);
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      if (particle.kind === 'resin') ctx.fillStyle = '#ffca65';
      else if (particle.kind === 'ember') ctx.fillStyle = '#ff663f';
      else if (particle.kind === 'bark') ctx.fillStyle = '#a45a2b';
      else ctx.fillStyle = '#89d696';
      ctx.beginPath();
      if (particle.kind === 'leaf') ctx.ellipse(particle.x, y, particle.r * 1.5, particle.r * 0.65, particle.x * 0.01, 0, Math.PI * 2);
      else ctx.arc(particle.x, y, particle.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawThreat(time) {
    const y = worldToScreenY(state.threatY);
    if (y < -120 || y > H + 160) return;
    const gradient = ctx.createLinearGradient(0, y - 90, 0, H);
    gradient.addColorStop(0, 'rgba(255,108,48,0)');
    gradient.addColorStop(0.38, 'rgba(255,87,39,.28)');
    gradient.addColorStop(1, 'rgba(110,16,8,.84)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y - 90, W, H - y + 90);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,176,62,.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const wave = Math.sin(x * 0.048 + time * 5.5) * 8 + Math.sin(x * 0.019 - time * 3) * 5;
      const py = y + wave;
      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSpeedLines() {
    if (state.reducedMotion) return;
    const speed = Math.hypot(player.vx, player.vy);
    const intensity = clamp((speed - 560) / 520 + (player.hyper ? 0.52 : 0), 0, 1);
    if (intensity <= 0) return;
    ctx.save();
    ctx.globalAlpha = intensity * 0.24;
    ctx.strokeStyle = '#c8ffe0';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 24; i += 1) {
      const seed = state.stars[i];
      const x = seed.x;
      const y = (seed.y + state.elapsed * 190 * seed.parallax) % H;
      const length = 18 + intensity * 58;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - player.vx * 0.025, y + Math.sign(player.vy || 1) * length);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHud() {
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.font = '10px ui-monospace,SFMono-Regular,Menlo,monospace';
    ctx.fillStyle = 'rgba(235,255,239,.52)';
    ctx.fillText(`FLOOR ${player.highestFloor}`, 22, 18);
    ctx.fillText(`SCORE ${Math.floor(player.score).toString().padStart(6, '0')}`, 22, 35);
    ctx.fillText(`BEST ${Math.floor(state.highScore).toString().padStart(6, '0')}`, 22, 52);
    const route = S.activeRouteChunk();
    const phase = S.phaseForFloor(player.highestFloor);
    ctx.fillStyle = 'rgba(235,255,239,.28)';
    ctx.font = '8px ui-monospace,monospace';
    ctx.fillText(`${phase.name}${route ? ` · ${route.type}` : ''}`, 22, 70);

    ctx.fillStyle = player.airJumps > 0 ? '#b8ffd1' : 'rgba(235,255,239,.25)';
    ctx.font = '9px ui-monospace,monospace';
    ctx.fillText(`AIR KICK ${player.airJumps > 0 ? 'READY' : 'SPENT'}`, 22, 84);

    if (player.combo > 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = player.hyper ? '#a8ffc9' : 'rgba(255,232,164,.92)';
      ctx.font = `${player.hyper ? 24 : 18}px ui-monospace,monospace`;
      ctx.fillText(`${player.combo}× FLOW`, W - 22, 18);
      const width = 146;
      const normalized = clamp(player.comboTimer / (TUNE.combo.window + 0.34), 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(W - 22 - width, 49, width, 3);
      ctx.fillStyle = player.hyper ? '#8dffb8' : '#f1c66a';
      ctx.fillRect(W - 22 - width, 49, width * normalized, 3);
      ctx.font = '8px ui-monospace,monospace';
      if (!player.hyper && player.combo >= TUNE.combo.sapSurgeThreshold) {
        ctx.fillStyle = '#a8ffc9';
        ctx.fillText('SAP SURGE ARMED', W - 22, 58);
      } else if (!player.hyper) {
        ctx.fillStyle = 'rgba(235,255,239,.34)';
        ctx.fillText(`${Math.max(0, TUNE.combo.sapSurgeThreshold - player.combo)} TO SAP SURGE`, W - 22, 58);
      } else {
        ctx.fillStyle = '#b8ffd1';
        ctx.fillText('CROWNVELOCITY · RELEASE HOT', W - 22, 58);
      }
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(235,255,239,.42)';
    ctx.font = '9px ui-monospace,monospace';
    ctx.fillText('SAP CATCH', 22, H - 36);
    for (let i = 0; i < 2; i += 1) {
      ctx.strokeStyle = 'rgba(255,195,91,.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(91 + i * 18, H - 31, 5.5, 0, Math.PI * 2); ctx.stroke();
      if (i < player.saves) {
        ctx.fillStyle = '#ffc461';
        ctx.beginPath(); ctx.arc(91 + i * 18, H - 31, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (player.saves < 2) {
      ctx.fillStyle = 'rgba(255,255,255,.1)';
      ctx.fillRect(128, H - 34, 72, 4);
      ctx.fillStyle = '#d49745';
      ctx.fillRect(128, H - 34, 72 * clamp(player.resin, 0, 1), 4);
    }
    ctx.restore();
  }

  function drawTelemetry() {
    if (!state.telemetryVisible) return;
    const summary = S.summarizeTelemetry();
    const route = S.activeRouteChunk();
    const lines = [
      `seed ${summary.seed} · ${S.round(summary.runSeconds, 1)}s · ${S.phaseForFloor(player.highestFloor).name} / ${route?.type || '-'}`,
      `air ${Math.round(summary.movement.airborneRatio * 100)}% · ground ${Math.round(summary.movement.groundedRatio * 100)}% · low-vx ${Math.round(summary.movement.lowMomentumRatio * 100)}%`,
      `speed avg ${summary.movement.avgSpeed} · peak ${summary.movement.peakSpeed} · vx peak ${summary.movement.peakAbsVx}`,
      `airtime ${summary.movement.avgAirtimeSeconds}s · kick ${summary.counters.doubleJumps} · refresh ${summary.counters.airJumpRefreshes}`,
      `bark ${summary.counters.wallBounces} · burls ${summary.counters.launchBurls} · rings ${summary.counters.ringsThreaded}`,
      `sap ${summary.counters.sapAttaches}/${summary.counters.sapAttempts} · surge ${summary.counters.sapSurges} · gain ${summary.sapline.avgReleaseSpeedGain}`,
      `combo links ${summary.counters.comboLinks} · max ${summary.combo.maxCombo} · link Δ ${summary.combo.avgLinkInterval}s`,
      `crown ${summary.counters.crownvelocityEntries} · burns ${summary.counters.momentumBurns} · catches ${summary.counters.sapCatches}`,
    ];
    ctx.save();
    ctx.fillStyle = 'rgba(2,8,5,.80)';
    ctx.fillRect(14, 104, 390, 146);
    ctx.strokeStyle = 'rgba(159,255,187,.18)';
    ctx.strokeRect(14.5, 104.5, 389, 145);
    ctx.font = '9px ui-monospace,monospace';
    ctx.textBaseline = 'top';
    lines.forEach((line, index) => {
      ctx.fillStyle = index === 0 ? 'rgba(188,255,205,.78)' : 'rgba(230,255,237,.50)';
      ctx.fillText(line, 25, 115 + index * 15);
    });
    ctx.restore();
  }

  function drawMessages() {
    let y = H * 0.23;
    for (const message of state.messages.slice(-3)) {
      const t = message.life / message.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 5 + 0.25);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${message.size}px ui-monospace,monospace`;
      ctx.fillStyle = '#edffe8';
      ctx.shadowColor = '#68ff9c';
      ctx.shadowBlur = 16;
      ctx.fillText(message.text, W / 2, y);
      ctx.restore();
      y += message.size + 8;
    }
  }

  function drawTouchControls() {
    if (!state.touchMode || state.mode !== 'playing') return;
    const items = [
      { x: 76, label: '◀', action: 'left' },
      { x: 154, label: '▶', action: 'right' },
      { x: W - 154, label: 'JUMP', action: 'jump' },
      { x: W - 70, label: 'SAP', action: 'sap' },
    ];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const item of items) {
      const active = [...state.pointers.values()].includes(item.action);
      ctx.fillStyle = active ? 'rgba(174,255,197,.18)' : 'rgba(255,255,255,.06)';
      ctx.strokeStyle = active ? 'rgba(174,255,197,.55)' : 'rgba(255,255,255,.13)';
      ctx.beginPath(); ctx.arc(item.x, H - 74, 31, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = active ? '#d9ffe3' : 'rgba(255,255,255,.48)';
      ctx.font = item.label.length > 2 ? '8px ui-monospace,monospace' : '16px ui-monospace,monospace';
      ctx.fillText(item.label, item.x, H - 74);
    }
    ctx.restore();
  }

  function drawOverlay() {
    if (state.mode === 'playing') return;
    ctx.fillStyle = 'rgba(2,7,5,.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (state.mode === 'title') {
      const gradient = ctx.createLinearGradient(W * 0.23, 0, W * 0.77, 0);
      gradient.addColorStop(0, '#8cffad');
      gradient.addColorStop(0.58, '#efffcf');
      gradient.addColorStop(1, '#ffbc62');
      ctx.fillStyle = gradient;
      ctx.font = '700 50px ui-monospace,monospace';
      ctx.fillText('SYLVARIA: SEQUOIA', W / 2, H * 0.29);
      ctx.fillStyle = 'rgba(232,255,239,.62)';
      ctx.font = '12px ui-monospace,monospace';
      ctx.fillText('AERIAL FLOW CLIMBER · v0.3', W / 2, H * 0.37);
      ctx.fillStyle = 'rgba(232,255,239,.48)';
      ctx.font = '10px ui-monospace,monospace';
      ctx.fillText('jump again in air for AIR KICK · rings + strong bark + Sap releases refresh it', W / 2, H * 0.47);
      ctx.fillText('5× flow arms SAP SURGE · 7× with 3 move types ignites CROWNVELOCITY', W / 2, H * 0.515);
      ctx.fillText('glowing branch burls are launch pads · recovery shelves bank long chains', W / 2, H * 0.56);
      ctx.fillStyle = '#dfffe7';
      ctx.font = '700 13px ui-monospace,monospace';
      ctx.fillText(state.touchMode ? 'TAP TO CLIMB' : 'SPACE TO CLIMB', W / 2, H * 0.67);
      ctx.fillStyle = 'rgba(232,255,239,.28)';
      ctx.font = '9px ui-monospace,monospace';
      ctx.fillText('T telemetry · R retry seed · N new route · J copy run JSON', W / 2, H * 0.74);
    } else if (state.mode === 'paused') {
      ctx.fillStyle = '#eaffef';
      ctx.font = '700 30px ui-monospace,monospace';
      ctx.fillText('PAUSED IN THE BARK', W / 2, H * 0.45);
      ctx.fillStyle = 'rgba(232,255,239,.55)';
      ctx.font = '11px ui-monospace,monospace';
      ctx.fillText('P or Space to resume', W / 2, H * 0.53);
    } else if (state.mode === 'gameover') {
      const summary = S.summarizeTelemetry();
      ctx.fillStyle = '#fff0d1';
      ctx.font = '700 32px ui-monospace,monospace';
      ctx.fillText('FALL ENDS. RHYTHM DOESN’T.', W / 2, H * 0.35);
      ctx.fillStyle = 'rgba(232,255,239,.72)';
      ctx.font = '14px ui-monospace,monospace';
      ctx.fillText(`floor ${player.highestFloor} · score ${Math.floor(player.score)} · best flow ${player.bestCombo}×`, W / 2, H * 0.45);
      ctx.fillStyle = 'rgba(232,255,239,.45)';
      ctx.font = '10px ui-monospace,monospace';
      ctx.fillText(`air ${Math.round(summary.movement.airborneRatio * 100)}% · kicks ${summary.counters.doubleJumps} · rings ${summary.counters.ringsThreaded} · surges ${summary.counters.sapSurges}`, W / 2, H * 0.51);
      ctx.fillStyle = '#dfffe7';
      ctx.font = '700 13px ui-monospace,monospace';
      ctx.fillText(state.touchMode ? 'TAP TO RUN AGAIN' : 'SPACE TO RUN AGAIN', W / 2, H * 0.62);
    }
  }

  function render(alpha, now) {
    ctx.save();
    const speed = Math.hypot(player.vx, player.vy);
    const speedWide = clamp((speed - 640) / 1120, 0, 1) * TUNE.camera.speedWideView;
    const hyperWide = player.hyper ? TUNE.camera.hyperWideView : 0;
    const sceneScale = state.reducedMotion ? 1 : 1 - speedWide - hyperWide;
    const shakePhase = now * 0.021 + state.elapsed * 7.3;
    const sx = state.shake > 0 && !state.reducedMotion ? Math.sin(shakePhase * 1.37) * state.shake * 4.2 : 0;
    const sy = state.shake > 0 && !state.reducedMotion ? Math.cos(shakePhase * 1.73) * state.shake * 3.7 : 0;
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(sceneScale, sceneScale);
    ctx.translate(-W / 2, -H / 2);
    drawBackground(now * 0.001);
    drawSpeedLines();
    drawTrunk(0, state.LEFT_WALL, 1);
    drawTrunk(W, W - state.RIGHT_WALL, -1);
    for (const branch of state.branches) drawBranch(branch);
    for (const ring of state.rings) drawRing(ring, now * 0.001);
    for (const knot of state.knots) drawKnot(knot, now * 0.001);
    drawThreat(now * 0.001);
    drawSapline(alpha);
    drawParticles();
    drawPlayer(alpha, now * 0.001);
    ctx.restore();
    drawHud();
    drawTelemetry();
    drawMessages();
    drawTouchControls();
    drawOverlay();
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,211,139,${state.flash * 0.2})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  S.worldToScreenY = worldToScreenY;
  S.render = render;
})();
