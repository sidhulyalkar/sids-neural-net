(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  if (!S?.render) return;

  const { ctx, W, H, state } = S;
  const baseRender = S.render;
  const HUD_VERSION = 'shift-hold-minimal-v2';

  function pill(x, y, w, text, alpha = 0.72, accent = false) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 24, 12);
    ctx.fillStyle = accent ? 'rgba(84,56,20,.70)' : 'rgba(8,13,10,.48)';
    ctx.fill();
    ctx.strokeStyle = accent ? 'rgba(255,210,111,.55)' : 'rgba(255,247,220,.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = accent ? '#ffe2a0' : 'rgba(255,248,228,.78)';
    ctx.font = '800 9px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + 12);
    ctx.restore();
  }

  function drawPlayingCue() {
    if (state.mode !== 'playing') return;
    const stick = S.sapStick?.getState?.() || {};

    if (stick.active) {
      const w = 232;
      pill((W - w) / 2, H - 41, w, 'A/D SWING  ·  RELEASE SHIFT = VAULT', 0.86, true);
      return;
    }

    // Teach once, then get out of the player's way. Reappear briefly when the
    // player enters an authored open-air route without an active tether.
    const route = S.activeRouteChunk?.();
    const routeNeedsSap = route?.type === 'SAPRUN' || route?.type === 'SLINGSHOT' || route?.type === 'SKYHOOK' || route?.type === 'CROWNWEAVE';
    const early = state.elapsed < 7.5;
    const contextual = routeNeedsSap && (state.elapsed % 8.5) < 1.8;
    if (!early && !contextual) return;

    const fade = early ? Math.min(1, Math.max(0, (7.5 - state.elapsed) / 1.9)) : 0.74;
    const w = 286;
    pill((W - w) / 2, H - 41, w, 'SHIFT FIRE  ·  HOLD + A/D SWING  ·  RELEASE VAULT', fade * 0.82, false);
  }

  function drawTitleInstruction() {
    if (state.mode !== 'title') return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(24,13,8,.76)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(255,244,216,.84)';
    ctx.font = '800 10px system-ui,sans-serif';
    ctx.fillText('SPACE jump / Air Kick   ·   SHIFT fire, hold + A/D swing, release to vault', W / 2, H * 0.515);
    ctx.fillStyle = 'rgba(255,244,216,.50)';
    ctx.font = '700 8px system-ui,sans-serif';
    ctx.fillText('0 reset   ·   N new route   ·   P pause', W / 2, H * 0.55);
    ctx.restore();
  }

  function render(alpha, now) {
    baseRender(alpha, now);
    drawPlayingCue();
    drawTitleInstruction();
  }

  S.render = render;
  S.sapStickControlHud = {
    version: HUD_VERSION,
    control: 'Shift press -> hold with A/D -> release to vault',
    teaching: 'transient and contextual; no persistent side panels',
    resetKey: '0',
  };
})();
