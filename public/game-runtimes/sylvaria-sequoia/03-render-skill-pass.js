(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { ctx, W, H, state, player, TUNE, clamp, lerp } = S;

  function worldToScreenY(worldY) {
    return H - (worldY - state.cameraBottom);
  }

  function phaseStyle() {
    const name = S.phaseForFloor(player.highestFloor).name;
    if (name === 'ROOTWAYS') return { sky0: '#07120d', sky1: '#020604', fog: '#4e8b64', bark: '#7b3d22' };
    if (name === 'REDWOOD RUN') return { sky0: '#071715', sky1: '#020807', fog: '#4b9180', bark: '#864323' };
    if (name === 'SAPWORK') return { sky0: '#081829', sky1: '#020710', fog: '#6889b5', bark: '#8a4827' };
    if (name === 'HIGH CANOPY') return { sky0: '#11182e', sky1: '#050713', fog: '#817dc1', bark: '#95502c' };
    return { sky0: '#1b1634', sky1: '#060711', fog: '#b16ca3', bark: '#9f552f' };
  }

  function drawBackground(time) {
    const palette = phaseStyle();
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, palette.sky0);
    gradient.addColorStop(1, palette.sky1);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    for (let layer = 0; layer < 3; layer += 1) {
      const alpha = 0.07 + layer * 0.035;
      const base = H * (0.56 + layer * 0.10);
      ctx.fillStyle = `rgba(18,53,37,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 36) {
        const height = 55 + ((x * 17 + layer * 53) % 95) + Math.sin(x * 0.037 + layer) * 20;
        ctx.lineTo(x, base - height);
        ctx.lineTo(x + 15, base);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i += 1) {
      const center = 210 + i * 145 + Math.sin(time * 0.17 + i) * 35;
      const shaft = ctx.createLinearGradient(center, 0, center + 70, H);
      shaft.addColorStop(0, 'rgba(180,255,207,.075)');
      shaft.addColorStop(1, 'rgba(180,255,207,0)');
      ctx.fillStyle = shaft;
      ctx.beginPath();
      ctx.moveTo(center - 26, 0);
      ctx.lineTo(center + 22, 0);
      ctx.lineTo(center + 135, H);
      ctx.lineTo(center + 42, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    const fog = ctx.createRadialGradient(W / 2, H * 0.64, 40, W / 2, H * 0.64, 480);
    fog.addColorStop(0, `${palette.fog}24`);
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function innerEdgeX(side) {
    return side === 'left' ? state.LEFT_WALL : state.RIGHT_WALL;
  }

  function drawSequoia(side) {
    const palette = phaseStyle();
    const left = side === 'left';
    const edge = innerEdgeX(side);
    const outer = left ? 0 : W;
    const width = left ? edge : W - edge;
    const body = ctx.createLinearGradient(outer, 0, edge, 0);
    if (left) {
      body.addColorStop(0, '#160b08');
      body.addColorStop(0.45, '#3c1a10');
      body.addColorStop(0.78, palette.bark);
      body.addColorStop(1, '#3b190f');
    } else {
      body.addColorStop(0, '#3b190f');
      body.addColorStop(0.22, palette.bark);
      body.addColorStop(0.55, '#3c1a10');
      body.addColorStop(1, '#160b08');
    }
    ctx.fillStyle = body;
    ctx.fillRect(left ? 0 : edge, 0, width, H);

    ctx.save();
    for (let row = -1; row < 10; row += 1) {
      const y = row * 82 + ((state.cameraBottom * 0.19 + row * 31) % 82);
      for (let col = 0; col < 4; col += 1) {
        const plateW = 20 + ((row * 13 + col * 17) % 25);
        const xBase = left ? 10 + col * 27 : W - 10 - col * 27;
        const direction = left ? 1 : -1;
        ctx.fillStyle = `rgba(${80 + col * 12},${37 + (row % 3) * 5},${19 + col * 2},.35)`;
        ctx.beginPath();
        ctx.moveTo(xBase, y);
        ctx.lineTo(xBase + direction * plateW, y + 7);
        ctx.lineTo(xBase + direction * (plateW - 5), y + 59);
        ctx.lineTo(xBase + direction * 3, y + 70);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(230,139,72,.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // This straight line is the exact physical wall. Decorative bark remains
    // outside it so the renderer never lies about collision geometry.
    ctx.strokeStyle = 'rgba(242,151,78,.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(edge, 0);
    ctx.lineTo(edge, H);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(116,210,132,.27)';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 32]);
    ctx.lineDashOffset = -(state.cameraBottom * 0.18);
    ctx.beginPath();
    ctx.moveTo(edge + (left ? -4 : 4), -20);
    ctx.lineTo(edge + (left ? -4 : 4), H + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < 6; i += 1) {
      const y = ((i * 119 + state.cameraBottom * 0.31) % (H + 120)) - 60;
      const inward = edge + (left ? -1 : 1) * (9 + (i % 3) * 7);
      ctx.fillStyle = i % 2 ? 'rgba(83,156,91,.48)' : 'rgba(118,188,107,.42)';
      ctx.beginPath();
      ctx.ellipse(inward, y, 15 + (i % 3) * 5, 5 + (i % 2) * 2, left ? -0.35 : 0.35, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.fillStyle = 'rgba(243,184,98,.56)';
        ctx.beginPath();
        ctx.ellipse(inward + (left ? 8 : -8), y + 13, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < 3; i += 1) {
      const y = ((i * 207 + 74 + state.cameraBottom * 0.16) % (H + 150)) - 75;
      const x = edge + (left ? -34 : 34);
      const knot = ctx.createRadialGradient(x, y, 2, x, y, 21);
      knot.addColorStop(0, '#17100c');
      knot.addColorStop(0.55, '#4c2516');
      knot.addColorStop(1, 'rgba(24,12,8,0)');
      ctx.fillStyle = knot;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function routeColor(type) {
    if (type === 'GROVE') return '#ba7540';
    if (type === 'CRUX') return '#c06937';
    if (type === 'SLINGSHOT') return '#ad6434';
    if (type === 'RECOVERY') return '#81583a';
    return '#96502c';
  }

  function drawLaunchBurl(branch, y) {
    if (!branch.launch) return;
    const pulse = 1 + Math.sin(state.elapsed * 5 + branch.floor) * 0.08;
    ctx.save();
    ctx.translate(branch.launchX, y);
    ctx.shadowColor = '#ffd17b';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,187,78,.22)';
    ctx.beginPath();
    ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d98d45';
    ctx.beginPath();
    ctx.ellipse(0, -1, 10 * pulse, 5.5 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,244,183,.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  function drawBranch(branch) {
    const x1 = branch.x1;
    const x2 = branch.x2;
    const y1 = worldToScreenY(S.branchYAt(branch, x1));
    const y2 = worldToScreenY(S.branchYAt(branch, x2));
    if (Math.max(y1, y2) < -45 || Math.min(y1, y2) > H + 45) return;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 + Math.sin(branch.floor * 1.7) * 2.2;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#24120d';
    ctx.lineWidth = branch.thickness + 9;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();
    ctx.strokeStyle = routeColor(branch.chunkType);
    ctx.lineWidth = branch.thickness;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(237,169,92,.30)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1 + 5, y1 - 2);
    ctx.quadraticCurveTo(midX, midY - 3, x2 - 5, y2 - 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(97,168,92,.32)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([13, 19]);
    ctx.beginPath();
    ctx.moveTo(x1 + 7, y1 - 5);
    ctx.quadraticCurveTo(midX, midY - 6, x2 - 7, y2 - 5);
    ctx.stroke();
    ctx.setLineDash([]);
    drawLaunchBurl(branch, worldToScreenY(S.branchYAt(branch, branch.launchX)));
    ctx.restore();
  }

  function drawRing(ring, time) {
    if (ring.hit) return;
    const y = worldToScreenY(ring.y);
    if (y < -55 || y > H + 55) return;
    const radius = ring.radius * (1 + Math.sin(time * 4 + ring.pulse) * 0.07);
    ctx.save();
    ctx.translate(ring.x, y);
    ctx.rotate(time * 0.32 + ring.pulse);
    ctx.shadowColor = '#8dffc2';
    ctx.shadowBlur = 17;
    ctx.strokeStyle = 'rgba(145,255,188,.88)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,221,131,.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, radius - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawKnot(knot, time) {
    const y = worldToScreenY(knot.y);
    if (y < -50 || y > H + 50) return;
    const pulse = 1 + Math.sin(time * 3.4 + knot.pulse) * 0.12;
    const glow = ctx.createRadialGradient(knot.x, y, 2, knot.x, y, 24 * pulse);
    glow.addColorStop(0, 'rgba(255,249,190,.98)');
    glow.addColorStop(0.22, 'rgba(255,177,66,.78)');
    glow.addColorStop(1, 'rgba(255,132,36,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(knot.x, y, 24 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2b34d';
    ctx.beginPath();
    ctx.arc(knot.x, y, 5.7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSapline(alpha) {
    if (!player.sap) return;
    const x = lerp(player.px, player.x, alpha);
    const y = worldToScreenY(lerp(player.py, player.y, alpha));
    const knotY = worldToScreenY(player.sap.knot.y);
    ctx.save();
    ctx.shadowColor = '#ffc65f';
    ctx.shadowBlur = 13;
    ctx.strokeStyle = 'rgba(255,215,116,.92)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + player.sap.knot.x) / 2 - 18, (y + knotY) / 2, player.sap.knot.x, knotY);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(alpha, time) {
    const x = lerp(player.px, player.x, alpha);
    const y = worldToScreenY(lerp(player.py, player.y, alpha));
    const speed = Math.hypot(player.vx, player.vy);
    const lean = clamp(player.vx / 1100, -0.28, 0.28);
    const cling = player.state === 'wall-cling' || Boolean(S.flowAssist?.getState?.().clingActive);
    const runPhase = state.elapsed * 12 + player.x * 0.025;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cling ? 0 : lean);
    ctx.scale(player.facing || 1, 1);

    ctx.fillStyle = 'rgba(4,8,6,.76)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 19, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    const trail = 24 + clamp(speed / 20, 0, 26);
    ctx.fillStyle = player.hyper ? 'rgba(148,255,190,.92)' : 'rgba(84,189,116,.9)';
    ctx.beginPath();
    ctx.moveTo(-5, -8);
    ctx.quadraticCurveTo(-18, -13 + Math.sin(time * 8) * 3, -trail, 2);
    ctx.quadraticCurveTo(-16, 5, -3, 2);
    ctx.closePath();
    ctx.fill();

    const stride = cling ? 0 : Math.sin(runPhase) * clamp(speed / 400, 0, 0.8);
    ctx.strokeStyle = '#2b1c16';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, 11);
    ctx.lineTo(-8 - stride * 5, 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, 11);
    ctx.lineTo(8 + stride * 5, 20);
    ctx.stroke();
    ctx.fillStyle = '#201611';
    ctx.beginPath();
    ctx.ellipse(-10 - stride * 4, 21, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10 + stride * 4, 21, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const tunic = ctx.createLinearGradient(0, -12, 0, 15);
    tunic.addColorStop(0, '#95d7a4');
    tunic.addColorStop(0.55, '#477f61');
    tunic.addColorStop(1, '#2e5948');
    ctx.fillStyle = tunic;
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.quadraticCurveTo(-15, 5, -10, 15);
    ctx.lineTo(10, 15);
    ctx.quadraticCurveTo(15, 4, 12, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3b291b';
    ctx.fillRect(-11, 6, 22, 3);
    ctx.shadowColor = '#ffc86a';
    ctx.shadowBlur = 9;
    ctx.fillStyle = '#ffd07b';
    ctx.beginPath();
    ctx.arc(0, 7.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#254c39';
    ctx.beginPath();
    ctx.arc(0, -12, 13.5, Math.PI, 0);
    ctx.lineTo(12, -4);
    ctx.quadraticCurveTo(0, 2, -12, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d8b487';
    ctx.beginPath();
    ctx.ellipse(0, -8, 9.5, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d1712';
    ctx.beginPath();
    ctx.arc(-3.5, -9, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.5, -9, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5d3a25';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -6, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = '#5ea96c';
    ctx.beginPath();
    ctx.moveTo(-9, -18);
    ctx.lineTo(-18, -26);
    ctx.lineTo(-13, -12);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(12, 3);
    ctx.rotate(-0.38 + (cling ? 0.28 : Math.sin(time * 5) * 0.035));
    ctx.strokeStyle = '#4a2b19';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(0, -18);
    ctx.stroke();
    ctx.strokeStyle = '#d8ad58';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(3, -18, 6, Math.PI * 0.55, Math.PI * 1.55);
    ctx.stroke();
    ctx.shadowColor = '#ffcb67';
    ctx.shadowBlur = player.sap ? 14 : 6;
    ctx.fillStyle = '#ffc75f';
    ctx.beginPath();
    ctx.arc(0, -18, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (player.airJumps > 0 && !player.grounded) {
      ctx.strokeStyle = 'rgba(151,255,194,.34)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (cling) {
      ctx.fillStyle = 'rgba(178,255,192,.65)';
      ctx.font = '7px ui-monospace,monospace';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.scale(player.facing || 1, 1);
      ctx.fillText('GRIP', 0, -34);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      const y = worldToScreenY(particle.y);
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.kind === 'resin' ? '#ffc867' : particle.kind === 'ember' ? '#ff6840' : particle.kind === 'bark' ? '#a45b31' : '#85d49a';
      ctx.beginPath();
      ctx.arc(particle.x, y, Math.max(1, particle.r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawThreat(time) {
    const y = worldToScreenY(state.threatY);
    if (y < -120 || y > H + 160) return;
    const gradient = ctx.createLinearGradient(0, y - 70, 0, H);
    gradient.addColorStop(0, 'rgba(255,98,41,0)');
    gradient.addColorStop(0.4, 'rgba(255,80,35,.22)');
    gradient.addColorStop(1, 'rgba(85,13,8,.88)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y - 70, W, H - y + 70);
    ctx.strokeStyle = 'rgba(255,174,66,.58)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const py = y + Math.sin(x * 0.047 + time * 5) * 7 + Math.sin(x * 0.019 - time * 3) * 4;
      if (x) ctx.lineTo(x, py);
      else ctx.moveTo(x, py);
    }
    ctx.stroke();
  }

  function drawSpeedLines() {
    if (state.reducedMotion) return;
    const speed = Math.hypot(player.vx, player.vy);
    const intensity = clamp((speed - 620) / 460 + (player.hyper ? 0.28 : 0), 0, 1);
    if (!intensity) return;
    ctx.save();
    ctx.globalAlpha = intensity * 0.16;
    ctx.strokeStyle = '#c9ffe0';
    for (let i = 0; i < 18; i += 1) {
      const star = state.stars[i];
      const y = (star.y + state.elapsed * 150 * star.parallax) % H;
      ctx.beginPath();
      ctx.moveTo(star.x, y);
      ctx.lineTo(star.x - player.vx * 0.018, y + 28 + intensity * 30);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHud() {
    const phase = S.phaseForFloor(player.highestFloor);
    const route = S.activeRouteChunk();
    const assist = S.flowAssist?.getState?.() || {};
    const stride = clamp((assist.strideMomentum || 0) / TUNE.run.strideMax, 0, 1);

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.font = '9px ui-monospace,monospace';
    ctx.fillStyle = 'rgba(231,255,237,.58)';
    ctx.fillText(`FLOOR ${player.highestFloor}`, 18, 17);
    ctx.fillText(`SCORE ${Math.floor(player.score).toString().padStart(6, '0')}`, 18, 33);
    ctx.fillStyle = 'rgba(231,255,237,.28)';
    ctx.font = '8px ui-monospace,monospace';
    ctx.fillText(`${phase.name}${route ? ` · ${route.type}` : ''}`, 18, 50);
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.fillRect(18, 68, 118, 3);
    ctx.fillStyle = '#78d99b';
    ctx.fillRect(18, 68, 118 * stride, 3);
    ctx.fillStyle = 'rgba(220,255,230,.42)';
    ctx.fillText(`STRIDE ${Math.round(assist.strideMomentum || 0)}${assist.clingActive ? ' · BARK GRIP' : ''}`, 18, 76);
    ctx.fillStyle = player.airJumps > 0 ? '#b9ffd2' : 'rgba(235,255,239,.24)';
    ctx.fillText(`AIR KICK ${player.airJumps > 0 ? 'READY' : 'SPENT'}`, 18, 91);

    if (player.combo > 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = player.hyper ? '#a5ffc9' : '#f4d38b';
      ctx.font = `700 ${player.hyper ? 22 : 17}px ui-monospace,monospace`;
      ctx.fillText(`${player.combo}× FLOW`, W - 18, 17);
      ctx.fillStyle = 'rgba(255,255,255,.11)';
      ctx.fillRect(W - 158, 45, 140, 3);
      ctx.fillStyle = player.hyper ? '#84f5b0' : '#e8b95f';
      ctx.fillRect(W - 158, 45, 140 * clamp(player.comboTimer / TUNE.combo.window, 0, 1), 3);
      ctx.font = '8px ui-monospace,monospace';
      ctx.fillStyle = 'rgba(228,255,235,.48)';
      ctx.fillText(player.hyper ? 'CROWNVELOCITY' : `${Math.max(0, TUNE.combo.easyHyperThreshold - player.combo)} TO PURE CROWN`, W - 18, 55);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(225,255,232,.28)';
    ctx.font = '8px ui-monospace,monospace';
    ctx.fillText('BARK: HOLD INTO WALL · JUMP TO KICK', 18, H - 25);
    ctx.restore();
  }

  function drawTelemetry() {
    if (!state.telemetryVisible) return;
    const summary = S.summarizeTelemetry();
    const assist = S.flowAssist?.getState?.() || {};
    const lines = [
      `seed ${summary.seed} · ${S.round(summary.runSeconds, 1)}s · floor ${summary.floor}`,
      `speed avg ${summary.movement.avgSpeed} · peak ${summary.movement.peakSpeed} · stride ${Math.round(assist.strideMomentum || 0)}`,
      `air ${Math.round(summary.movement.airborneRatio * 100)}% · kick ${summary.counters.doubleJumps} · bark ${summary.counters.wallBounces}`,
      `rings ${summary.counters.ringsThreaded} · sap ${summary.counters.sapAttaches}/${summary.counters.sapAttempts} · surge ${summary.counters.sapSurges}`,
      `combo max ${summary.combo.maxCombo} · link Δ ${summary.combo.avgLinkInterval}s`,
      `cling ${summary.counters.barkClings || 0} · bark kicks ${summary.counters.barkKicks || 0} · redirects ${summary.counters.passiveBarkRedirects || 0}`,
    ];
    ctx.save();
    ctx.fillStyle = 'rgba(2,8,5,.84)';
    ctx.fillRect(13, 112, 370, 112);
    ctx.strokeStyle = 'rgba(150,255,185,.17)';
    ctx.strokeRect(13.5, 112.5, 369, 111);
    ctx.font = '9px ui-monospace,monospace';
    lines.forEach((line, index) => {
      ctx.fillStyle = index ? 'rgba(230,255,237,.50)' : 'rgba(188,255,205,.78)';
      ctx.fillText(line, 24, 123 + index * 15);
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
      ctx.font = `700 ${message.size}px ui-monospace,monospace`;
      ctx.fillStyle = '#ecffe8';
      ctx.shadowColor = '#68ff9c';
      ctx.shadowBlur = 13;
      ctx.fillText(message.text, W / 2, y);
      ctx.restore();
      y += message.size + 8;
    }
  }

  function drawTouchControls() {
    if (!state.touchMode || state.mode !== 'playing') return;
    const items = [
      { x: 68, label: '◀', action: 'left' },
      { x: 142, label: '▶', action: 'right' },
      { x: W - 142, label: 'JUMP', action: 'jump' },
      { x: W - 68, label: 'SAP', action: 'sap' },
    ];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const item of items) {
      const active = [...state.pointers.values()].includes(item.action);
      ctx.fillStyle = active ? 'rgba(174,255,197,.17)' : 'rgba(255,255,255,.055)';
      ctx.strokeStyle = active ? 'rgba(174,255,197,.55)' : 'rgba(255,255,255,.13)';
      ctx.beginPath();
      ctx.arc(item.x, H - 70, 29, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(235,255,239,.65)';
      ctx.font = item.label.length > 2 ? '8px ui-monospace,monospace' : '15px ui-monospace,monospace';
      ctx.fillText(item.label, item.x, H - 70);
    }
    ctx.restore();
  }

  function drawOverlay() {
    if (state.mode === 'playing') return;
    ctx.fillStyle = 'rgba(2,7,5,.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (state.mode === 'title') {
      const gradient = ctx.createLinearGradient(W * 0.25, 0, W * 0.75, 0);
      gradient.addColorStop(0, '#78df9d');
      gradient.addColorStop(0.55, '#efffcf');
      gradient.addColorStop(1, '#f4b45f');
      ctx.fillStyle = gradient;
      ctx.font = '700 45px ui-monospace,monospace';
      ctx.fillText('SYLVARIA: SEQUOIA', W / 2, H * 0.27);
      ctx.fillStyle = 'rgba(232,255,239,.62)';
      ctx.font = '11px ui-monospace,monospace';
      ctx.fillText('SKILL-FLOW CLIMBER · v0.3', W / 2, H * 0.35);
      ctx.fillStyle = 'rgba(232,255,239,.48)';
      ctx.font = '10px ui-monospace,monospace';
      ctx.fillText('speed creates height · 2+ floor clears build FLOW · passive bark does not score', W / 2, H * 0.45);
      ctx.fillText('hold into bark to CLING, then Jump for BARK KICK · Shift/E for SAP', W / 2, H * 0.50);
      ctx.fillText('Grove Chambers open the tower into wider route puzzles', W / 2, H * 0.55);
      ctx.fillStyle = '#dfffe7';
      ctx.font = '700 13px ui-monospace,monospace';
      ctx.fillText(state.touchMode ? 'TAP TO CLIMB' : 'SPACE TO CLIMB', W / 2, H * 0.66);
      ctx.fillStyle = 'rgba(232,255,239,.28)';
      ctx.font = '9px ui-monospace,monospace';
      ctx.fillText('T telemetry · R retry · N new route · P pause', W / 2, H * 0.73);
    } else if (state.mode === 'paused') {
      ctx.fillStyle = '#eaffef';
      ctx.font = '700 28px ui-monospace,monospace';
      ctx.fillText('PAUSED IN THE BARK', W / 2, H * 0.45);
      ctx.font = '11px ui-monospace,monospace';
      ctx.fillText('P or Space to resume', W / 2, H * 0.53);
    } else if (state.mode === 'gameover') {
      const summary = S.summarizeTelemetry();
      ctx.fillStyle = '#fff0d1';
      ctx.font = '700 30px ui-monospace,monospace';
      ctx.fillText('THE GROVE TOOK THE RHYTHM', W / 2, H * 0.35);
      ctx.fillStyle = 'rgba(232,255,239,.72)';
      ctx.font = '13px ui-monospace,monospace';
      ctx.fillText(`floor ${player.highestFloor} · score ${Math.floor(player.score)} · best flow ${player.bestCombo}×`, W / 2, H * 0.45);
      ctx.fillStyle = 'rgba(232,255,239,.44)';
      ctx.font = '10px ui-monospace,monospace';
      ctx.fillText(`bark kicks ${summary.counters.barkKicks || 0} · rings ${summary.counters.ringsThreaded} · surges ${summary.counters.sapSurges}`, W / 2, H * 0.51);
      ctx.fillStyle = '#dfffe7';
      ctx.font = '700 13px ui-monospace,monospace';
      ctx.fillText(state.touchMode ? 'TAP TO RUN AGAIN' : 'SPACE TO RUN AGAIN', W / 2, H * 0.62);
    }
  }

  function render(alpha, now) {
    ctx.save();
    const speed = Math.hypot(player.vx, player.vy);
    const speedWide = clamp((speed - 650) / 1000, 0, 1) * TUNE.camera.speedWideView;
    const hyperWide = player.hyper ? TUNE.camera.hyperWideView : 0;
    const sceneScale = state.reducedMotion ? 1 : 1 - speedWide - hyperWide;
    const shakePhase = now * 0.021 + state.elapsed * 7.3;
    const sx = state.shake && !state.reducedMotion ? Math.sin(shakePhase * 1.37) * state.shake * 3.4 : 0;
    const sy = state.shake && !state.reducedMotion ? Math.cos(shakePhase * 1.73) * state.shake * 3.0 : 0;
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(sceneScale, sceneScale);
    ctx.translate(-W / 2, -H / 2);
    drawBackground(now * 0.001);
    drawSpeedLines();
    drawSequoia('left');
    drawSequoia('right');
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
      ctx.fillStyle = `rgba(255,211,139,${state.flash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  S.worldToScreenY = worldToScreenY;
  S.render = render;
})();
