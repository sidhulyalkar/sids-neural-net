(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { ctx, W, H, state, player, TUNE, clamp, lerp } = S;

  function worldToScreenY(worldY) {
    return H - (worldY - state.cameraBottom);
  }

  function phaseStyle() {
    const name = S.phaseForFloor(player.highestFloor).name;
    if (name === 'ROOTWAYS') return { sky0:'#07120d', sky1:'#020604', fog:'#4e8b64', moss:'#68a96f', bark:'#7b3d22' };
    if (name === 'REDWOOD RUN') return { sky0:'#071715', sky1:'#020807', fog:'#4b9180', moss:'#62ad85', bark:'#864323' };
    if (name === 'SAPWORK') return { sky0:'#081829', sky1:'#020710', fog:'#6889b5', moss:'#6ab191', bark:'#8a4827' };
    if (name === 'HIGH CANOPY') return { sky0:'#11182e', sky1:'#050713', fog:'#817dc1', moss:'#72bb9b', bark:'#95502c' };
    return { sky0:'#1b1634', sky1:'#060711', fog:'#b16ca3', moss:'#79cfa7', bark:'#9f552f' };
  }

  function drawBackground(time) {
    const p = phaseStyle();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, p.sky0); g.addColorStop(1, p.sky1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Deep forest silhouettes. These use deterministic screen-space waves only.
    ctx.save();
    for (let layer = 0; layer < 3; layer += 1) {
      const alpha = 0.07 + layer * 0.035;
      const base = H * (0.56 + layer * 0.10);
      ctx.fillStyle = `rgba(18,53,37,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 36) {
        const h = 55 + ((x * 17 + layer * 53) % 95) + Math.sin(x * 0.037 + layer) * 20;
        ctx.lineTo(x, base - h);
        ctx.lineTo(x + 15, base);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }

    // Canopy shafts create depth and make the wider chambers feel intentional.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i += 1) {
      const center = 210 + i * 145 + Math.sin(time * 0.17 + i) * 35;
      const shaft = ctx.createLinearGradient(center, 0, center + 70, H);
      shaft.addColorStop(0, 'rgba(180,255,207,.075)');
      shaft.addColorStop(1, 'rgba(180,255,207,0)');
      ctx.fillStyle = shaft;
      ctx.beginPath();
      ctx.moveTo(center - 26, 0); ctx.lineTo(center + 22, 0); ctx.lineTo(center + 135, H); ctx.lineTo(center + 42, H); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    const fog = ctx.createRadialGradient(W/2, H*.64, 40, W/2, H*.64, 480);
    fog.addColorStop(0, `${p.fog}24`); fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog; ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  function innerEdgeX(side) {
    return side === 'left' ? state.LEFT_WALL : state.RIGHT_WALL;
  }

  function drawSequoia(side, time) {
    const p = phaseStyle();
    const left = side === 'left';
    const edge = innerEdgeX(side);
    const outer = left ? 0 : W;
    const width = left ? edge : W - edge;
    const body = ctx.createLinearGradient(outer, 0, edge, 0);
    if (left) {
      body.addColorStop(0, '#160b08'); body.addColorStop(.45, '#3c1a10'); body.addColorStop(.78, p.bark); body.addColorStop(1, '#3b190f');
    } else {
      body.addColorStop(0, '#160b08'); body.addColorStop(.55, '#3c1a10'); body.addColorStop(.22, p.bark); body.addColorStop(1, '#3b190f');
    }
    ctx.fillStyle = body;
    ctx.fillRect(left ? 0 : edge, 0, width, H);

    ctx.save();
    // Large bark plates instead of uniform vertical stripes.
    for (let row = -1; row < 10; row += 1) {
      const y = row * 82 + ((state.cameraBottom * .19 + row * 31) % 82);
      for (let col = 0; col < 4; col += 1) {
        const plateW = 20 + ((row * 13 + col * 17) % 25);
        const xBase = left ? 10 + col * 27 : W - 10 - col * 27;
        const dir = left ? 1 : -1;
        ctx.fillStyle = `rgba(${80 + col*12},${37 + row%3*5},${19 + col*2},.35)`;
        ctx.beginPath();
        ctx.moveTo(xBase, y);
        ctx.lineTo(xBase + dir * plateW, y + 7);
        ctx.lineTo(xBase + dir * (plateW - 5), y + 59);
        ctx.lineTo(xBase + dir * 3, y + 70);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(230,139,72,.12)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }

    // Exact collision edge stays bright and straight so art never lies.
    ctx.strokeStyle = 'rgba(242,151,78,.30)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(edge, 0); ctx.lineTo(edge, H); ctx.stroke();
    ctx.strokeStyle = 'rgba(116,210,132,.26)'; ctx.lineWidth = 4;
    ctx.setLineDash([18, 32]); ctx.lineDashOffset = -(state.cameraBottom * .18);
    ctx.beginPath(); ctx.moveTo(edge + (left ? -4 : 4), -20); ctx.lineTo(edge + (left ? -4 : 4), H+20); ctx.stroke();
    ctx.setLineDash([]);

    // Moss pads, bracket fungi and ancient knots give the sides landmarks.
    for (let i = 0; i < 6; i += 1) {
      const y = ((i * 119 + state.cameraBottom * .31) % (H + 120)) - 60;
      const inward = edge + (left ? -1 : 1) * (9 + (i%3)*7);
      ctx.fillStyle = i % 2 ? 'rgba(83,156,91,.48)' : 'rgba(118,188,107,.42)';
      ctx.beginPath(); ctx.ellipse(inward, y, 15 + i%3*5, 5 + i%2*2, left ? -.35 : .35, 0, Math.PI*2); ctx.fill();
      if (i % 3 === 0) {
        ctx.fillStyle = 'rgba(243,184,98,.56)';
        ctx.beginPath(); ctx.ellipse(inward + (left ? 8 : -8), y + 13, 9, 3, 0, 0, Math.PI*2); ctx.fill();
      }
    }
    for (let i = 0; i < 3; i += 1) {
      const y = ((i * 207 + 74 + state.cameraBottom * .16) % (H + 150)) - 75;
      const x = edge + (left ? -34 : 34);
      const rg = ctx.createRadialGradient(x,y,2,x,y,21);
      rg.addColorStop(0,'#17100c'); rg.addColorStop(.55,'#4c2516'); rg.addColorStop(1,'rgba(24,12,8,0)');
      ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,y,22,0,Math.PI*2); ctx.fill();
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
    const pulse = 1 + Math.sin(state.elapsed*5 + branch.floor)*.08;
    ctx.save(); ctx.translate(branch.launchX,y);
    ctx.shadowColor='#ffd17b'; ctx.shadowBlur=14;
    ctx.fillStyle='rgba(255,187,78,.22)'; ctx.beginPath(); ctx.arc(0,0,16*pulse,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#d98d45'; ctx.beginPath(); ctx.ellipse(0,-1,10*pulse,5.5*pulse,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,244,183,.8)'; ctx.lineWidth=1.2; ctx.stroke(); ctx.restore();
  }

  function drawBranch(branch) {
    const x1=branch.x1,x2=branch.x2;
    const y1=worldToScreenY(S.branchYAt(branch,x1));
    const y2=worldToScreenY(S.branchYAt(branch,x2));
    if (Math.max(y1,y2)<-45 || Math.min(y1,y2)>H+45) return;
    const midX=(x1+x2)/2, midY=(y1+y2)/2 + Math.sin(branch.floor*1.7)*2.2;
    ctx.save(); ctx.lineCap='round';
    ctx.strokeStyle='#24120d'; ctx.lineWidth=branch.thickness+9;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(midX,midY,x2,y2); ctx.stroke();
    ctx.strokeStyle=routeColor(branch.chunkType); ctx.lineWidth=branch.thickness;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(midX,midY,x2,y2); ctx.stroke();
    ctx.strokeStyle='rgba(237,169,92,.30)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x1+5,y1-2); ctx.quadraticCurveTo(midX,midY-3,x2-5,y2-2); ctx.stroke();
    ctx.strokeStyle='rgba(97,168,92,.32)'; ctx.lineWidth=2.2; ctx.setLineDash([13,19]);
    ctx.beginPath(); ctx.moveTo(x1+7,y1-5); ctx.quadraticCurveTo(midX,midY-6,x2-7,y2-5); ctx.stroke(); ctx.setLineDash([]);
    drawLaunchBurl(branch,worldToScreenY(S.branchYAt(branch,branch.launchX)));
    ctx.restore();
  }

  function drawRing(ring,time) {
    if (ring.hit) return;
    const y=worldToScreenY(ring.y); if(y<-55||y>H+55)return;
    const r=ring.radius*(1+Math.sin(time*4+ring.pulse)*.07);
    ctx.save();ctx.translate(ring.x,y);ctx.rotate(time*.32+ring.pulse);
    ctx.shadowColor='#8dffc2';ctx.shadowBlur=17;ctx.strokeStyle='rgba(145,255,188,.88)';ctx.lineWidth=3.4;
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,221,131,.55)';ctx.lineWidth=1;ctx.setLineDash([4,7]);
    ctx.beginPath();ctx.arc(0,0,r-6,0,Math.PI*2);ctx.stroke();ctx.restore();
  }

  function drawKnot(knot,time) {
    const y=worldToScreenY(knot.y);if(y<-50||y>H+50)return;
    const pulse=1+Math.sin(time*3.4+knot.pulse)*.12;
    const g=ctx.createRadialGradient(knot.x,y,2,knot.x,y,24*pulse);
    g.addColorStop(0,'rgba(255,249,190,.98)');g.addColorStop(.22,'rgba(255,177,66,.78)');g.addColorStop(1,'rgba(255,132,36,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(knot.x,y,24*pulse,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f2b34d';ctx.beginPath();ctx.arc(knot.x,y,5.7,0,Math.PI*2);ctx.fill();
  }

  function drawSapline(alpha) {
    if(!player.sap)return;
    const x=lerp(player.px,player.x,alpha), y=worldToScreenY(lerp(player.py,player.y,alpha));
    const ky=worldToScreenY(player.sap.knot.y);
    ctx.save();ctx.shadowColor='#ffc65f';ctx.shadowBlur=13;ctx.strokeStyle='rgba(255,215,116,.92)';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo((x+player.sap.knot.x)/2-18,(y+ky)/2,player.sap.knot.x,ky);ctx.stroke();ctx.restore();
  }

  function drawPlayer(alpha,time) {
    const x=lerp(player.px,player.x,alpha), y=worldToScreenY(lerp(player.py,player.y,alpha));
    const speed=Math.hypot(player.vx,player.vy);
    const lean=clamp(player.vx/1100,-.28,.28);
    const cling=player.state==='wall-cling' || S.flowAssist?.getState?.().clingActive;
    const runPhase=state.elapsed*12 + player.x*.025;
    ctx.save();ctx.translate(x,y);ctx.rotate(cling?0:lean);ctx.scale(player.facing||1,1);

    // Hide the legacy sprite completely under a premium dark silhouette plate.
    ctx.fillStyle='rgba(4,8,6,.76)';ctx.beginPath();ctx.ellipse(0,2,19,25,0,0,Math.PI*2);ctx.fill();

    // Flow scarf is the strongest motion-readable element.
    const trail=24+clamp(speed/20,0,26);
    ctx.fillStyle=player.hyper?'rgba(148,255,190,.92)':'rgba(84,189,116,.9)';
    ctx.beginPath();ctx.moveTo(-5,-8);ctx.quadraticCurveTo(-18,-13+Math.sin(time*8)*3,-trail,2);ctx.quadraticCurveTo(-16,5,-3,2);ctx.closePath();ctx.fill();

    // Legs and boots articulate direction instead of reading as one bean.
    const stride=cling?0:Math.sin(runPhase)*clamp(speed/400,0,.8);
    ctx.strokeStyle='#2b1c16';ctx.lineWidth=5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-5,11);ctx.lineTo(-8-stride*5,20);ctx.stroke();
    ctx.beginPath();ctx.moveTo(5,11);ctx.lineTo(8+stride*5,20);ctx.stroke();
    ctx.fillStyle='#201611';ctx.beginPath();ctx.ellipse(-10-stride*4,21,6,3,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(10+stride*4,21,6,3,0,0,Math.PI*2);ctx.fill();

    // Tunic, belt and luminous heartwood clasp.
    const tunic=ctx.createLinearGradient(0,-12,0,15);tunic.addColorStop(0,'#95d7a4');tunic.addColorStop(.55,'#477f61');tunic.addColorStop(1,'#2e5948');
    ctx.fillStyle=tunic;ctx.beginPath();ctx.moveTo(-12,-8);ctx.quadraticCurveTo(-15,5,-10,15);ctx.lineTo(10,15);ctx.quadraticCurveTo(15,4,12,-8);ctx.closePath();ctx.fill();
    ctx.fillStyle='#3b291b';ctx.fillRect(-11,6,22,3);
    ctx.shadowColor='#ffc86a';ctx.shadowBlur=9;ctx.fillStyle='#ffd07b';ctx.beginPath();ctx.arc(0,7.5,2.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;

    // Hood and face give Pip a deliberate forest-climber identity.
    ctx.fillStyle='#254c39';ctx.beginPath();ctx.arc(0,-12,13.5,Math.PI,0);ctx.lineTo(12,-4);ctx.quadraticCurveTo(0,2,-12,-4);ctx.closePath();ctx.fill();
    ctx.fillStyle='#d8b487';ctx.beginPath();ctx.ellipse(0,-8,9.5,8.5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#1d1712';ctx.beginPath();ctx.arc(-3.5,-9,1.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(3.5,-9,1.5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#5d3a25';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(0,-6,3,.2,Math.PI-.2);ctx.stroke();
    ctx.fillStyle='#5ea96c';ctx.beginPath();ctx.moveTo(-9,-18);ctx.lineTo(-18,-26);ctx.lineTo(-13,-12);ctx.closePath();ctx.fill();

    // Sap hook/staff is now readable as a tool, not a floating dot.
    ctx.save();ctx.translate(12,3);ctx.rotate(-.38 + (cling?.28:Math.sin(time*5)*.035));
    ctx.strokeStyle='#4a2b19';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,12);ctx.lineTo(0,-18);ctx.stroke();
    ctx.strokeStyle='#d8ad58';ctx.lineWidth=2;ctx.beginPath();ctx.arc(3,-18,6,Math.PI*.55,Math.PI*1.55);ctx.stroke();
    ctx.shadowColor='#ffcb67';ctx.shadowBlur=player.sap?14:6;ctx.fillStyle='#ffc75f';ctx.beginPath();ctx.arc(0,-18,3.4,0,Math.PI*2);ctx.fill();ctx.restore();

    if(player.airJumps>0 && !player.grounded){ctx.strokeStyle='rgba(151,255,194,.34)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,28,0,Math.PI*2);ctx.stroke();}
    if(cling){ctx.fillStyle='rgba(178,255,192,.58)';ctx.font='7px ui-monospace,monospace';ctx.textAlign='center';ctx.scale(player.facing||1,1);ctx.fillText('GRIP',0,-34);}
    ctx.restore();
  }

  function drawParticles(){for(const p of state.particles){const y=worldToScreenY(p.y);ctx.globalAlpha=clamp(p.life/p.maxLife,0,1);ctx.fillStyle=p.kind==='resin'?'#ffc867':p.kind==='ember'?'#ff6840':p.kind==='bark'?'#a45b31':'#85d49a';ctx.beginPath();ctx.arc(p.x,y,Math.max(1,p.r),0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}

  function drawThreat(time){const y=worldToScreenY(state.threatY);if(y<-120||y>H+160)return;const g=ctx.createLinearGradient(0,y-70,0,H);g.addColorStop(0,'rgba(255,98,41,0)');g.addColorStop(.4,'rgba(255,80,35,.22)');g.addColorStop(1,'rgba(85,13,8,.88)');ctx.fillStyle=g;ctx.fillRect(0,y-70,W,H-y+70);ctx.strokeStyle='rgba(255,174,66,.58)';ctx.lineWidth=2.5;ctx.beginPath();for(let x=0;x<=W;x+=24){const py=y+Math.sin(x*.047+time*5)*7+Math.sin(x*.019-time*3)*4;x?ctx.lineTo(x,py):ctx.moveTo(x,py);}ctx.stroke();}

  function drawSpeedLines(){if(state.reducedMotion)return;const speed=Math.hypot(player.vx,player.vy);const intensity=clamp((speed-620)/460+(player.hyper?.28:0),0,1);if(!intensity)return;ctx.save();ctx.globalAlpha=intensity*.16;ctx.strokeStyle='#c9ffe0';for(let i=0;i<18;i+=1){const s=state.stars[i];const y=(s.y+state.elapsed*150*s.parallax)%H;ctx.beginPath();ctx.moveTo(s.x,y);ctx.lineTo(s.x-player.vx*.018,y+28+intensity*30);ctx.stroke();}ctx.restore();}

  function drawHud(){
    const phase=S.phaseForFloor(player.highestFloor), route=S.activeRouteChunk();
    ctx.save();ctx.textBaseline='top';ctx.font='9px ui-monospace,monospace';ctx.fillStyle='rgba(231,255,237,.58)';
    ctx.fillText(`FLOOR ${player.highestFloor}`,18,17);ctx.fillText(`SCORE ${Math.floor(player.score).toString().padStart(6,'0')}`,18,33);
    ctx.fillStyle='rgba(231,255,237,.28)';ctx.font='8px ui-monospace,monospace';ctx.fillText(`${phase.name}${route?` · ${route.type}`:''}`,18,50);
    const assist=S.flowAssist?.getState?.()||{};const stride=clamp((assist.strideMomentum||0)/TUNE.run.strideMax,0,1);
    ctx.fillStyle='rgba(255,255,255,.10)';ctx.fillRect(18,68,118,3);ctx.fillStyle='#78d99b';ctx.fillRect(18,68,118*stride,3);
    ctx.fillStyle='rgba(220,255,230,.42)';ctx.fillText(`STRIDE ${Math.round(assist.strideMomentum||0)}${assist.clingActive?' · BARK GRIP':''}`,18,76);
    ctx.fillStyle=player.airJumps>0?'#b9ffd2':'rgba(235,255,239,.24)';ctx.fillText(`AIR KICK ${player.airJumps>0?'READY':'SPENT'}`,18,91);
    if(player.combo>0){ctx.textAlign='right';ctx.fillStyle=player.hyper?'#a5ffc9':'#f4d38b';ctx.font=`700 ${player.hyper?22:17}px ui-monospace,monospace`;ctx.fillText(`${player.combo}× FLOW`,W-18,17);ctx.fillStyle='rgba(255,255,255,.11)';ctx.fillRect(W-158,45,140,3);ctx.fillStyle=player.hyper?'#84f5b0':'#e8b95f';ctx.fillRect(W-158,45,140*clamp(player.comboTimer/TUNE.combo.window,0,1),3);ctx.font='8px ui-monospace,monospace';ctx.fillStyle='rgba(228,255,235,.48)';ctx.fillText(player.hyper?'CROWNVELOCITY':`${Math.max(0,TUNE.combo.easyHyperThreshold-player.combo)} TO PURE CROWN`,W-18,55);}
    ctx.textAlign='left';ctx.fillStyle='rgba(225,255,232,.28)';ctx.font='8px ui-monospace,monospace';ctx.fillText('BARK: HOLD INTO WALL · JUMP TO KICK',18,H-25);ctx.restore();
  }

  function drawTelemetry(){if(!state.telemetryVisible)return;const q=S.summarizeTelemetry(),a=S.flowAssist?.getState?.()||{};const lines=[`seed ${q.seed} · ${S.round(q.runSeconds,1)}s · floor ${q.floor}`,`speed avg ${q.movement.avgSpeed} · peak ${q.movement.peakSpeed} · stride ${Math.round(a.strideMomentum||0)}`,`air ${Math.round(q.movement.airborneRatio*100)}% · kick ${q.counters.doubleJumps} · bark ${q.counters.wallBounces}`,`rings ${q.counters.ringsThreaded} · sap ${q.counters.sapAttaches}/${q.counters.sapAttempts} · surge ${q.counters.sapSurges}`,`combo max ${q.combo.maxCombo} · link Δ ${q.combo.avgLinkInterval}s`,`cling ${q.counters.barkClings||0} · bark kicks ${q.counters.barkKicks||0} · redirects ${q.counters.passiveBarkRedirects||0}`];ctx.save();ctx.fillStyle='rgba(2,8,5,.84)';ctx.fillRect(13,112,370,112);ctx.strokeStyle='rgba(150,255,185,.17)';ctx.strokeRect(13.5,112.5,369,111);ctx.font='9px ui-monospace,monospace';lines.forEach((l,i)=>{ctx.fillStyle=i?'rgba(230,255,237,.50)':'rgba(188,255,205,.78)';ctx.fillText(l,24,123+i*15);});ctx.restore();}

  function drawMessages(){let y=H*.23;for(const m of state.messages.slice(-3)){const t=m.life/m.maxLife;ctx.save();ctx.globalAlpha=Math.min(1,t*2.5)*Math.min(1,(1-t)*5+.25);ctx.textAlign='center';ctx.font=`700 ${m.size}px ui-monospace,monospace`;ctx.fillStyle='#ecffe8';ctx.shadowColor='#68ff9c';ctx.shadowBlur=13;ctx.fillText(m.text,W/2,y);ctx.restore();y+=m.size+8;}}

  function drawTouchControls(){if(!state.touchMode||state.mode!=='playing')return;const items=[{x:68,l:'◀',a:'left'},{x:142,l:'▶',a:'right'},{x:W-142,l:'JUMP',a:'jump'},{x:W-68,l:'SAP',a:'sap'}];ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';for(const it of items){const active=[...state.pointers.values()].includes(it.a);ctx.fillStyle=active?'rgba(174,255,197,.17)':'rgba(255,255,255,.055)';ctx.strokeStyle=active?'rgba(174,255,197,.55)':'rgba(255,255,255,.13)';ctx.beginPath();ctx.arc(it.x,H-70,29,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(235,255,239,.65)';ctx.font=it.l.length>2?'8px ui-monospace,monospace':'15px ui-monospace,monospace';ctx.fillText(it.l,it.x,H-70);}ctx.restore();}

  function drawOverlay(){if(state.mode==='playing')return;ctx.fillStyle='rgba(2,7,5,.65)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.textBaseline='middle';if(state.mode==='title'){const g=ctx.createLinearGradient(W*.25,0,W*.75,0);g.addColorStop(0,'#78df9d');g.addColorStop(.55,'#efffcf');g.addColorStop(1,'#f4b45f');ctx.fillStyle=g;ctx.font='700 45px ui-monospace,monospace';ctx.fillText('SYLVARIA: SEQUOIA',W/2,H*.27);ctx.fillStyle='rgba(232,255,239,.62)';ctx.font='11px ui-monospace,monospace';ctx.fillText('SKILL-FLOW CLIMBER · v0.3',W/2,H*.35);ctx.fillStyle='rgba(232,255,239,.48)';ctx.font='10px ui-monospace,monospace';ctx.fillText('speed creates height · 2+ floor clears build FLOW · passive bark does not score',W/2,H*.45);ctx.fillText('hold into bark to CLING, then Jump for BARK KICK · Shift/E for SAP',W/2,H*.50);ctx.fillText('Grove Chambers open the tower into wider route puzzles',W/2,H*.55);ctx.fillStyle='#dfffe7';ctx.font='700 13px ui-monospace,monospace';ctx.fillText(state.touchMode?'TAP TO CLIMB':'SPACE TO CLIMB',W/2,H*.66);ctx.fillStyle='rgba(232,255,239,.28)';ctx.font='9px ui-monospace,monospace';ctx.fillText('T telemetry · R retry · N new route · P pause',W/2,H*.73);}else if(state.mode==='paused'){ctx.fillStyle='#eaffef';ctx.font='700 28px ui-monospace,monospace';ctx.fillText('PAUSED IN THE BARK',W/2,H*.45);ctx.font='11px ui-monospace,monospace';ctx.fillText('P or Space to resume',W/2,H*.53);}else if(state.mode==='gameover'){const q=S.summarizeTelemetry();ctx.fillStyle='#fff0d1';ctx.font='700 30px ui-monospace,monospace';ctx.fillText('THE GROVE TOOK THE RHYTHM',W/2,H*.35);ctx.fillStyle='rgba(232,255,239,.72)';ctx.font='13px ui-monospace,monospace';ctx.fillText(`floor ${player.highestFloor} · score ${Math.floor(player.score)} · best flow ${player.bestCombo}×`,W/2,H*.45);ctx.fillStyle='rgba(232,255,239,.44)';ctx.font='10px ui-monospace,monospace';ctx.fillText(`bark kicks ${q.counters.barkKicks||0} · rings ${q.counters.ringsThreaded} · surges ${q.counters.sapSurges}`,W/2,H*.51);ctx.fillStyle='#dfffe7';ctx.font='700 13px ui-monospace,monospace';ctx.fillText(state.touchMode?'TAP TO RUN AGAIN':'SPACE TO RUN AGAIN',W/2,H*.62);}}

  function render(alpha,now){
    ctx.save();const speed=Math.hypot(player.vx,player.vy);const speedWide=clamp((speed-650)/1000,0,1)*TUNE.camera.speedWideView;const hyperWide=player.hyper?TUNE.camera.hyperWideView:0;const sceneScale=state.reducedMotion?1:1-speedWide-hyperWide;const shakePhase=now*.021+state.elapsed*7.3;const sx=state.shake&&!state.reducedMotion?Math.sin(shakePhase*1.37)*state.shake*3.4:0;const sy=state.shake&&!state.reducedMotion?Math.cos(shakePhase*1.73)*state.shake*3.0:0;ctx.translate(W/2+sx,H/2+sy);ctx.scale(sceneScale,sceneScale);ctx.translate(-W/2,-H/2);
    drawBackground(now*.001);drawSpeedLines();drawSequoia('left',now*.001);drawSequoia('right',now*.001);for(const b of state.branches)drawBranch(b);for(const r of state.rings)drawRing(r,now*.001);for(const k of state.knots)drawKnot(k,now*.001);drawThreat(now*.001);drawSapline(alpha);drawParticles();drawPlayer(alpha,now*.001);ctx.restore();drawHud();drawTelemetry();drawMessages();drawTouchControls();drawOverlay();if(state.flash>0){ctx.fillStyle=`rgba(255,211,139,${state.flash*.18})`;ctx.fillRect(0,0,W,H);}
  }

  S.worldToScreenY=worldToScreenY;
  S.render=render;
})();
