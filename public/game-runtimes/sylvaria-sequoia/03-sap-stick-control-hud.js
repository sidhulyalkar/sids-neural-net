(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  if (!S?.render) return;

  const { ctx, W, H, state, player } = S;
  const baseRender = S.render;
  const HUD_VERSION = 'shift-hold-v1';

  function panel(x, y, w, h, alpha = 0.86) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 7);
    ctx.fillStyle = `rgba(8,10,8,${alpha})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,157,.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function keycap(x, y, w, label, active = false) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, 24, 4);
    ctx.fillStyle = active ? 'rgba(122,77,20,.96)' : 'rgba(22,24,21,.96)';
    ctx.fill();
    ctx.strokeStyle = active ? '#ffd071' : 'rgba(255,249,230,.58)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#fff9e8';
    ctx.font = '800 11px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + 12);
  }

  function drawBottomControl() {
    const stick = S.sapStick?.getState?.() || {};
    const x = 18;
    const y = H - 88;
    panel(x, y, 246, 68, 0.88);
    keycap(x + 13, y + 11, 58, 'SHIFT', Boolean(stick.held));

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = stick.active ? '#fff0a8' : '#ffb74e';
    ctx.font = '900 12px system-ui,sans-serif';
    ctx.fillText(stick.active ? 'SAP STICK LOCKED' : 'SAP STICK', x + 82, y + 27);

    ctx.fillStyle = 'rgba(250,244,225,.72)';
    ctx.font = '700 9px system-ui,sans-serif';
    if (stick.active) {
      ctx.fillText('HOLD + A/D = SWING   ·   RELEASE = VAULT', x + 13, y + 50);
    } else if (stick.acquireBufferRemaining > 0) {
      ctx.fillText('SEARCHING FOR AMBER LOCK…', x + 13, y + 50);
    } else {
      ctx.fillText('PRESS = FIRE   ·   HOLD = SWING   ·   RELEASE = VAULT', x + 13, y + 50);
    }
  }

  function drawRouteTutorial() {
    if (state.mode !== 'playing') return;
    const route = S.activeRouteChunk?.();
    if (!(state.elapsed < 14 || route?.type === 'SAPRUN' || route?.type === 'GROVE' || route?.type === 'SLINGSHOT')) return;

    const x = W - 224;
    const y = 112;
    panel(x, y, 206, 116, 0.82);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2bd70';
    ctx.font = '900 11px system-ui,sans-serif';
    ctx.fillText('ONE-BUTTON SAP STICK', x + 13, y + 22);
    ctx.fillStyle = '#fff3d2';
    ctx.font = '800 9px system-ui,sans-serif';
    ctx.fillText('SHIFT  →  FIRE AT BEST AMBER KNOT', x + 13, y + 45);
    ctx.fillText('HOLD + A/D  →  SHAPE THE SWING', x + 13, y + 66);
    ctx.fillText('RELEASE SHIFT  →  VAULT + AIR KICK', x + 13, y + 87);
    ctx.fillStyle = 'rgba(242,238,216,.54)';
    ctx.font = '700 8px system-ui,sans-serif';
    ctx.fillText('slightly early presses get a short lock buffer', x + 13, y + 105);
  }

  function drawTitleInstruction() {
    if (state.mode !== 'title') return;
    const w = 650;
    const h = 52;
    const x = (W - w) / 2;
    const y = H * 0.485;
    panel(x, y, w, h, 0.74);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff1c6';
    ctx.font = '800 11px system-ui,sans-serif';
    ctx.fillText('Space: jump / Air Kick   ·   Shift: fire Sap Stick   ·   hold + A/D: swing   ·   release Shift: vault', W / 2, y + 22);
    ctx.fillStyle = 'rgba(255,246,220,.62)';
    ctx.font = '700 9px system-ui,sans-serif';
    ctx.fillText('0: reset current seed   ·   N: new route   ·   P: pause', W / 2, y + 40);
  }

  function render(alpha, now) {
    baseRender(alpha, now);
    drawBottomControl();
    drawRouteTutorial();
    drawTitleInstruction();
  }

  S.render = render;
  S.sapStickControlHud = {
    version: HUD_VERSION,
    control: 'Shift press -> hold with A/D -> release to vault',
    resetKey: '0',
  };
})();
